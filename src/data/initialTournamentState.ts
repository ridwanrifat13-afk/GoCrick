import type {
  TournamentState,
  Player,
  Team,
  GroupKey,
  DraftGroupState,
  Match,
  InningsData,
} from '../types/tournament.ts';

export const GROUP_DESCRIPTIONS: Record<GroupKey, string> = {
  A: 'Group A',
  B: 'Group B',
  C: 'Group C',
  D: 'Group D',
  E: 'Group E',
  F: 'Group F',
  G: 'Group G',
};

const initialTeams: Team[] = [
  {
    id: 'team-1',
    name: 'Team 1',
    shortName: 'TM1',
    captainId: 'cap-1',
    captainName: 'Captain 1',
    colorName: 'Emerald',
    accentHex: '#10B981',
  },
  {
    id: 'team-2',
    name: 'Team 2',
    shortName: 'TM2',
    captainId: 'cap-2',
    captainName: 'Captain 2',
    colorName: 'Amber',
    accentHex: '#F59E0B',
  },
  {
    id: 'team-3',
    name: 'Team 3',
    shortName: 'TM3',
    captainId: 'cap-3',
    captainName: 'Captain 3',
    colorName: 'Sky',
    accentHex: '#0EA5E9',
  },
];

const initialPlayers: Player[] = [
  // 3 Team Captains
  { id: 'cap-1', name: 'Captain 1', role: 'All-Rounder', group: 'CAPTAIN', assignedTeamId: 'team-1' },
  { id: 'cap-2', name: 'Captain 2', role: 'All-Rounder', group: 'CAPTAIN', assignedTeamId: 'team-2' },
  { id: 'cap-3', name: 'Captain 3', role: 'All-Rounder', group: 'CAPTAIN', assignedTeamId: 'team-3' },

  // Group A (3 Players)
  { id: 'p-a1', name: 'Group A - Player 1', role: 'All-Rounder', group: 'A', assignedTeamId: null },
  { id: 'p-a2', name: 'Group A - Player 2', role: 'All-Rounder', group: 'A', assignedTeamId: null },
  { id: 'p-a3', name: 'Group A - Player 3', role: 'All-Rounder', group: 'A', assignedTeamId: null },

  // Group B (3 Players)
  { id: 'p-b1', name: 'Group B - Player 1', role: 'Batter', group: 'B', assignedTeamId: null },
  { id: 'p-b2', name: 'Group B - Player 2', role: 'Batter', group: 'B', assignedTeamId: null },
  { id: 'p-b3', name: 'Group B - Player 3', role: 'Batter', group: 'B', assignedTeamId: null },

  // Group C (3 Players)
  { id: 'p-c1', name: 'Group C - Player 1', role: 'Bowler', group: 'C', assignedTeamId: null },
  { id: 'p-c2', name: 'Group C - Player 2', role: 'Bowler', group: 'C', assignedTeamId: null },
  { id: 'p-c3', name: 'Group C - Player 3', role: 'Bowler', group: 'C', assignedTeamId: null },

  // Group D (3 Players)
  { id: 'p-d1', name: 'Group D - Player 1', role: 'Batter', group: 'D', assignedTeamId: null },
  { id: 'p-d2', name: 'Group D - Player 2', role: 'All-Rounder', group: 'D', assignedTeamId: null },
  { id: 'p-d3', name: 'Group D - Player 3', role: 'Batter', group: 'D', assignedTeamId: null },

  // Group E (3 Players)
  { id: 'p-e1', name: 'Group E - Player 1', role: 'Bowler', group: 'E', assignedTeamId: null },
  { id: 'p-e2', name: 'Group E - Player 2', role: 'All-Rounder', group: 'E', assignedTeamId: null },
  { id: 'p-e3', name: 'Group E - Player 3', role: 'Bowler', group: 'E', assignedTeamId: null },

  // Group F (3 Players)
  { id: 'p-f1', name: 'Group F - Player 1', role: 'WK', group: 'F', assignedTeamId: null },
  { id: 'p-f2', name: 'Group F - Player 2', role: 'WK', group: 'F', assignedTeamId: null },
  { id: 'p-f3', name: 'Group F - Player 3', role: 'WK', group: 'F', assignedTeamId: null },

  // Group G (3 Players)
  { id: 'p-g1', name: 'Group G - Player 1', role: 'Batter', group: 'G', assignedTeamId: null },
  { id: 'p-g2', name: 'Group G - Player 2', role: 'Bowler', group: 'G', assignedTeamId: null },
  { id: 'p-g3', name: 'Group G - Player 3', role: 'All-Rounder', group: 'G', assignedTeamId: null },
];

const initialDraftGroups: Record<GroupKey, DraftGroupState> = {
  A: {
    group: 'A',
    label: GROUP_DESCRIPTIONS.A,
    status: 'pending',
    revealStep: 0,
    assignments: {},
  },
  B: {
    group: 'B',
    label: GROUP_DESCRIPTIONS.B,
    status: 'pending',
    revealStep: 0,
    assignments: {},
  },
  C: {
    group: 'C',
    label: GROUP_DESCRIPTIONS.C,
    status: 'pending',
    revealStep: 0,
    assignments: {},
  },
  D: {
    group: 'D',
    label: GROUP_DESCRIPTIONS.D,
    status: 'pending',
    revealStep: 0,
    assignments: {},
  },
  E: {
    group: 'E',
    label: GROUP_DESCRIPTIONS.E,
    status: 'pending',
    revealStep: 0,
    assignments: {},
  },
  F: {
    group: 'F',
    label: GROUP_DESCRIPTIONS.F,
    status: 'pending',
    revealStep: 0,
    assignments: {},
  },
  G: {
    group: 'G',
    label: GROUP_DESCRIPTIONS.G,
    status: 'pending',
    revealStep: 0,
    assignments: {},
  },
};

export function createEmptyInnings(
  inningsNumber: 1 | 2,
  battingTeamId: string,
  bowlingTeamId: string,
  strikerId = '',
  nonStrikerId = '',
  currentBowlerId = ''
): InningsData {
  return {
    inningsNumber,
    battingTeamId,
    bowlingTeamId,
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
    strikerId,
    nonStrikerId,
    currentBowlerId,
    ballLog: [],
    completed: false,
  };
}

const initialMatches: Match[] = [
  {
    id: 'match-1',
    matchNumber: 1,
    title: 'League Match 1',
    stage: 'League',
    venue: 'Tournament Ground',
    scheduledTime: '22 Oct 2026 · Match 1',
    teamAId: 'team-1',
    teamBId: 'team-2',
    oversLimit: 6,
    status: 'Upcoming',
    currentInnings: 1,
    innings1: createEmptyInnings(1, 'team-1', 'team-2', 'cap-1', '', 'cap-2'),
    innings2: createEmptyInnings(2, 'team-2', 'team-1', 'cap-2', '', 'cap-1'),
  },
  {
    id: 'match-2',
    matchNumber: 2,
    title: 'League Match 2',
    stage: 'League',
    venue: 'Tournament Ground',
    scheduledTime: '22 Oct 2026 · Match 2',
    teamAId: 'team-2',
    teamBId: 'team-3',
    oversLimit: 6,
    status: 'Upcoming',
    currentInnings: 1,
    innings1: createEmptyInnings(1, 'team-2', 'team-3', 'cap-2', '', 'cap-3'),
    innings2: createEmptyInnings(2, 'team-3', 'team-2', 'cap-3', '', 'cap-2'),
  },
  {
    id: 'match-3',
    matchNumber: 3,
    title: 'League Match 3',
    stage: 'League',
    venue: 'Tournament Ground',
    scheduledTime: '22 Oct 2026 · Match 3',
    teamAId: 'team-3',
    teamBId: 'team-1',
    oversLimit: 6,
    status: 'Upcoming',
    currentInnings: 1,
    innings1: createEmptyInnings(1, 'team-3', 'team-1', 'cap-3', '', 'cap-1'),
    innings2: createEmptyInnings(2, 'team-1', 'team-3', 'cap-1', '', 'cap-3'),
  },
  {
    id: 'match-4',
    matchNumber: 4,
    title: 'Grand Final',
    stage: 'Final',
    venue: 'Tournament Ground',
    scheduledTime: '22 Oct 2026 · Final',
    teamAId: 'team-1',
    teamBId: 'team-2',
    oversLimit: 8,
    status: 'Upcoming',
    currentInnings: 1,
    innings1: createEmptyInnings(1, 'team-1', 'team-2', 'cap-1', '', 'cap-2'),
    innings2: createEmptyInnings(2, 'team-2', 'team-1', 'cap-2', '', 'cap-1'),
  },
];

export const INITIAL_TOURNAMENT_STATE: TournamentState = {
  sessionId: 'sghs23-season2-live',
  title: 'SGHS-23 Cricket Tournament season 2',
  seasonSubtitle: '24 Players · 3 Teams · Groups A–G Live Draft & Match Center',
  date: '2026-10-22',
  venue: 'Tournament Ground',
  logoDataUrl: null,
  organizerPin: 'PROTECTED',
  defaultOvers: 6,
  teams: initialTeams,
  players: initialPlayers,
  draft: {
    activeGroup: null,
    groups: initialDraftGroups,
    lastUpdated: '2026-10-20T00:00:00.000Z',
  },
  matches: initialMatches,
  activeMatchId: 'match-1',
  notifications: [],
  processedActionIds: [],
  version: 1,
};
