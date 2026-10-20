export type GroupKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export const ALL_GROUPS: GroupKey[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

export type PlayerRole = 'Batter' | 'Bowler' | 'All-Rounder' | 'WK';

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  group: 'CAPTAIN' | GroupKey;
  assignedTeamId: string | null;
  revealOrder?: 1 | 2 | 3;
  battingStyle?: string;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  captainId: string;
  captainName: string;
  colorName: string;
  accentHex: string;
}

export interface DraftGroupState {
  group: GroupKey;
  label: string;
  status: 'pending' | 'revealing' | 'completed';
  revealStep: 0 | 1 | 2 | 3; // 0 = shuffling/ready, 1 = Team 1 card revealed, 2 = Team 1&2, 3 = All 3 revealed
  assignments: Record<string, string>; // teamId -> playerId
  shuffledAt?: string;
}

export type ExtraType = 'NONE' | 'WD' | 'NB' | 'BYE' | 'LB';

export type WicketType = 'Bowled' | 'Caught' | 'LBW' | 'Run Out' | 'Stumped' | 'Hit Wicket';

export interface BallEvent {
  id: string;
  inningsNumber: 1 | 2;
  overNumber: number; // 0-indexed over
  ballInOver: number; // 1..6 legal ball count
  overBallLabel: string; // e.g. "0.1", "3.4"
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  runsOffBat: number;
  extraType: ExtraType;
  extraRuns: number;
  totalRuns: number;
  isLegalDelivery: boolean;
  isWicket: boolean;
  wicketType?: WicketType;
  dismissedPlayerId?: string;
  fielderName?: string;
  commentary: string;
  timestamp: string;
}

export interface InningsData {
  inningsNumber: 1 | 2;
  battingTeamId: string;
  bowlingTeamId: string;
  runs: number;
  wickets: number;
  legalBalls: number;
  extras: {
    wides: number;
    noBalls: number;
    byes: number;
    legByes: number;
  };
  strikerId: string;
  nonStrikerId: string;
  currentBowlerId: string;
  ballLog: BallEvent[];
  completed: boolean;
}

export interface Match {
  id: string;
  matchNumber: number;
  title: string;
  stage: 'League' | 'Final';
  venue: string;
  scheduledTime: string;
  teamAId: string;
  teamBId: string;
  oversLimit: number;
  status: 'Upcoming' | 'Live' | 'Completed';
  tossWinnerId?: string;
  tossDecision?: 'Bat' | 'Bowl';
  currentInnings: 1 | 2;
  innings1: InningsData;
  innings2: InningsData;
  winnerTeamId?: string | 'TIE';
  resultSummary?: string;
}

export type NotificationCategory =
  | 'DRAFT'
  | 'FOUR'
  | 'SIX'
  | 'WICKET'
  | 'MILESTONE'
  | 'MATCH_RESULT'
  | 'INFO';

export interface TournamentNotification {
  id: string;
  type: NotificationCategory;
  title: string;
  message: string;
  timestamp: string;
  matchId?: string;
}

export interface TournamentState {
  sessionId: string;
  title: string;
  seasonSubtitle: string;
  date: string;
  venue: string;
  logoDataUrl: string | null;
  organizerPin: string;
  defaultOvers: number;
  teams: Team[];
  players: Player[];
  draft: {
    activeGroup: GroupKey | null;
    groups: Record<GroupKey, DraftGroupState>;
    lastUpdated: string;
  };
  matches: Match[];
  activeMatchId: string;
  notifications: TournamentNotification[];
  processedActionIds: string[];
  version: number;
}

export type TournamentAction =
  | {
      actionId: string;
      timestamp: string;
      type: 'UPDATE_TOURNAMENT_META';
      payload: {
        title?: string;
        seasonSubtitle?: string;
        date?: string;
        venue?: string;
        logoDataUrl?: string | null;
        organizerPin?: string;
        defaultOvers?: number;
      };
    }
  | {
      actionId: string;
      timestamp: string;
      type: 'UPDATE_TEAM';
      payload: {
        teamId: string;
        name: string;
        shortName: string;
        captainName: string;
        captainRole?: PlayerRole;
      };
    }
  | {
      actionId: string;
      timestamp: string;
      type: 'UPDATE_PLAYER';
      payload: {
        playerId: string;
        name: string;
        role: PlayerRole;
        group?: 'CAPTAIN' | GroupKey;
      };
    }
  | {
      actionId: string;
      timestamp: string;
      type: 'BULK_UPDATE_GROUP_PLAYERS';
      payload: {
        players: { id: string; name: string; role: PlayerRole; group: 'CAPTAIN' | GroupKey }[];
        teams?: { id: string; name: string; shortName: string; captainName: string }[];
      };
    }
  | {
      actionId: string;
      timestamp: string;
      type: 'START_GROUP_SHUFFLE';
      payload: {
        group: GroupKey;
        assignments: Record<string, string>; // teamId -> playerId
      };
    }
  | {
      actionId: string;
      timestamp: string;
      type: 'ADVANCE_GROUP_REVEAL';
      payload: {
        group: GroupKey;
        step: 1 | 2 | 3;
      };
    }
  | {
      actionId: string;
      timestamp: string;
      type: 'COMPLETE_GROUP_SHUFFLE';
      payload: {
        group: GroupKey;
      };
    }
  | {
      actionId: string;
      timestamp: string;
      type: 'RESET_GROUP_SHUFFLE';
      payload: {
        group: GroupKey;
      };
    }
  | {
      actionId: string;
      timestamp: string;
      type: 'RESET_ALL_DRAFT';
      payload: Record<string, never>;
    }
  | {
      actionId: string;
      timestamp: string;
      type: 'SET_ACTIVE_MATCH';
      payload: {
        matchId: string;
      };
    }
  | {
      actionId: string;
      timestamp: string;
      type: 'START_OR_CONFIGURE_MATCH';
      payload: {
        matchId: string;
        oversLimit: number;
        tossWinnerId: string;
        tossDecision: 'Bat' | 'Bowl';
        strikerId: string;
        nonStrikerId: string;
        bowlerId: string;
        teamAId?: string;
        teamBId?: string;
      };
    }
  | {
      actionId: string;
      timestamp: string;
      type: 'UPDATE_ACTIVE_PLAYERS';
      payload: {
        matchId: string;
        strikerId?: string;
        nonStrikerId?: string;
        bowlerId?: string;
        swapStrike?: boolean;
      };
    }
  | {
      actionId: string;
      timestamp: string;
      type: 'RECORD_BALL';
      payload: {
        matchId: string;
        runsOffBat: number;
        extraType: ExtraType;
        extraRuns: number;
        isWicket: boolean;
        wicketType?: WicketType;
        dismissedPlayerId?: string;
        fielderName?: string;
        nextBatterId?: string;
        customCommentary?: string;
      };
    }
  | {
      actionId: string;
      timestamp: string;
      type: 'UNDO_LAST_BALL';
      payload: {
        matchId: string;
      };
    }
  | {
      actionId: string;
      timestamp: string;
      type: 'START_SECOND_INNINGS';
      payload: {
        matchId: string;
        strikerId: string;
        nonStrikerId: string;
        bowlerId: string;
      };
    }
  | {
      actionId: string;
      timestamp: string;
      type: 'COMPLETE_MATCH';
      payload: {
        matchId: string;
      };
    }
  | {
      actionId: string;
      timestamp: string;
      type: 'SEED_FINAL_MATCH';
      payload: {
        teamAId: string;
        teamBId: string;
        oversLimit?: number;
      };
    }
  | {
      actionId: string;
      timestamp: string;
      type: 'CLEAR_NOTIFICATIONS';
      payload: Record<string, never>;
    };
