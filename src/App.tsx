import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Share2,
  Sun,
  Moon,
  Bell,
  Lock,
  Unlock,
  Wifi,
  WifiOff,
  Upload,
  Check,
  Copy,
  RefreshCw,
  Shield,
  HelpCircle,
  Cloud,
  LogOut,
  X,
} from 'lucide-react';
import {
  TournamentState,
  TournamentAction,
  GroupKey,
  TournamentNotification,
} from './types/tournament';
import { INITIAL_TOURNAMENT_STATE } from './data/initialTournamentState';
import { applyTournamentAction } from './utils/tournamentReducer';
import { LiveDraftStudio } from './components/LiveDraftStudio';
import { LiveScoreboard } from './components/LiveScoreboard';
import { MatchesAndSummaryView } from './components/MatchesAndSummaryView';
import { PlayerStatsDashboard } from './components/PlayerStatsDashboard';
import { NotificationCenter } from './components/NotificationCenter';
import { playTournamentSound } from './utils/soundEffects';
import {
  auth,
  db,
  doc,
  onSnapshot,
  onAuthStateChanged,
  User,
  TOURNAMENT_DOC_COLLECTION,
  TOURNAMENT_DOC_ID,
  OperationType,
  handleFirestoreError,
  parseTournamentFromFirestore,
  saveTournamentStateToFirestore,
  signInOrganizerWithGoogle,
  signOutOrganizer,
} from './firebase';

const LOCAL_STATE_KEY = 'sghs23_season2_state_v1';
const LOCAL_QUEUE_KEY = 'sghs23_season2_offline_queue_v1';
const LOCAL_THEME_KEY = 'sghs23_season2_theme_v1';
const LOCAL_ORG_UNLOCKED_KEY = 'sghs23_season2_organizer_v1';

type ActiveTab = 'DRAFT' | 'SCOREBOARD' | 'MATCHES' | 'STATS';

/**
 * Compresses an uploaded image file to a lightweight <=256x256 Data URL (~15-35KB)
 * so it easily fits inside Firestore's 1MB document limit and syncs instantaneously.
 */
function compressLogoImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 256;
        let width = img.width;
        let height = img.height;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height >= width && height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/webp', 0.85);
        resolve(compressed);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [state, setState] = useState<TournamentState>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STATE_KEY);
      if (cached) {
        return JSON.parse(cached) as TournamentState;
      }
    } catch {
      // Fallback to initial state
    }
    return INITIAL_TOURNAMENT_STATE;
  });

  const [pendingActions, setPendingActions] = useState<TournamentAction[]>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_QUEUE_KEY);
      if (cached) {
        return JSON.parse(cached) as TournamentAction[];
      }
    } catch {
      // Fallback
    }
    return [];
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('DRAFT');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(LOCAL_THEME_KEY);
    return saved ? saved === 'dark' : true;
  });

  const [isOrganizer, setIsOrganizer] = useState<boolean>(() => {
    return localStorage.getItem(LOCAL_ORG_UNLOCKED_KEY) === 'true';
  });

  // Firebase Auth & Firestore Cloud State
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [firestoreConnected, setFirestoreConnected] = useState<boolean>(false);
  const [cloudSyncing, setCloudSyncing] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [connectedViewers, setConnectedViewers] = useState<number>(1);
  const [simulatedOfflineMode, setSimulatedOfflineMode] = useState<boolean>(false);

  // Modals & Drawers
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeToast, setActiveToast] = useState<TournamentNotification | null>(
    null
  );

  const wsRef = useRef<WebSocket | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const lastTopNotificationIdRef = useRef<string | null>(
    state.notifications[0]?.id || null
  );
  const stateRef = useRef<TournamentState>(state);
  stateRef.current = state;

  const pendingActionsRef = useRef<TournamentAction[]>(pendingActions);
  pendingActionsRef.current = pendingActions;

  const simulatedOfflineRef = useRef<boolean>(simulatedOfflineMode);
  simulatedOfflineRef.current = simulatedOfflineMode;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Real-Time Firestore Subscription (Works on Vercel & Everywhere)
  useEffect(() => {
    if (!isAuthReady || simulatedOfflineMode) {
      setFirestoreConnected(false);
      return;
    }

    const docPath = `${TOURNAMENT_DOC_COLLECTION}/${TOURNAMENT_DOC_ID}`;
    const tournamentDocRef = doc(db, TOURNAMENT_DOC_COLLECTION, TOURNAMENT_DOC_ID);

    const unsubscribe = onSnapshot(
      tournamentDocRef,
      (snapshot) => {
        setFirestoreConnected(true);
        if (snapshot.exists()) {
          const cloudState = parseTournamentFromFirestore(
            snapshot.data() as Record<string, unknown>
          );
          setState((currentLocalState) => {
            // If organizer has newer local changes than Firestore, push local changes to Firestore
            if (currentLocalState.version > cloudState.version) {
              if (auth.currentUser && !simulatedOfflineRef.current) {
                saveTournamentStateToFirestore(currentLocalState).catch(() => {});
              }
              return currentLocalState;
            }
            let merged = cloudState;
            for (const pending of pendingActionsRef.current) {
              merged = applyTournamentAction(merged, pending);
            }
            return merged;
          });
        } else if (auth.currentUser && !simulatedOfflineRef.current) {
          // Initialize Firestore document with current local state when organizer signs in
          saveTournamentStateToFirestore(stateRef.current).catch(() => {});
        }
      },
      (error) => {
        setFirestoreConnected(false);
        handleFirestoreError(error, OperationType.GET, docPath);
      }
    );

    return () => unsubscribe();
  }, [isAuthReady, simulatedOfflineMode, authUser]);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem(LOCAL_THEME_KEY, 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem(LOCAL_THEME_KEY, 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors
    }
  }, [state]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(pendingActions));
    } catch {
      // Ignore
    }
  }, [pendingActions]);

  useEffect(() => {
    const latest = state.notifications[0];
    if (latest && latest.id !== lastTopNotificationIdRef.current) {
      lastTopNotificationIdRef.current = latest.id;
      setActiveToast(latest);
      playTournamentSound(latest.type, soundEnabled);
      const timer = setTimeout(() => {
        setActiveToast((curr) => (curr?.id === latest.id ? null : curr));
      }, 4800);
      return () => clearTimeout(timer);
    }
  }, [state.notifications, soundEnabled]);

  const flushOfflineQueue = useCallback(async (queueToFlush: TournamentAction[]) => {
    if (queueToFlush.length === 0 || simulatedOfflineRef.current) return;

    // 1. If signed in to Firebase, persist the latest state directly to Firestore
    if (auth.currentUser) {
      try {
        setCloudSyncing(true);
        await saveTournamentStateToFirestore(stateRef.current);
        setPendingActions([]);
        setCloudSyncing(false);
      } catch {
        setCloudSyncing(false);
      }
    }

    // 2. Also sync with local Express server if available
    try {
      const res = await fetch('/api/tournament/sync-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions: queueToFlush }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state && !auth.currentUser) {
          setState(data.state);
        }
        setPendingActions([]);
      }
    } catch {
      // Keep in queue if neither Firestore nor Express succeeded
    }
  }, []);

  useEffect(() => {
    if (simulatedOfflineMode) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsConnected(false);
      return;
    }

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    const connectWebSocket = () => {
      if (isUnmounted || simulatedOfflineRef.current) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (isUnmounted) return;
        setWsConnected(true);
        setIsOnline(true);
        if (pendingActionsRef.current.length > 0) {
          flushOfflineQueue(pendingActionsRef.current);
        }
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'STATE_SYNC' && msg.state) {
            const incomingState = msg.state as TournamentState;
            setState((currentLocalState) => {
              if (currentLocalState.version > incomingState.version) {
                if (socket.readyState === WebSocket.OPEN) {
                  socket.send(
                    JSON.stringify({
                      type: 'SYNC_FULL_STATE',
                      state: currentLocalState,
                    })
                  );
                }
                return currentLocalState;
              }

              let merged = incomingState;
              for (const pending of pendingActionsRef.current) {
                merged = applyTournamentAction(merged, pending);
              }
              return merged;
            });
            if (typeof msg.connectedViewers === 'number') {
              setConnectedViewers(msg.connectedViewers);
            }
          } else if (msg.type === 'PRESENCE' && typeof msg.connectedViewers === 'number') {
            setConnectedViewers(msg.connectedViewers);
          }
        } catch {
          // Ignore malformed frame
        }
      };

      socket.onclose = () => {
        if (isUnmounted || simulatedOfflineRef.current) return;
        setWsConnected(false);
        reconnectTimer = setTimeout(connectWebSocket, 4000);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connectWebSocket();

    const handleOnline = () => {
      setIsOnline(true);
      if (!simulatedOfflineRef.current && pendingActionsRef.current.length > 0) {
        flushOfflineQueue(pendingActionsRef.current);
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isUnmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flushOfflineQueue, simulatedOfflineMode]);

  const handleToggleOfflineSimulation = () => {
    const nextOffline = !simulatedOfflineMode;
    simulatedOfflineRef.current = nextOffline;
    setSimulatedOfflineMode(nextOffline);

    if (!nextOffline) {
      setIsOnline(true);
      if (pendingActionsRef.current.length > 0) {
        flushOfflineQueue(pendingActionsRef.current);
      } else if (auth.currentUser) {
        saveTournamentStateToFirestore(stateRef.current).catch(() => {});
      }
    }
  };

  const handleDispatchAction = useCallback(
    (type: TournamentAction['type'], payload: Record<string, unknown>) => {
      const action: TournamentAction = {
        actionId: `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        type,
        payload: payload as never,
      };

      const nextState = applyTournamentAction(stateRef.current, action);
      stateRef.current = nextState;
      setState(nextState);

      const canSyncOnline = isOnline && !simulatedOfflineRef.current;

      // 1. Save to Firebase Firestore if organizer is signed in with Google
      if (canSyncOnline && auth.currentUser) {
        setCloudSyncing(true);
        saveTournamentStateToFirestore(nextState)
          .then(() => setCloudSyncing(false))
          .catch(() => setCloudSyncing(false));
      }

      // 2. Also broadcast over WebSocket if connected
      if (canSyncOnline && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'DISPATCH_ACTION',
            action,
          })
        );
      } else if (!canSyncOnline || (!auth.currentUser && wsRef.current?.readyState !== WebSocket.OPEN)) {
        setPendingActions((prev) => [...prev, action]);
      }
    },
    [isOnline]
  );

  const handleTriggerDramaticGroupShuffle = useCallback(
    (group: GroupKey) => {
      const groupPlayers = stateRef.current.players.filter((p) => p.group === group);
      if (groupPlayers.length < 3) return;

      const shuffled = [...groupPlayers];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const assignments: Record<string, string> = {
        'team-1': shuffled[0].id,
        'team-2': shuffled[1].id,
        'team-3': shuffled[2].id,
      };

      // Dispatch each reveal step through handleDispatchAction so both Firebase Firestore
      // (on Vercel) and WebSocket spectators see the live card-by-card reveal!
      handleDispatchAction('START_GROUP_SHUFFLE', { group, assignments });
      setTimeout(() => {
        handleDispatchAction('ADVANCE_GROUP_REVEAL', { group, step: 1 });
      }, 950);
      setTimeout(() => {
        handleDispatchAction('ADVANCE_GROUP_REVEAL', { group, step: 2 });
      }, 2050);
      setTimeout(() => {
        handleDispatchAction('ADVANCE_GROUP_REVEAL', { group, step: 3 });
      }, 3150);
    },
    [handleDispatchAction]
  );

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedDataUrl = await compressLogoImage(file);
      handleDispatchAction('UPDATE_TOURNAMENT_META', {
        logoDataUrl: compressedDataUrl,
      });
    } catch {
      // Ignore invalid image
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    try {
      await signInOrganizerWithGoogle();
      setIsOrganizer(true);
      localStorage.setItem(LOCAL_ORG_UNLOCKED_KEY, 'true');
      setIsPinModalOpen(false);
      // Immediately upload current state to Firestore
      setCloudSyncing(true);
      await saveTournamentStateToFirestore(stateRef.current);
      setPendingActions([]);
      setCloudSyncing(false);
    } catch (err) {
      setCloudSyncing(false);
      setAuthError(
        err instanceof Error ? err.message : 'Google Sign-In was cancelled or blocked by popup blocker.'
      );
    }
  };

  const handleUnlockPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === state.organizerPin || pinInput.trim() === '2323') {
      setIsOrganizer(true);
      localStorage.setItem(LOCAL_ORG_UNLOCKED_KEY, 'true');
      setIsPinModalOpen(false);
      setPinInput('');
      setPinError('');
      if (auth.currentUser) {
        saveTournamentStateToFirestore(stateRef.current).catch(() => {});
      }
    } else {
      setPinError('Incorrect PIN. Default tournament organizer PIN is 2323.');
    }
  };

  const shareableUrl =
    typeof window !== 'undefined' ? window.location.origin : '';

  const handleCopyShareLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareableUrl).catch(() => {});
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const effectiveOnlineStatus =
    isOnline && !simulatedOfflineMode && (firestoreConnected || wsConnected);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      {/* Top Bar: Clean & Compact with Zero Horizontal Overflow */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Title */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('DRAFT');
          }}
          className="text-sm sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white truncate min-w-0 font-display"
        >
          {state.title}
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav
          aria-label="Primary Views"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400 shrink-0"
        >
          {(
            [
              { id: 'DRAFT', label: '1. Team Shuffle' },
              { id: 'SCOREBOARD', label: '2. Live Scoreboard' },
              { id: 'MATCHES', label: '3. Matches & Charts' },
              { id: 'STATS', label: '4. Player Stats' },
            ] as { id: ActiveTab; label: string }[]
          ).map((navItem) => (
            <button
              key={navItem.id}
              type="button"
              onClick={() => setActiveTab(navItem.id)}
              className={`py-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === navItem.id
                  ? 'border-emerald-500 text-slate-900 dark:text-white font-semibold'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {navItem.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: Quick User Guide Trigger */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setIsGuideModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>User Guide</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Tournament Identity & Easy Control Bar */}
        <section
          aria-label="Tournament Banner and Controls"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
        >
          {/* Left: Logo Placeholder Slot + Tournament Details + Share Link Button Below Title */}
          <div className="flex items-start sm:items-center gap-4 min-w-0">
            <div className="relative group shrink-0">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                title="Click to upload your tournament logo"
                className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 flex flex-col items-center justify-center overflow-hidden transition-colors cursor-pointer"
              >
                {state.logoDataUrl ? (
                  <img
                    src={state.logoDataUrl}
                    alt="SGHS-23 Tournament Logo"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <>
                    <Shield className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                      ADD LOGO
                    </span>
                  </>
                )}
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span>OCTOBER 22, 2026</span>
                <span aria-hidden="true">·</span>
                <span>{state.venue}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-semibold">
                  {firestoreConnected ? 'FIREBASE LIVE SYNC' : `${connectedViewers} ONLINE`}
                </span>
              </div>

              <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-0.5 break-words">
                {state.title}
              </h1>

              {/* Share Live Link Button & Logo Action Directly Below Tournament Title */}
              <div className="flex flex-wrap items-center gap-2.5 mt-2.5">
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(true)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share Live Link</span>
                </button>

                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{state.logoDataUrl ? 'Change Logo' : 'Upload Logo'}</span>
                </button>

                <span className="text-xs text-slate-500 dark:text-slate-400">
                  24 Players · 3 Captains · Groups A–G
                </span>
              </div>
            </div>
          </div>

          {/* Right: Easy-to-Understand Controls (Wraps cleanly without horizontal scroll) */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Firebase Google Cloud Persistence Button */}
            {authUser ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                <Cloud className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-[140px]">
                  {cloudSyncing ? 'Saving to Cloud...' : 'Cloud Saved'}
                </span>
                <button
                  type="button"
                  onClick={() => signOutOrganizer()}
                  title={`Signed in as ${authUser.email || 'Organizer'} — Click to sign out`}
                  className="ml-1 p-0.5 rounded hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
                title="Sign in with Google so all edited names, logos, shuffles, and scores save permanently to Firebase Cloud"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Sign In to Save to Cloud</span>
              </button>
            )}

            {/* Organizer PIN Lock / Unlock */}
            <button
              type="button"
              onClick={() => {
                if (isOrganizer) {
                  setIsOrganizer(false);
                  localStorage.setItem(LOCAL_ORG_UNLOCKED_KEY, 'false');
                } else {
                  setIsPinModalOpen(true);
                }
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isOrganizer
                  ? 'bg-slate-900 dark:bg-slate-800 border-emerald-500/50 text-emerald-400'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300'
              }`}
            >
              {isOrganizer ? (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Organizer Mode: ON</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Unlock Organizer (PIN: 2323)</span>
                </>
              )}
            </button>

            {/* Offline Sync Status */}
            <button
              type="button"
              onClick={handleToggleOfflineSimulation}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                effectiveOnlineStatus
                  ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300'
              }`}
              title="Click to test Offline Mode for remote grounds"
            >
              {effectiveOnlineStatus ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Online & Syncing</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Offline ({pendingActions.length} Saved)</span>
                </>
              )}
            </button>

            {pendingActions.length > 0 && isOnline && !simulatedOfflineMode && (
              <button
                type="button"
                onClick={() => flushOfflineQueue(pendingActions)}
                className="px-3 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync {pendingActions.length} Now</span>
              </button>
            )}

            {/* Notifications Feed Drawer Button */}
            <button
              type="button"
              onClick={() => setIsNotificationsOpen(true)}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Bell className="w-3.5 h-3.5 text-emerald-500" />
              <span>Updates ({state.notifications.length})</span>
            </button>

            {/* Day-Night Dark Mode Toggle */}
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              title="Switch between Dark Mode (Night Games) and Light Mode (Day Games)"
            >
              {darkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-700" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Organizer Cloud Sync Prompt Banner (if Organizer Mode is ON but not signed in to Firebase yet) */}
        {isOrganizer && !authUser && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200">
              <strong className="font-bold text-blue-600 dark:text-blue-400">
                Save Your Edits to Firebase Cloud:
              </strong>{' '}
              Sign in with Google once so all your edited player names, captain names, uploaded
              logo, live shuffles, and match scores are permanently saved in Firebase and visible
              to everyone opening your Vercel link.
              {authError && (
                <div className="text-rose-500 font-medium mt-1">{authError}</div>
              )}
            </div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Cloud className="w-4 h-4" />
              <span>Connect Google & Save to Cloud</span>
            </button>
          </div>
        )}

        {/* Mobile View Switcher */}
        <div className="grid grid-cols-4 gap-1.5 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl md:hidden">
          {(
            [
              { id: 'DRAFT', label: '1. Shuffle' },
              { id: 'SCOREBOARD', label: '2. Score' },
              { id: 'MATCHES', label: '3. Matches' },
              { id: 'STATS', label: '4. Stats' },
            ] as { id: ActiveTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active View Workspace */}
        {activeTab === 'DRAFT' && (
          <LiveDraftStudio
            state={state}
            isOrganizer={isOrganizer}
            onRequireOrganizer={() => setIsPinModalOpen(true)}
            onDispatchAction={handleDispatchAction}
            onTriggerDramaticGroupShuffle={handleTriggerDramaticGroupShuffle}
          />
        )}

        {activeTab === 'SCOREBOARD' && (
          <LiveScoreboard
            state={state}
            isOrganizer={isOrganizer}
            onRequireOrganizer={() => setIsPinModalOpen(true)}
            onDispatchAction={handleDispatchAction}
          />
        )}

        {activeTab === 'MATCHES' && (
          <MatchesAndSummaryView
            state={state}
            isOrganizer={isOrganizer}
            onRequireOrganizer={() => setIsPinModalOpen(true)}
            onDispatchAction={handleDispatchAction}
            onNavigateToScoreboard={(matchId) => {
              handleDispatchAction('SET_ACTIVE_MATCH', { matchId });
              setActiveTab('SCOREBOARD');
            }}
          />
        )}

        {activeTab === 'STATS' && <PlayerStatsDashboard state={state} />}
      </main>

      {/* Quiet Tournament Footer */}
      <footer className="mt-12 border-t border-slate-200 dark:border-slate-800/80 py-5 px-4 sm:px-8 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            {state.title} · Official Live Shuffling & Match Scoring Platform
          </div>
          <div className="flex items-center gap-4">
            <span>October 22, 2026</span>
            <span>·</span>
            <button
              type="button"
              onClick={() => setIsGuideModalOpen(true)}
              className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Open User Guide
            </button>
          </div>
        </div>
      </footer>

      {/* Notification Toast & Feed Drawer */}
      <NotificationCenter
        notifications={state.notifications}
        activeToast={activeToast}
        onDismissToast={() => setActiveToast(null)}
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((s) => !s)}
        onClearAll={() => handleDispatchAction('CLEAR_NOTIFICATIONS', {})}
      />

      {/* Built-in Interactive User Guide Modal */}
      {isGuideModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full max-h-[88vh] flex flex-col shadow-2xl">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-500" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  SGHS-23 Season 2 — Step-by-Step User Guide
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGuideModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="font-bold text-slate-900 dark:text-white">
                  1. Unlocking Organizer Mode & Saving to Firebase Cloud
                </div>
                <p>
                  Anyone who opens your <strong>Share Live Link</strong> joins as a{' '}
                  <strong>Spectator</strong> (read-only) and automatically receives live updates
                  from Firebase Firestore. As the organizer, click{' '}
                  <strong>Sign In to Save to Cloud</strong> (or unlock with PIN{' '}
                  <code className="font-mono font-bold text-emerald-500">2323</code>) so all your
                  edited names, logos, shuffles, and scores are permanently saved in Firebase!
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="font-bold text-slate-900 dark:text-white">
                  2. Customizing Captains, Players & Groups (Tab 1: Team Shuffle)
                </div>
                <p>
                  Go to <strong>1. Team Shuffle</strong> and click{' '}
                  <strong>Edit Names & Groups</strong>. Here you can rename the 3 Teams, the 3 Team
                  Captains, and the 21 players categorized in Groups A, B, C, D, E, F, and G. You
                  can also upload your custom tournament logo by clicking the{' '}
                  <strong>ADD LOGO</strong> shield box in the top banner.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="font-bold text-slate-900 dark:text-white">
                  3. Running the Live Group-by-Group Shuffle
                </div>
                <p>
                  Share the link with all players first. Then click{' '}
                  <strong>Shuffle Next: Group [X]</strong> (or click{' '}
                  <strong>Shuffle Group Now</strong> on any group A–G). A live spotlight stage
                  appears on everyone&apos;s screen and reveals the 3 players one card at a time into
                  Team 1, Team 2, and Team 3. When finished, click{' '}
                  <strong>Download Teams PDF</strong>.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="font-bold text-slate-900 dark:text-white">
                  4. Scoring Matches Ball-by-Ball (Tab 2: Live Scoreboard)
                </div>
                <p>
                  Go to <strong>2. Live Scoreboard</strong>, pick a match (Match 1, 2, 3, or Grand
                  Final), and click <strong>Set Toss & Overs</strong>. During the game, simply tap{' '}
                  <strong>0, 1, 2, 3, 4, 6</strong> or <strong>OUT (W)</strong> for each ball. Strike
                  rotates automatically on odd runs and at the end of every 6-ball over. Click{' '}
                  <strong>Download Scorecard PDF</strong> anytime to save the official match record.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsGuideModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
              >
                Got It, Close Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shareable Live Session Link Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Share Live Draft & Scoreboard Link
              </h3>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Send this link to all 24 SGHS-23 players on WhatsApp/Messenger. Anyone joining sees
              live group-by-group card reveals, team formations, and ball-by-ball scoreboard updates
              in real time via Firebase Cloud Sync.
            </p>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareableUrl}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200"
              />
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <div className="font-semibold text-slate-900 dark:text-white">
                Organizer Controls Protection
              </div>
              <div>
                Spectators view in read-only mode by default. Sign in with Google or use Organizer
                PIN{' '}
                <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                  {state.organizerPin}
                </strong>{' '}
                on your device to unlock group shuffling and live scoring.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Organizer PIN & Google Cloud Sign-In Modal */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Unlock Organizer Controls
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsPinModalOpen(false);
                  setPinError('');
                  setAuthError('');
                }}
                className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Recommended: Google Sign-In for Firebase Cloud Sync */}
            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-2.5">
              <div className="text-xs text-slate-700 dark:text-slate-300">
                <strong className="text-slate-900 dark:text-white block mb-0.5">
                  Recommended: Unlock & Enable Cloud Save
                </strong>
                Sign in with Google so your customized player names, logo, shuffles, and scores are
                permanently saved in Firebase Firestore.
              </div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Cloud className="w-4 h-4" />
                <span>Sign In with Google & Unlock</span>
              </button>
              {authError && (
                <p className="text-xs text-rose-500">{authError}</p>
              )}
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
              <span className="shrink-0 mx-3 text-[11px] uppercase tracking-wider text-slate-400">
                Or unlock with PIN
              </span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
            </div>

            <form onSubmit={handleUnlockPinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Enter Organizer PIN (Default: <span className="font-mono font-bold">2323</span>)
                </label>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError('');
                  }}
                  placeholder="Enter PIN (2323)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-center font-mono text-lg tracking-widest text-slate-900 dark:text-white"
                />
                {pinError && (
                  <p className="text-xs text-rose-500 mt-1.5">{pinError}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPinInput('2323');
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Auto-Fill 2323
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                >
                  Unlock Studio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
