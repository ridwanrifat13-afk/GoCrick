import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { INITIAL_TOURNAMENT_STATE } from './src/data/initialTournamentState.ts';
import { applyTournamentAction } from './src/utils/tournamentReducer.ts';
import type { TournamentState, TournamentAction, GroupKey } from './src/types/tournament.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE_PATH = path.resolve(__dirname, '.tournament-state.json');

function loadPersistedState(): TournamentState {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const raw = fs.readFileSync(STATE_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as TournamentState;
      if (parsed && parsed.title && Array.isArray(parsed.players)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to load persisted state, using initial state:', err);
  }
  return INITIAL_TOURNAMENT_STATE;
}

function savePersistedState(state: TournamentState): void {
  try {
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist tournament state:', err);
  }
}

let authoritativeState: TournamentState = loadPersistedState();
const activeTimers: ReturnType<typeof setTimeout>[] = [];

function clearShuffleTimers() {
  while (activeTimers.length > 0) {
    const t = activeTimers.pop();
    if (t) clearTimeout(t);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  const broadcastState = () => {
    const connectedViewers = wss.clients.size;
    const payload = JSON.stringify({
      type: 'STATE_SYNC',
      state: authoritativeState,
      connectedViewers,
    });
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  };

  const broadcastPresence = () => {
    const connectedViewers = wss.clients.size;
    const payload = JSON.stringify({
      type: 'PRESENCE',
      connectedViewers,
    });
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  };

  wss.on('connection', (ws) => {
    // Send initial state immediately on connect
    ws.send(
      JSON.stringify({
        type: 'STATE_SYNC',
        state: authoritativeState,
        connectedViewers: wss.clients.size,
      })
    );
    broadcastPresence();

    ws.on('message', (raw) => {
      try {
        const message = JSON.parse(raw.toString());

        if (message.type === 'DISPATCH_ACTION' && message.action) {
          const action = message.action as TournamentAction;
          authoritativeState = applyTournamentAction(authoritativeState, action);
          savePersistedState(authoritativeState);
          broadcastState();
        } else if (
          message.type === 'START_DRAMATIC_SHUFFLE' &&
          message.group &&
          message.assignments
        ) {
          clearShuffleTimers();
          const group = message.group as GroupKey;
          const assignments = message.assignments as Record<string, string>;
          const now = Date.now();

          authoritativeState = applyTournamentAction(authoritativeState, {
            actionId: `srv-shuffle-start-${group}-${now}`,
            timestamp: new Date().toISOString(),
            type: 'START_GROUP_SHUFFLE',
            payload: { group, assignments },
          });
          savePersistedState(authoritativeState);
          broadcastState();

          // Stage 1-by-1 dramatic card reveal across all connected spectators
          const steps: (1 | 2 | 3)[] = [1, 2, 3];
          steps.forEach((step, idx) => {
            const timer = setTimeout(() => {
              // Only advance if still revealing and at prior step
              const currGroupState = authoritativeState.draft.groups[group];
              if (
                currGroupState &&
                currGroupState.status === 'revealing' &&
                currGroupState.revealStep < step
              ) {
                authoritativeState = applyTournamentAction(authoritativeState, {
                  actionId: `srv-shuffle-step-${group}-${step}-${now}`,
                  timestamp: new Date().toISOString(),
                  type: 'ADVANCE_GROUP_REVEAL',
                  payload: { group, step },
                });
                savePersistedState(authoritativeState);
                broadcastState();
              }
            }, (idx + 1) * 1150);
            activeTimers.push(timer);
          });
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    ws.on('close', () => {
      broadcastPresence();
    });
  });

  // REST Endpoints for Initial Sync & Offline Queue Batch Reconciliation
  app.get('/api/tournament', (_req, res) => {
    res.json({
      state: authoritativeState,
      connectedViewers: wss.clients.size,
    });
  });

  app.post('/api/tournament/action', (req, res) => {
    const action = req.body?.action as TournamentAction | undefined;
    if (!action || !action.actionId) {
      res.status(400).json({ error: 'Invalid action payload' });
      return;
    }
    authoritativeState = applyTournamentAction(authoritativeState, action);
    savePersistedState(authoritativeState);
    broadcastState();
    res.json({ state: authoritativeState });
  });

  app.post('/api/tournament/sync-batch', (req, res) => {
    const actions = req.body?.actions as TournamentAction[] | undefined;
    if (!Array.isArray(actions)) {
      res.status(400).json({ error: 'Expected actions array' });
      return;
    }
    for (const action of actions) {
      if (action && action.actionId) {
        authoritativeState = applyTournamentAction(authoritativeState, action);
      }
    }
    savePersistedState(authoritativeState);
    broadcastState();
    res.json({ state: authoritativeState });
  });

  const isDevMode = process.argv.includes('--dev') && process.env.NODE_ENV !== 'production';
  const distPath = path.resolve(__dirname, 'dist');

  if (isDevMode || !fs.existsSync(distPath)) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`SGHS-23 Cricket Tournament server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
