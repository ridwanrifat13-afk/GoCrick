import {
  ALL_GROUPS,
  type TournamentState,
  type TournamentAction,
  type GroupKey,
  type InningsData,
  type BallEvent,
  type Match,
  type TournamentNotification,
} from '../types/tournament.ts';
import { createEmptyInnings, GROUP_DESCRIPTIONS } from '../data/initialTournamentState.ts';

export function formatOvers(legalBalls: number): string {
  const overs = Math.floor(legalBalls / 6);
  const balls = legalBalls % 6;
  return `${overs}.${balls}`;
}

export function calculateRunRate(runs: number, legalBalls: number): string {
  if (legalBalls === 0) return '0.00';
  return ((runs / legalBalls) * 6).toFixed(2);
}

function pushNotification(
  notifications: TournamentNotification[],
  notif: Omit<TournamentNotification, 'id'>,
  deterministicKey: string
): TournamentNotification[] {
  const id = `notif-${deterministicKey}`;
  const filtered = notifications.filter((n) => n.id !== id);
  const newNotif: TournamentNotification = {
    ...notif,
    id,
  };
  return [newNotif, ...filtered].slice(0, 40);
}

function finalizeMatchIfCompleted(
  match: Match,
  state: TournamentState,
  actionId: string,
  actionTimestamp: string
): {
  updatedMatch: Match;
  notifications: TournamentNotification[];
} {
  let notifications = [...state.notifications];
  const m = { ...match };
  const maxBalls = m.oversLimit * 6;

  // Check if Innings 2 is active and finished
  if (m.currentInnings === 2) {
    const target = m.innings1.runs + 1;
    const inn2 = { ...m.innings2 };
    const teamBat = state.teams.find((t) => t.id === inn2.battingTeamId);
    const teamBowl = state.teams.find((t) => t.id === inn2.bowlingTeamId);

    if (inn2.runs >= target) {
      inn2.completed = true;
      m.innings2 = inn2;
      m.status = 'Completed';
      m.winnerTeamId = inn2.battingTeamId;
      const wicketsRemaining = Math.max(1, 7 - inn2.wickets);
      m.resultSummary = `${teamBat?.name || 'Team'} won by ${wicketsRemaining} wicket${wicketsRemaining > 1 ? 's' : ''}`;
      notifications = pushNotification(
        notifications,
        {
          type: 'MATCH_RESULT',
          title: `Match Completed · ${m.title}`,
          message: m.resultSummary,
          timestamp: actionTimestamp,
          matchId: m.id,
        },
        `${actionId}-match-result`
      );
    } else if (inn2.legalBalls >= maxBalls || inn2.wickets >= 7) {
      inn2.completed = true;
      m.innings2 = inn2;
      m.status = 'Completed';
      if (inn2.runs === m.innings1.runs) {
        m.winnerTeamId = 'TIE';
        m.resultSummary = 'Match Tied! Super Over / Boundary Countback applies.';
      } else {
        m.winnerTeamId = inn2.bowlingTeamId;
        const margin = m.innings1.runs - inn2.runs;
        m.resultSummary = `${teamBowl?.name || 'Team'} won by ${margin} run${margin > 1 ? 's' : ''}`;
      }
      notifications = pushNotification(
        notifications,
        {
          type: 'MATCH_RESULT',
          title: `Match Completed · ${m.title}`,
          message: m.resultSummary,
          timestamp: actionTimestamp,
          matchId: m.id,
        },
        `${actionId}-match-result`
      );
    }
  } else if (m.currentInnings === 1) {
    const inn1 = { ...m.innings1 };
    if (inn1.legalBalls >= maxBalls || inn1.wickets >= 7) {
      inn1.completed = true;
      m.innings1 = inn1;
    }
  }

  return { updatedMatch: m, notifications };
}

export function applyTournamentAction(
  state: TournamentState,
  action: TournamentAction
): TournamentState {
  // Idempotency check
  if (state.processedActionIds.includes(action.actionId)) {
    return state;
  }

  const nextProcessedIds = [...state.processedActionIds.slice(-200), action.actionId];
  let nextState: TournamentState = {
    ...state,
    processedActionIds: nextProcessedIds,
    version: state.version + 1,
  };

  switch (action.type) {
    case 'UPDATE_TOURNAMENT_META': {
      const { title, seasonSubtitle, date, venue, logoDataUrl, organizerPin, defaultOvers } =
        action.payload;
      return {
        ...nextState,
        title: title !== undefined ? title : nextState.title,
        seasonSubtitle: seasonSubtitle !== undefined ? seasonSubtitle : nextState.seasonSubtitle,
        date: date !== undefined ? date : nextState.date,
        venue: venue !== undefined ? venue : nextState.venue,
        logoDataUrl: logoDataUrl !== undefined ? logoDataUrl : nextState.logoDataUrl,
        organizerPin: organizerPin !== undefined ? organizerPin : nextState.organizerPin,
        defaultOvers: defaultOvers !== undefined ? defaultOvers : nextState.defaultOvers,
      };
    }

    case 'UPDATE_TEAM': {
      const { teamId, name, shortName, captainName, captainRole } = action.payload;
      const updatedTeams = nextState.teams.map((t) =>
        t.id === teamId ? { ...t, name, shortName, captainName } : t
      );
      const targetTeam = nextState.teams.find((t) => t.id === teamId);
      const updatedPlayers = nextState.players.map((p) =>
        p.id === targetTeam?.captainId
          ? { ...p, name: captainName, role: captainRole || p.role }
          : p
      );
      return {
        ...nextState,
        teams: updatedTeams,
        players: updatedPlayers,
      };
    }

    case 'UPDATE_PLAYER': {
      const { playerId, name, role, group } = action.payload;
      const targetPlayer = nextState.players.find((p) => p.id === playerId);
      const updatedPlayers = nextState.players.map((p) =>
        p.id === playerId
          ? { ...p, name, role, group: group !== undefined ? group : p.group }
          : p
      );
      let updatedTeams = nextState.teams;
      if (targetPlayer?.group === 'CAPTAIN') {
        updatedTeams = nextState.teams.map((t) =>
          t.captainId === playerId ? { ...t, captainName: name } : t
        );
      }
      return {
        ...nextState,
        teams: updatedTeams,
        players: updatedPlayers,
      };
    }

    case 'BULK_UPDATE_GROUP_PLAYERS': {
      const { players: patchPlayers, teams: patchTeams } = action.payload;
      const patchMap = new Map(patchPlayers.map((p) => [p.id, p]));
      let updatedPlayers = nextState.players.map((p) => {
        const found = patchMap.get(p.id);
        if (!found) return p;
        return {
          ...p,
          name: found.name,
          role: found.role,
          group: found.group,
        };
      });

      let updatedTeams = nextState.teams;
      if (patchTeams) {
        const teamMap = new Map(patchTeams.map((t) => [t.id, t]));
        updatedTeams = nextState.teams.map((t) => {
          const found = teamMap.get(t.id);
          if (!found) return t;
          return {
            ...t,
            name: found.name,
            shortName: found.shortName,
            captainName: found.captainName,
          };
        });
        // Sync captain names to player pool
        updatedPlayers = updatedPlayers.map((p) => {
          if (p.group === 'CAPTAIN') {
            const matchingTeam = updatedTeams.find((t) => t.captainId === p.id);
            if (matchingTeam) {
              return { ...p, name: matchingTeam.captainName };
            }
          }
          return p;
        });
      }

      return {
        ...nextState,
        teams: updatedTeams,
        players: updatedPlayers,
      };
    }

    case 'START_GROUP_SHUFFLE': {
      const { group, assignments } = action.payload;
      // Clear previous assignment for this group until revealed or assign with revealOrder
      const updatedGroups = {
        ...nextState.draft.groups,
        [group]: {
          ...nextState.draft.groups[group],
          status: 'revealing' as const,
          revealStep: 0 as const,
          assignments,
          shuffledAt: action.timestamp,
        },
      };

      const updatedPlayers = nextState.players.map((p) =>
        p.group === group ? { ...p, assignedTeamId: null, revealOrder: undefined } : p
      );

      return {
        ...nextState,
        players: updatedPlayers,
        draft: {
          ...nextState.draft,
          activeGroup: group,
          groups: updatedGroups,
          lastUpdated: action.timestamp,
        },
      };
    }

    case 'ADVANCE_GROUP_REVEAL': {
      const { group, step } = action.payload;
      const groupState = nextState.draft.groups[group];
      if (!groupState) return nextState;

      const teamOrder = ['team-1', 'team-2', 'team-3'];
      const targetTeamId = teamOrder[step - 1];
      const assignedPlayerId = groupState.assignments[targetTeamId];

      const updatedPlayers = nextState.players.map((p) => {
        if (p.id === assignedPlayerId) {
          return {
            ...p,
            assignedTeamId: targetTeamId,
            revealOrder: step,
          };
        }
        return p;
      });

      const updatedGroups = {
        ...nextState.draft.groups,
        [group]: {
          ...groupState,
          status: step === 3 ? ('completed' as const) : ('revealing' as const),
          revealStep: step,
        },
      };

      let notifications = nextState.notifications;
      const revealedPlayer = nextState.players.find((p) => p.id === assignedPlayerId);
      const revealedTeam = nextState.teams.find((t) => t.id === targetTeamId);

      if (revealedPlayer && revealedTeam) {
        if (step === 3) {
          const summaryParts = teamOrder.map((tId) => {
            const tObj = nextState.teams.find((t) => t.id === tId);
            const pObj = updatedPlayers.find((p) => p.id === groupState.assignments[tId]);
            return `${tObj?.name || tId}: ${pObj?.name || 'Player'}`;
          });
          notifications = pushNotification(
            notifications,
            {
              type: 'DRAFT',
              title: `Group ${group} Shuffle Complete!`,
              message: summaryParts.join(' · '),
              timestamp: action.timestamp,
            },
            `${action.actionId}-draft-${group}-${step}`
          );
        } else {
          notifications = pushNotification(
            notifications,
            {
              type: 'DRAFT',
              title: `Group ${group} Pick · ${revealedPlayer.name}`,
              message: `${revealedPlayer.name} (${revealedPlayer.role}) drafted to ${revealedTeam.name}!`,
              timestamp: action.timestamp,
            },
            `${action.actionId}-draft-${group}-${step}`
          );
        }
      }

      return {
        ...nextState,
        players: updatedPlayers,
        draft: {
          ...nextState.draft,
          activeGroup: nextState.draft.activeGroup,
          groups: updatedGroups,
          lastUpdated: action.timestamp,
        },
        notifications,
      };
    }

    case 'COMPLETE_GROUP_SHUFFLE': {
      const { group } = action.payload;
      const groupState = nextState.draft.groups[group];
      if (!groupState) return nextState;

      const teamOrder: ('team-1' | 'team-2' | 'team-3')[] = ['team-1', 'team-2', 'team-3'];
      const updatedPlayers = nextState.players.map((p) => {
        if (p.group !== group) return p;
        const foundTeamIdx = teamOrder.findIndex((tId) => groupState.assignments[tId] === p.id);
        if (foundTeamIdx !== -1) {
          return {
            ...p,
            assignedTeamId: teamOrder[foundTeamIdx],
            revealOrder: (foundTeamIdx + 1) as 1 | 2 | 3,
          };
        }
        return p;
      });

      const updatedGroups = {
        ...nextState.draft.groups,
        [group]: {
          ...groupState,
          status: 'completed' as const,
          revealStep: 3 as const,
        },
      };

      let notifications = nextState.notifications;
      if (groupState.status !== 'completed') {
        const summaryParts = teamOrder.map((tId) => {
          const tObj = nextState.teams.find((t) => t.id === tId);
          const pObj = updatedPlayers.find((p) => p.id === groupState.assignments[tId]);
          return `${tObj?.name || tId}: ${pObj?.name || 'Player'}`;
        });
        notifications = pushNotification(
          notifications,
          {
            type: 'DRAFT',
            title: `Group ${group} Shuffle Complete!`,
            message: summaryParts.join(' · '),
            timestamp: action.timestamp,
          },
          `${action.actionId}-draft-complete-${group}`
        );
      }

      return {
        ...nextState,
        players: updatedPlayers,
        draft: {
          ...nextState.draft,
          activeGroup:
            nextState.draft.activeGroup === group ? null : nextState.draft.activeGroup,
          groups: updatedGroups,
          lastUpdated: action.timestamp,
        },
        notifications,
      };
    }

    case 'RESET_GROUP_SHUFFLE': {
      const { group } = action.payload;
      const updatedPlayers = nextState.players.map((p) =>
        p.group === group ? { ...p, assignedTeamId: null, revealOrder: undefined } : p
      );
      const updatedGroups = {
        ...nextState.draft.groups,
        [group]: {
          group,
          label: GROUP_DESCRIPTIONS[group],
          status: 'pending' as const,
          revealStep: 0 as const,
          assignments: {},
        },
      };
      return {
        ...nextState,
        players: updatedPlayers,
        draft: {
          ...nextState.draft,
          activeGroup:
            nextState.draft.activeGroup === group ? null : nextState.draft.activeGroup,
          groups: updatedGroups,
          lastUpdated: action.timestamp,
        },
      };
    }

    case 'RESET_ALL_DRAFT': {
      const updatedPlayers = nextState.players.map((p) =>
        p.group === 'CAPTAIN' ? p : { ...p, assignedTeamId: null, revealOrder: undefined }
      );
      const resetGroups = {} as Record<GroupKey, typeof nextState.draft.groups.A>;
      for (const g of ALL_GROUPS) {
        resetGroups[g] = {
          group: g,
          label: GROUP_DESCRIPTIONS[g],
          status: 'pending',
          revealStep: 0,
          assignments: {},
        };
      }
      const notifications = pushNotification(
        nextState.notifications,
        {
          type: 'INFO',
          title: 'Draft Reset by Organizer',
          message: 'All 7 groups (A–G) have been reset to pending for a fresh live shuffle.',
          timestamp: action.timestamp,
        },
        `${action.actionId}-draft-reset`
      );
      return {
        ...nextState,
        players: updatedPlayers,
        draft: {
          activeGroup: null,
          groups: resetGroups,
          lastUpdated: action.timestamp,
        },
        notifications,
      };
    }

    case 'SET_ACTIVE_MATCH': {
      return {
        ...nextState,
        activeMatchId: action.payload.matchId,
      };
    }

    case 'START_OR_CONFIGURE_MATCH': {
      const {
        matchId,
        oversLimit,
        tossWinnerId,
        tossDecision,
        strikerId,
        nonStrikerId,
        bowlerId,
        teamAId,
        teamBId,
      } = action.payload;

      const updatedMatches = nextState.matches.map((m) => {
        if (m.id !== matchId) return m;
        const effectiveTeamA = teamAId || m.teamAId;
        const effectiveTeamB = teamBId || m.teamBId;
        const battingFirstId =
          tossDecision === 'Bat'
            ? tossWinnerId
            : tossWinnerId === effectiveTeamA
            ? effectiveTeamB
            : effectiveTeamA;
        const bowlingFirstId =
          battingFirstId === effectiveTeamA ? effectiveTeamB : effectiveTeamA;

        const isReset = m.innings1.ballLog.length === 0;
        const inn1: InningsData = isReset
          ? createEmptyInnings(
              1,
              battingFirstId,
              bowlingFirstId,
              strikerId,
              nonStrikerId,
              bowlerId
            )
          : {
              ...m.innings1,
              strikerId: strikerId || m.innings1.strikerId,
              nonStrikerId: nonStrikerId || m.innings1.nonStrikerId,
              currentBowlerId: bowlerId || m.innings1.currentBowlerId,
            };

        const inn2: InningsData = isReset
          ? createEmptyInnings(2, bowlingFirstId, battingFirstId)
          : m.innings2;

        return {
          ...m,
          teamAId: effectiveTeamA,
          teamBId: effectiveTeamB,
          oversLimit,
          status: 'Live' as const,
          tossWinnerId,
          tossDecision,
          innings1: inn1,
          innings2: inn2,
        };
      });

      return {
        ...nextState,
        activeMatchId: matchId,
        matches: updatedMatches,
      };
    }

    case 'UPDATE_ACTIVE_PLAYERS': {
      const { matchId, strikerId, nonStrikerId, bowlerId, swapStrike } = action.payload;
      const updatedMatches = nextState.matches.map((m) => {
        if (m.id !== matchId) return m;
        const innKey = m.currentInnings === 1 ? 'innings1' : 'innings2';
        const inn = { ...m[innKey] };
        if (swapStrike) {
          const temp = inn.strikerId;
          inn.strikerId = inn.nonStrikerId;
          inn.nonStrikerId = temp;
        } else {
          if (strikerId !== undefined) inn.strikerId = strikerId;
          if (nonStrikerId !== undefined) inn.nonStrikerId = nonStrikerId;
          if (bowlerId !== undefined) inn.currentBowlerId = bowlerId;
        }
        return { ...m, [innKey]: inn };
      });
      return { ...nextState, matches: updatedMatches };
    }

    case 'RECORD_BALL': {
      const {
        matchId,
        runsOffBat,
        extraType,
        extraRuns,
        isWicket,
        wicketType,
        dismissedPlayerId,
        fielderName,
        nextBatterId,
        customCommentary,
      } = action.payload;

      const targetMatch = nextState.matches.find((m) => m.id === matchId);
      if (!targetMatch) return nextState;

      const innKey = targetMatch.currentInnings === 1 ? 'innings1' : 'innings2';
      const inn = { ...targetMatch[innKey] };
      if (inn.completed) return nextState;

      const isLegalDelivery = extraType !== 'WD' && extraType !== 'NB';
      const nextLegalBalls = isLegalDelivery ? inn.legalBalls + 1 : inn.legalBalls;
      const overNumber = Math.floor(inn.legalBalls / 6);
      const ballInOver = isLegalDelivery ? (inn.legalBalls % 6) + 1 : (inn.legalBalls % 6) + 1;
      const overBallLabel = `${overNumber}.${ballInOver}`;

      const totalRuns = runsOffBat + extraRuns;
      const striker = nextState.players.find((p) => p.id === inn.strikerId);
      const bowler = nextState.players.find((p) => p.id === inn.currentBowlerId);
      const batTeam = nextState.teams.find((t) => t.id === inn.battingTeamId);

      // Generate rich commentary if custom not provided
      let autoCommentary = `${overBallLabel} ${bowler?.name || 'Bowler'} to ${striker?.name || 'Batter'}: `;
      if (isWicket) {
        const outPlayer =
          nextState.players.find((p) => p.id === (dismissedPlayerId || inn.strikerId))?.name ||
          striker?.name ||
          'Batter';
        autoCommentary += `OUT! ${wicketType || 'Bowled'}${fielderName ? ` (c/run out ${fielderName})` : ''}! ${outPlayer} departs.`;
      } else if (extraType === 'WD') {
        autoCommentary += `Wide ball (+${totalRuns} run${totalRuns > 1 ? 's' : ''}).`;
      } else if (extraType === 'NB') {
        autoCommentary += `No Ball! ${runsOffBat > 0 ? `${runsOffBat} off the bat, ` : ''}+${totalRuns} total.`;
      } else if (runsOffBat === 6) {
        autoCommentary += `SIX! Towering strike clears the ropes effortlessly!`;
      } else if (runsOffBat === 4) {
        autoCommentary += `FOUR! Timed to perfection, races across the turf to the boundary!`;
      } else if (totalRuns === 0) {
        autoCommentary += `Dot ball, tight line and length.`;
      } else {
        autoCommentary += `${totalRuns} run${totalRuns > 1 ? 's' : ''}, smartly rotated into the gap.`;
      }

      const ballEvent: BallEvent = {
        id: `ball-${action.actionId}`,
        inningsNumber: targetMatch.currentInnings,
        overNumber,
        ballInOver,
        overBallLabel,
        strikerId: inn.strikerId,
        nonStrikerId: inn.nonStrikerId,
        bowlerId: inn.currentBowlerId,
        runsOffBat,
        extraType,
        extraRuns,
        totalRuns,
        isLegalDelivery,
        isWicket,
        wicketType,
        dismissedPlayerId: isWicket ? dismissedPlayerId || inn.strikerId : undefined,
        fielderName,
        commentary: customCommentary?.trim()
          ? `${overBallLabel} ${customCommentary.trim()}`
          : autoCommentary,
        timestamp: action.timestamp,
      };

      const updatedExtras = { ...inn.extras };
      if (extraType === 'WD') updatedExtras.wides += extraRuns;
      if (extraType === 'NB') updatedExtras.noBalls += extraRuns;
      if (extraType === 'BYE') updatedExtras.byes += extraRuns;
      if (extraType === 'LB') updatedExtras.legByes += extraRuns;

      let nextStriker = inn.strikerId;
      let nextNonStriker = inn.nonStrikerId;

      if (isWicket && nextBatterId) {
        if (dismissedPlayerId === inn.nonStrikerId) {
          nextNonStriker = nextBatterId;
        } else {
          nextStriker = nextBatterId;
        }
      }

      // Rotate strike on odd physical runs ran
      const physicalRunsRan =
        extraType === 'WD' ? Math.max(0, extraRuns - 1) : runsOffBat + (extraType === 'BYE' || extraType === 'LB' ? extraRuns : 0);
      if (physicalRunsRan % 2 === 1) {
        const tmp = nextStriker;
        nextStriker = nextNonStriker;
        nextNonStriker = tmp;
      }

      // Rotate strike at end of legal over
      if (isLegalDelivery && nextLegalBalls % 6 === 0) {
        const tmp = nextStriker;
        nextStriker = nextNonStriker;
        nextNonStriker = tmp;
      }

      const updatedInn: InningsData = {
        ...inn,
        runs: inn.runs + totalRuns,
        wickets: isWicket ? inn.wickets + 1 : inn.wickets,
        legalBalls: nextLegalBalls,
        extras: updatedExtras,
        strikerId: nextStriker,
        nonStrikerId: nextNonStriker,
        ballLog: [...inn.ballLog, ballEvent],
      };

      let notifications = nextState.notifications;
      const scoreStr = `${batTeam?.shortName || 'Team'} ${updatedInn.runs}/${updatedInn.wickets} (${formatOvers(updatedInn.legalBalls)} ov)`;

      // Check batter 30+ / 50+ milestone first
      const prevBatterRuns = inn.ballLog
        .filter((b) => b.strikerId === inn.strikerId)
        .reduce((acc, b) => acc + b.runsOffBat, 0);
      const newBatterRuns = prevBatterRuns + runsOffBat;
      if (prevBatterRuns < 30 && newBatterRuns >= 30 && prevBatterRuns < 50) {
        notifications = pushNotification(
          notifications,
          {
            type: 'MILESTONE',
            title: `30+ Milestone · ${striker?.name || 'Batter'} (${newBatterRuns}*)`,
            message: `Crucial knock underway for ${batTeam?.name || 'their team'}!`,
            timestamp: action.timestamp,
            matchId,
          },
          `${action.actionId}-milestone-30`
        );
      } else if (prevBatterRuns < 50 && newBatterRuns >= 50) {
        notifications = pushNotification(
          notifications,
          {
            type: 'MILESTONE',
            title: `HALF-CENTURY! ${striker?.name || 'Batter'} reaches ${newBatterRuns}*`,
            message: `Sensational 50 in SGHS-23 Season 2! ${scoreStr}`,
            timestamp: action.timestamp,
            matchId,
          },
          `${action.actionId}-milestone-50`
        );
      }

      const draftMatch: Match = {
        ...targetMatch,
        status: 'Live',
        [innKey]: updatedInn,
      };

      const { updatedMatch, notifications: afterMatchNotifications } = finalizeMatchIfCompleted(
        draftMatch,
        { ...nextState, notifications },
        action.actionId,
        action.timestamp
      );

      let finalNotifications = afterMatchNotifications;

      // Push WICKET, SIX, or FOUR last so it is ALWAYS at finalNotifications[0]
      if (isWicket) {
        const outPlayerName =
          nextState.players.find((p) => p.id === (dismissedPlayerId || inn.strikerId))?.name ||
          striker?.name ||
          'Batter';
        finalNotifications = pushNotification(
          finalNotifications,
          {
            type: 'WICKET',
            title: `WICKET! ${bowler?.name || 'Bowler'} dismisses ${outPlayerName} (${wicketType || 'Out'})`,
            message: `${ballEvent.commentary} · ${scoreStr}`,
            timestamp: action.timestamp,
            matchId,
          },
          `${action.actionId}-wicket`
        );
      } else if (runsOffBat === 6 || (extraType !== 'NONE' && totalRuns >= 6)) {
        finalNotifications = pushNotification(
          finalNotifications,
          {
            type: 'SIX',
            title: `SIX! ${striker?.name || 'Batter'} launches a maximum!`,
            message: `${ballEvent.commentary} · ${scoreStr}`,
            timestamp: action.timestamp,
            matchId,
          },
          `${action.actionId}-six`
        );
      } else if (runsOffBat === 4 || (extraType !== 'NONE' && totalRuns === 4)) {
        finalNotifications = pushNotification(
          finalNotifications,
          {
            type: 'FOUR',
            title: `FOUR! Boundary by ${striker?.name || 'Batter'}`,
            message: `${ballEvent.commentary} · ${scoreStr}`,
            timestamp: action.timestamp,
            matchId,
          },
          `${action.actionId}-four`
        );
      }

      return {
        ...nextState,
        matches: nextState.matches.map((m) => (m.id === matchId ? updatedMatch : m)),
        notifications: finalNotifications,
      };
    }

    case 'UNDO_LAST_BALL': {
      const { matchId } = action.payload;
      const targetMatch = nextState.matches.find((m) => m.id === matchId);
      if (!targetMatch) return nextState;

      const innKey = targetMatch.currentInnings === 1 ? 'innings1' : 'innings2';
      const inn = targetMatch[innKey];
      if (inn.ballLog.length === 0) return nextState;

      const remainingBalls = inn.ballLog.slice(0, -1);
      const lastBall = inn.ballLog[inn.ballLog.length - 1];

      const runs = remainingBalls.reduce((sum, b) => sum + b.totalRuns, 0);
      const wickets = remainingBalls.filter((b) => b.isWicket).length;
      const legalBalls = remainingBalls.filter((b) => b.isLegalDelivery).length;
      const extras = {
        wides: remainingBalls
          .filter((b) => b.extraType === 'WD')
          .reduce((s, b) => s + b.extraRuns, 0),
        noBalls: remainingBalls
          .filter((b) => b.extraType === 'NB')
          .reduce((s, b) => s + b.extraRuns, 0),
        byes: remainingBalls
          .filter((b) => b.extraType === 'BYE')
          .reduce((s, b) => s + b.extraRuns, 0),
        legByes: remainingBalls
          .filter((b) => b.extraType === 'LB')
          .reduce((s, b) => s + b.extraRuns, 0),
      };

      const updatedInn: InningsData = {
        ...inn,
        runs,
        wickets,
        legalBalls,
        extras,
        strikerId: lastBall.strikerId,
        nonStrikerId: lastBall.nonStrikerId,
        currentBowlerId: lastBall.bowlerId,
        ballLog: remainingBalls,
        completed: false,
      };

      return {
        ...nextState,
        matches: nextState.matches.map((m) =>
          m.id === matchId
            ? {
                ...m,
                status: 'Live',
                winnerTeamId: undefined,
                resultSummary: undefined,
                [innKey]: updatedInn,
              }
            : m
        ),
      };
    }

    case 'START_SECOND_INNINGS': {
      const { matchId, strikerId, nonStrikerId, bowlerId } = action.payload;
      const updatedMatches = nextState.matches.map((m) => {
        if (m.id !== matchId) return m;
        return {
          ...m,
          status: 'Live' as const,
          currentInnings: 2 as const,
          innings1: {
            ...m.innings1,
            completed: true,
          },
          innings2: {
            ...m.innings2,
            battingTeamId: m.innings1.bowlingTeamId,
            bowlingTeamId: m.innings1.battingTeamId,
            strikerId,
            nonStrikerId,
            currentBowlerId: bowlerId,
          },
        };
      });

      return {
        ...nextState,
        matches: updatedMatches,
      };
    }

    case 'COMPLETE_MATCH': {
      const { matchId } = action.payload;
      const targetMatch = nextState.matches.find((m) => m.id === matchId);
      if (!targetMatch) return nextState;

      const inn1 = targetMatch.innings1;
      const inn2 = targetMatch.innings2;
      const team1 = nextState.teams.find((t) => t.id === inn1.battingTeamId);
      const team2 = nextState.teams.find((t) => t.id === inn2.battingTeamId);

      let winnerTeamId: string | 'TIE' = 'TIE';
      let resultSummary = 'Match Completed';

      if (inn2.runs > inn1.runs) {
        winnerTeamId = inn2.battingTeamId;
        const wktsLeft = Math.max(1, 7 - inn2.wickets);
        resultSummary = `${team2?.name || 'Team 2'} won by ${wktsLeft} wicket${wktsLeft > 1 ? 's' : ''}`;
      } else if (inn1.runs > inn2.runs) {
        winnerTeamId = inn1.battingTeamId;
        const diff = inn1.runs - inn2.runs;
        resultSummary = `${team1?.name || 'Team 1'} won by ${diff} run${diff > 1 ? 's' : ''}`;
      } else {
        winnerTeamId = 'TIE';
        resultSummary = 'Match Tied!';
      }

      const notifications = pushNotification(
        nextState.notifications,
        {
          type: 'MATCH_RESULT',
          title: `Official Result · ${targetMatch.title}`,
          message: resultSummary,
          timestamp: action.timestamp,
          matchId,
        },
        `${action.actionId}-complete-match`
      );

      return {
        ...nextState,
        matches: nextState.matches.map((m) =>
          m.id === matchId
            ? {
                ...m,
                status: 'Completed',
                winnerTeamId,
                resultSummary,
                innings1: { ...m.innings1, completed: true },
                innings2: { ...m.innings2, completed: true },
              }
            : m
        ),
        notifications,
      };
    }

    case 'SEED_FINAL_MATCH': {
      const { teamAId, teamBId, oversLimit } = action.payload;
      const teamAPlayers = nextState.players.filter((p) => p.assignedTeamId === teamAId);
      const teamBPlayers = nextState.players.filter((p) => p.assignedTeamId === teamBId);

      const updatedMatches = nextState.matches.map((m) => {
        if (m.stage !== 'Final') return m;
        return {
          ...m,
          teamAId,
          teamBId,
          oversLimit: oversLimit || m.oversLimit,
          innings1: createEmptyInnings(
            1,
            teamAId,
            teamBId,
            teamAPlayers[0]?.id || '',
            teamAPlayers[1]?.id || '',
            teamBPlayers[0]?.id || ''
          ),
          innings2: createEmptyInnings(
            2,
            teamBId,
            teamAId,
            teamBPlayers[0]?.id || '',
            teamBPlayers[1]?.id || '',
            teamAPlayers[0]?.id || ''
          ),
        };
      });

      return {
        ...nextState,
        matches: updatedMatches,
      };
    }

    case 'CLEAR_NOTIFICATIONS': {
      return {
        ...nextState,
        notifications: [],
      };
    }

    default:
      return nextState;
  }
}

export interface PlayerAggregatedStats {
  playerId: string;
  name: string;
  group: string;
  role: string;
  teamId: string | null;
  teamName: string;
  teamShortName: string;
  matchesPlayed: number;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  dismissals: number;
  highestScore: number;
  strikeRate: number;
  battingAverage: number;
  ballsBowled: number;
  runsConceded: number;
  wickets: number;
  economy: number;
  mvpPoints: number;
}

export function computeAllPlayerStats(state: TournamentState): PlayerAggregatedStats[] {
  const statsMap = new Map<string, PlayerAggregatedStats>();

  for (const p of state.players) {
    const team = state.teams.find((t) => t.id === p.assignedTeamId);
    statsMap.set(p.id, {
      playerId: p.id,
      name: p.name,
      group: p.group,
      role: p.role,
      teamId: p.assignedTeamId,
      teamName: team?.name || 'Unassigned Pool',
      teamShortName: team?.shortName || 'POOL',
      matchesPlayed: 0,
      runs: 0,
      ballsFaced: 0,
      fours: 0,
      sixes: 0,
      dismissals: 0,
      highestScore: 0,
      strikeRate: 0,
      battingAverage: 0,
      ballsBowled: 0,
      runsConceded: 0,
      wickets: 0,
      economy: 0,
      mvpPoints: 0,
    });
  }

  for (const match of state.matches) {
    const participantsInMatch = new Set<string>();
    const matchBatRuns = new Map<string, number>();

    for (const inn of [match.innings1, match.innings2]) {
      for (const ball of inn.ballLog) {
        participantsInMatch.add(ball.strikerId);
        participantsInMatch.add(ball.nonStrikerId);
        participantsInMatch.add(ball.bowlerId);

        // Batter stats
        const batterStat = statsMap.get(ball.strikerId);
        if (batterStat) {
          if (ball.extraType !== 'WD') {
            batterStat.ballsFaced += 1;
          }
          batterStat.runs += ball.runsOffBat;
          if (ball.runsOffBat === 4) batterStat.fours += 1;
          if (ball.runsOffBat === 6) batterStat.sixes += 1;
          matchBatRuns.set(
            ball.strikerId,
            (matchBatRuns.get(ball.strikerId) || 0) + ball.runsOffBat
          );
        }

        if (ball.isWicket) {
          const outId = ball.dismissedPlayerId || ball.strikerId;
          const outStat = statsMap.get(outId);
          if (outStat) {
            outStat.dismissals += 1;
          }
        }

        // Bowler stats
        const bowlerStat = statsMap.get(ball.bowlerId);
        if (bowlerStat) {
          if (ball.isLegalDelivery) {
            bowlerStat.ballsBowled += 1;
          }
          const bowlerChargedRuns =
            ball.extraType === 'BYE' || ball.extraType === 'LB' ? 0 : ball.totalRuns;
          bowlerStat.runsConceded += bowlerChargedRuns;
          if (ball.isWicket && ball.wicketType !== 'Run Out') {
            bowlerStat.wickets += 1;
          }
        }
      }
    }

    for (const [pId, mRuns] of matchBatRuns.entries()) {
      const st = statsMap.get(pId);
      if (st && mRuns > st.highestScore) {
        st.highestScore = mRuns;
      }
    }

    for (const pId of participantsInMatch) {
      const st = statsMap.get(pId);
      if (st) {
        st.matchesPlayed += 1;
      }
    }
  }

  const results: PlayerAggregatedStats[] = [];
  for (const st of statsMap.values()) {
    st.strikeRate = st.ballsFaced > 0 ? Number(((st.runs / st.ballsFaced) * 100).toFixed(1)) : 0;
    st.battingAverage =
      st.dismissals > 0 ? Number((st.runs / st.dismissals).toFixed(1)) : st.runs;
    st.economy =
      st.ballsBowled > 0 ? Number(((st.runsConceded / st.ballsBowled) * 6).toFixed(2)) : 0;
    // Impact MVP formula: 1 pt per run + 2 bonus per 4 + 3 bonus per 6 + 20 pts per wicket
    st.mvpPoints = st.runs + st.fours * 2 + st.sixes * 3 + st.wickets * 20;
    results.push(st);
  }

  return results;
}

export interface TeamStanding {
  teamId: string;
  teamName: string;
  shortName: string;
  accentHex: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  points: number;
  runsScored: number;
  oversFaced: number;
  runsConceded: number;
  oversBowled: number;
  nrr: number;
}

export function computeTeamStandings(state: TournamentState): TeamStanding[] {
  const map = new Map<string, TeamStanding>();
  for (const t of state.teams) {
    map.set(t.id, {
      teamId: t.id,
      teamName: t.name,
      shortName: t.shortName,
      accentHex: t.accentHex,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      points: 0,
      runsScored: 0,
      oversFaced: 0,
      runsConceded: 0,
      oversBowled: 0,
      nrr: 0,
    });
  }

  const leagueMatches = state.matches.filter((m) => m.stage === 'League');
  for (const m of leagueMatches) {
    const hasStarted = m.innings1.ballLog.length > 0 || m.innings2.ballLog.length > 0;
    if (!hasStarted) continue;

    for (const inn of [m.innings1, m.innings2]) {
      if (inn.ballLog.length === 0) continue;
      const bat = map.get(inn.battingTeamId);
      const bowl = map.get(inn.bowlingTeamId);
      // If a team is bowled out (7 wickets in 8-player squad), NRR uses full quota of overs
      const effectiveOvers =
        inn.wickets >= 7 ? m.oversLimit : inn.legalBalls / 6;

      if (bat) {
        bat.runsScored += inn.runs;
        bat.oversFaced += effectiveOvers;
      }
      if (bowl) {
        bowl.runsConceded += inn.runs;
        bowl.oversBowled += effectiveOvers;
      }
    }

    if (m.status === 'Completed') {
      const tA = map.get(m.teamAId);
      const tB = map.get(m.teamBId);
      if (tA) tA.played += 1;
      if (tB) tB.played += 1;

      if (m.winnerTeamId === 'TIE') {
        if (tA) {
          tA.tied += 1;
          tA.points += 1;
        }
        if (tB) {
          tB.tied += 1;
          tB.points += 1;
        }
      } else if (m.winnerTeamId === m.teamAId) {
        if (tA) {
          tA.won += 1;
          tA.points += 2;
        }
        if (tB) tB.lost += 1;
      } else if (m.winnerTeamId === m.teamBId) {
        if (tB) {
          tB.won += 1;
          tB.points += 2;
        }
        if (tA) tA.lost += 1;
      }
    }
  }

  const list = Array.from(map.values()).map((st) => {
    const forRate = st.oversFaced > 0 ? st.runsScored / st.oversFaced : 0;
    const againstRate = st.oversBowled > 0 ? st.runsConceded / st.oversBowled : 0;
    st.nrr = Number((forRate - againstRate).toFixed(3));
    return st;
  });

  return list.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.nrr - a.nrr;
  });
}
