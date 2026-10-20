import React, { useState } from 'react';
import {
  FileDown,
  Undo2,
  ArrowLeftRight,
  Settings2,
  CheckCircle,
  MessageSquare,
  ShieldAlert,
  Play,
  Lock,
  Award,
  AlertCircle,
  X,
} from 'lucide-react';
import {
  TournamentState,
  TournamentAction,
  ExtraType,
  WicketType,
  InningsData,
} from '../types/tournament';
import { formatOvers, calculateRunRate } from '../utils/tournamentReducer';
import { exportMatchScorecardPDF } from '../utils/pdfExporter';

interface LiveScoreboardProps {
  state: TournamentState;
  isOrganizer: boolean;
  onRequireOrganizer: () => void;
  onDispatchAction: (
    type: TournamentAction['type'],
    payload: Record<string, unknown>
  ) => void;
}

const WICKET_TYPES: WicketType[] = [
  'Bowled',
  'Caught',
  'LBW',
  'Run Out',
  'Stumped',
  'Hit Wicket',
];

export const LiveScoreboard: React.FC<LiveScoreboardProps> = ({
  state,
  isOrganizer,
  onRequireOrganizer,
  onDispatchAction,
}) => {
  const activeMatch =
    state.matches.find((m) => m.id === state.activeMatchId) || state.matches[0];

  const [selectedExtra, setSelectedExtra] = useState<ExtraType>('NONE');
  const [customCommentary, setCustomCommentary] = useState('');
  const [commentaryFilter, setCommentaryFilter] = useState<
    'ALL' | 'BOUNDARIES' | 'WICKETS'
  >('ALL');
  const [scorecardInningsTab, setScorecardInningsTab] = useState<1 | 2>(
    activeMatch.currentInnings
  );

  // Modals
  const [isWicketModalOpen, setIsWicketModalOpen] = useState(false);
  const [wicketType, setWicketType] = useState<WicketType>('Bowled');
  const [fielderName, setFielderName] = useState('');
  const [dismissedPlayerId, setDismissedPlayerId] = useState('');
  const [nextBatterId, setNextBatterId] = useState('');

  const [isMatchSetupOpen, setIsMatchSetupOpen] = useState(false);
  const [setupOvers, setSetupOvers] = useState(activeMatch.oversLimit);
  const [setupTossWinner, setSetupTossWinner] = useState(
    activeMatch.tossWinnerId || activeMatch.teamAId
  );
  const [setupTossDecision, setSetupTossDecision] = useState<'Bat' | 'Bowl'>(
    activeMatch.tossDecision || 'Bat'
  );
  const [setupStriker, setSetupStriker] = useState('');
  const [setupNonStriker, setSetupNonStriker] = useState('');
  const [setupBowler, setSetupBowler] = useState('');

  const [isSecondInningsModalOpen, setIsSecondInningsModalOpen] = useState(false);
  const [inn2Striker, setInn2Striker] = useState('');
  const [inn2NonStriker, setInn2NonStriker] = useState('');
  const [inn2Bowler, setInn2Bowler] = useState('');

  const currentInnings: InningsData =
    activeMatch.currentInnings === 1 ? activeMatch.innings1 : activeMatch.innings2;

  const battingTeam = state.teams.find((t) => t.id === currentInnings.battingTeamId);
  const bowlingTeam = state.teams.find((t) => t.id === currentInnings.bowlingTeamId);

  const battingSquad = state.players.filter(
    (p) => p.assignedTeamId === currentInnings.battingTeamId
  );
  const bowlingSquad = state.players.filter(
    (p) => p.assignedTeamId === currentInnings.bowlingTeamId
  );

  const getBatterFigures = (playerId: string, inn: InningsData) => {
    const balls = inn.ballLog.filter(
      (b) => b.strikerId === playerId && b.extraType !== 'WD'
    );
    const runs = inn.ballLog
      .filter((b) => b.strikerId === playerId)
      .reduce((s, b) => s + b.runsOffBat, 0);
    const fours = inn.ballLog.filter(
      (b) => b.strikerId === playerId && b.runsOffBat === 4
    ).length;
    const sixes = inn.ballLog.filter(
      (b) => b.strikerId === playerId && b.runsOffBat === 6
    ).length;
    const sr = balls.length > 0 ? ((runs / balls.length) * 100).toFixed(1) : '0.0';
    return { runs, balls: balls.length, fours, sixes, sr };
  };

  const getBowlerFigures = (playerId: string, inn: InningsData) => {
    const balls = inn.ballLog.filter((b) => b.bowlerId === playerId);
    const legal = balls.filter((b) => b.isLegalDelivery).length;
    const runs = balls.reduce(
      (s, b) => s + (b.extraType === 'BYE' || b.extraType === 'LB' ? 0 : b.totalRuns),
      0
    );
    const wickets = balls.filter(
      (b) => b.isWicket && b.wicketType !== 'Run Out'
    ).length;
    const econ = legal > 0 ? ((runs / legal) * 6).toFixed(2) : '0.00';
    return { overs: formatOvers(legal), runs, wickets, econ };
  };

  const handleRecordDelivery = (runsValue: number) => {
    if (!isOrganizer) {
      onRequireOrganizer();
      return;
    }

    let runsOffBat = runsValue;
    let extraRuns = 0;

    if (selectedExtra === 'WD') {
      runsOffBat = 0;
      extraRuns = 1 + runsValue;
    } else if (selectedExtra === 'NB') {
      runsOffBat = runsValue;
      extraRuns = 1;
    } else if (selectedExtra === 'BYE' || selectedExtra === 'LB') {
      runsOffBat = 0;
      extraRuns = Math.max(1, runsValue);
    }

    onDispatchAction('RECORD_BALL', {
      matchId: activeMatch.id,
      runsOffBat,
      extraType: selectedExtra,
      extraRuns,
      isWicket: false,
      customCommentary,
    });

    setSelectedExtra('NONE');
    setCustomCommentary('');
  };

  const openWicketDialog = () => {
    if (!isOrganizer) {
      onRequireOrganizer();
      return;
    }
    setDismissedPlayerId(currentInnings.strikerId);
    const alreadyDismissedIds = new Set(
      currentInnings.ballLog
        .filter((b) => b.isWicket)
        .map((b) => b.dismissedPlayerId || b.strikerId)
    );
    const availableNext = battingSquad.find(
      (p) =>
        p.id !== currentInnings.strikerId &&
        p.id !== currentInnings.nonStrikerId &&
        !alreadyDismissedIds.has(p.id)
    );
    setNextBatterId(availableNext?.id || '');
    setFielderName('');
    setIsWicketModalOpen(true);
  };

  const handleConfirmWicket = (e: React.FormEvent) => {
    e.preventDefault();
    onDispatchAction('RECORD_BALL', {
      matchId: activeMatch.id,
      runsOffBat: 0,
      extraType: 'NONE',
      extraRuns: 0,
      isWicket: true,
      wicketType,
      dismissedPlayerId: dismissedPlayerId || currentInnings.strikerId,
      fielderName: fielderName.trim() || undefined,
      nextBatterId: nextBatterId || undefined,
      customCommentary,
    });
    setIsWicketModalOpen(false);
    setCustomCommentary('');
  };

  const openMatchSetup = () => {
    if (!isOrganizer) {
      onRequireOrganizer();
      return;
    }
    setSetupOvers(activeMatch.oversLimit);
    setSetupTossWinner(activeMatch.tossWinnerId || activeMatch.teamAId);
    setSetupTossDecision(activeMatch.tossDecision || 'Bat');
    setSetupStriker(currentInnings.strikerId || battingSquad[0]?.id || '');
    setSetupNonStriker(currentInnings.nonStrikerId || battingSquad[1]?.id || '');
    setSetupBowler(currentInnings.currentBowlerId || bowlingSquad[0]?.id || '');
    setIsMatchSetupOpen(true);
  };

  const handleSaveMatchSetup = (e: React.FormEvent) => {
    e.preventDefault();
    onDispatchAction('START_OR_CONFIGURE_MATCH', {
      matchId: activeMatch.id,
      oversLimit: Number(setupOvers) || 6,
      tossWinnerId: setupTossWinner,
      tossDecision: setupTossDecision,
      strikerId: setupStriker,
      nonStrikerId: setupNonStriker,
      bowlerId: setupBowler,
    });
    setIsMatchSetupOpen(false);
  };

  const openStartSecondInnings = () => {
    if (!isOrganizer) {
      onRequireOrganizer();
      return;
    }
    const chasers = state.players.filter(
      (p) => p.assignedTeamId === activeMatch.innings1.bowlingTeamId
    );
    const defenders = state.players.filter(
      (p) => p.assignedTeamId === activeMatch.innings1.battingTeamId
    );
    setInn2Striker(chasers[0]?.id || '');
    setInn2NonStriker(chasers[1]?.id || '');
    setInn2Bowler(defenders[0]?.id || '');
    setIsSecondInningsModalOpen(true);
  };

  const handleConfirmSecondInnings = (e: React.FormEvent) => {
    e.preventDefault();
    onDispatchAction('START_SECOND_INNINGS', {
      matchId: activeMatch.id,
      strikerId: inn2Striker,
      nonStrikerId: inn2NonStriker,
      bowlerId: inn2Bowler,
    });
    setScorecardInningsTab(2);
    setIsSecondInningsModalOpen(false);
  };

  const currentOverNumber = Math.floor(
    Math.max(
      0,
      currentInnings.legalBalls -
        (currentInnings.legalBalls % 6 === 0 && currentInnings.legalBalls > 0
          ? 1
          : 0)
    ) / 6
  );
  const currentOverBalls = currentInnings.ballLog.filter(
    (b) => b.overNumber === Math.floor(currentInnings.legalBalls / 6)
  );
  const displayOverBalls =
    currentOverBalls.length > 0
      ? currentOverBalls
      : currentInnings.ballLog.filter((b) => b.overNumber === currentOverNumber);

  const isStartOfNewOver =
    currentInnings.legalBalls > 0 &&
    currentInnings.legalBalls % 6 === 0 &&
    !currentInnings.completed;

  const targetScore =
    activeMatch.currentInnings === 2 ? activeMatch.innings1.runs + 1 : null;
  const runsNeeded =
    targetScore !== null ? Math.max(0, targetScore - currentInnings.runs) : null;
  const ballsRemaining =
    activeMatch.oversLimit * 6 - currentInnings.legalBalls;
  const requiredRunRate =
    runsNeeded !== null && ballsRemaining > 0
      ? ((runsNeeded / ballsRemaining) * 6).toFixed(2)
      : '0.00';

  const strikerPlayer = state.players.find((p) => p.id === currentInnings.strikerId);
  const nonStrikerPlayer = state.players.find(
    (p) => p.id === currentInnings.nonStrikerId
  );
  const bowlerPlayer = state.players.find(
    (p) => p.id === currentInnings.currentBowlerId
  );

  const strikerStats = getBatterFigures(currentInnings.strikerId, currentInnings);
  const nonStrikerStats = getBatterFigures(
    currentInnings.nonStrikerId,
    currentInnings
  );
  const bowlerStats = getBowlerFigures(
    currentInnings.currentBowlerId,
    currentInnings
  );

  const allMatchDeliveries = [
    ...activeMatch.innings2.ballLog,
    ...activeMatch.innings1.ballLog,
  ].reverse();

  const filteredCommentary = allMatchDeliveries.filter((b) => {
    if (commentaryFilter === 'BOUNDARIES') {
      return b.runsOffBat === 4 || b.runsOffBat === 6;
    }
    if (commentaryFilter === 'WICKETS') {
      return b.isWicket;
    }
    return true;
  });

  const inspectedInnings =
    scorecardInningsTab === 1 ? activeMatch.innings1 : activeMatch.innings2;

  return (
    <div className="space-y-6">
      {/* Match Selector & PDF Bar (Wraps cleanly with zero horizontal scroll) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 shrink-0">
            Select Match:
          </span>
          {state.matches.map((m) => {
            const tA = state.teams.find((t) => t.id === m.teamAId);
            const tB = state.teams.find((t) => t.id === m.teamBId);
            const isSelected = m.id === activeMatch.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onDispatchAction('SET_ACTIVE_MATCH', { matchId: m.id });
                  setScorecardInningsTab(m.currentInnings);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-2 ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>
                  {m.stage === 'Final' ? 'Grand Final' : `Match ${m.matchNumber}`}
                </span>
                <span>·</span>
                <span className="font-mono">
                  {tA?.shortName} vs {tB?.shortName}
                </span>
                <span>·</span>
                <span className="opacity-85">{m.status}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openMatchSetup}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Set Toss & Overs</span>
          </button>

          <button
            type="button"
            onClick={() => exportMatchScorecardPDF(state, activeMatch.id)}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Download Scorecard PDF</span>
          </button>
        </div>
      </div>

      {/* Broadcast Scoreboard Header Card */}
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {activeMatch.title.toUpperCase()}
              </span>
              <span aria-hidden="true">·</span>
              <span>{activeMatch.venue}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">
                {activeMatch.currentInnings === 1
                  ? '1ST INNINGS BATTING'
                  : '2ND INNINGS RUN CHASE'}
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-4 pt-1">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {battingTeam?.name || 'Batting Team'}
              </h2>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl sm:text-5xl font-extrabold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  {currentInnings.runs}/{currentInnings.wickets}
                </span>
                <span className="text-lg font-mono tabular-nums text-slate-600 dark:text-slate-300">
                  ({formatOvers(currentInnings.legalBalls)} / {activeMatch.oversLimit} Overs)
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300 pt-1 font-mono tabular-nums">
              <span>
                Run Rate (CRR):{' '}
                <strong className="text-slate-900 dark:text-white">
                  {calculateRunRate(currentInnings.runs, currentInnings.legalBalls)}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Extras:{' '}
                <strong className="text-slate-900 dark:text-white">
                  {currentInnings.extras.wides +
                    currentInnings.extras.noBalls +
                    currentInnings.extras.byes +
                    currentInnings.extras.legByes}
                </strong>{' '}
                (Wide {currentInnings.extras.wides}, No-Ball {currentInnings.extras.noBalls}, Bye{' '}
                {currentInnings.extras.byes}, Leg-Bye {currentInnings.extras.legByes})
              </span>
              {targetScore !== null && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    Target: {targetScore} (Need {runsNeeded} in {ballsRemaining} balls · RRR{' '}
                    {requiredRunRate})
                  </span>
                </>
              )}
            </div>

            {activeMatch.resultSummary && (
              <div className="pt-2 flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
                <Award className="w-4 h-4 shrink-0" />
                <span>{activeMatch.resultSummary}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:items-end justify-between gap-4 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-200 dark:border-slate-800">
            <div className="text-left sm:text-right">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Bowling Team:{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {bowlingTeam?.name}
                </strong>
              </div>
              {activeMatch.currentInnings === 2 && (
                <div className="text-sm font-mono tabular-nums text-slate-700 dark:text-slate-200 mt-0.5">
                  1st Innings Score: {activeMatch.innings1.runs}/{activeMatch.innings1.wickets} (
                  {formatOvers(activeMatch.innings1.legalBalls)} ov)
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-mono text-slate-500 dark:text-slate-400 sm:text-right">
                BALLS IN THIS OVER
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {displayOverBalls.length === 0 ? (
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                    Ready for first ball of over
                  </span>
                ) : (
                  displayOverBalls.map((b) => {
                    const label = b.isWicket
                      ? 'W'
                      : b.extraType !== 'NONE'
                      ? `${b.totalRuns}${b.extraType}`
                      : String(b.runsOffBat);
                    return (
                      <span
                        key={b.id}
                        className={`w-8 h-8 rounded-lg font-mono text-xs font-bold flex items-center justify-center tabular-nums ${
                          b.isWicket
                            ? 'bg-rose-600 text-white'
                            : b.runsOffBat === 6
                            ? 'bg-amber-500 text-slate-950'
                            : b.runsOffBat === 4
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {label}
                      </span>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): On-Field Batters, Bowler & Live Scoring Pad */}
        <div className="lg:col-span-7 space-y-6">
          {/* End of Over Reminder Banner */}
          {isStartOfNewOver && (
            <div className="bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-300 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                <span>
                  <strong>Over {currentInnings.legalBalls / 6} Finished!</strong> Please select the
                  new Bowler from the dropdown below before scoring the next ball.
                </span>
              </div>
            </div>
          )}

          {/* Active Batters & Bowler Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold tracking-wide text-slate-700 dark:text-slate-300">
                CURRENT BATTERS & BOWLER ON FIELD
              </span>
              {isOrganizer && (
                <button
                  type="button"
                  onClick={() =>
                    onDispatchAction('UPDATE_ACTIVE_PLAYERS', {
                      matchId: activeMatch.id,
                      swapStrike: true,
                    })
                  }
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>Swap Striker / Non-Striker</span>
                </button>
              )}
            </div>

            <div className="w-full">
              <table className="w-full text-left border-collapse table-fixed sm:table-auto">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-3 sm:px-5 font-medium w-[46%] sm:w-auto">Batter on Crease</th>
                    <th className="py-2.5 px-1.5 sm:px-3 font-medium text-right">R</th>
                    <th className="py-2.5 px-1.5 sm:px-3 font-medium text-right">B</th>
                    <th className="py-2.5 px-1.5 sm:px-3 font-medium text-right">4s</th>
                    <th className="py-2.5 px-1.5 sm:px-3 font-medium text-right">6s</th>
                    <th className="py-2.5 px-2.5 sm:px-5 font-medium text-right">SR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs sm:text-sm">
                  <tr>
                    <td className="py-3 px-3 sm:px-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 dark:text-white block sm:inline truncate">
                            {strikerPlayer?.name || 'Select Striker'} *
                          </span>
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 sm:ml-2 font-medium">
                            (On Strike)
                          </span>
                        </div>
                        {isOrganizer && (
                          <select
                            aria-label="Change Striker"
                            value={currentInnings.strikerId}
                            onChange={(e) =>
                              onDispatchAction('UPDATE_ACTIVE_PLAYERS', {
                                matchId: activeMatch.id,
                                strikerId: e.target.value,
                              })
                            }
                            className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 max-w-full"
                          >
                            {battingSquad.map((p) => (
                              <option key={p.id} value={p.id}>
                                Change: {p.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-1.5 sm:px-3 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                      {strikerStats.runs}
                    </td>
                    <td className="py-3 px-1.5 sm:px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {strikerStats.balls}
                    </td>
                    <td className="py-3 px-1.5 sm:px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {strikerStats.fours}
                    </td>
                    <td className="py-3 px-1.5 sm:px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {strikerStats.sixes}
                    </td>
                    <td className="py-3 px-2.5 sm:px-5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {strikerStats.sr}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3 px-3 sm:px-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div className="min-w-0">
                          <span className="font-medium text-slate-700 dark:text-slate-300 block sm:inline truncate">
                            {nonStrikerPlayer?.name || 'Select Non-Striker'}
                          </span>
                          <span className="text-[11px] text-slate-400 sm:ml-2">
                            (Non-Striker)
                          </span>
                        </div>
                        {isOrganizer && (
                          <select
                            aria-label="Change Non-Striker"
                            value={currentInnings.nonStrikerId}
                            onChange={(e) =>
                              onDispatchAction('UPDATE_ACTIVE_PLAYERS', {
                                matchId: activeMatch.id,
                                nonStrikerId: e.target.value,
                              })
                            }
                            className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 max-w-full"
                          >
                            {battingSquad.map((p) => (
                              <option key={p.id} value={p.id}>
                                Change: {p.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-1.5 sm:px-3 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                      {nonStrikerStats.runs}
                    </td>
                    <td className="py-3 px-1.5 sm:px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {nonStrikerStats.balls}
                    </td>
                    <td className="py-3 px-1.5 sm:px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {nonStrikerStats.fours}
                    </td>
                    <td className="py-3 px-1.5 sm:px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {nonStrikerStats.sixes}
                    </td>
                    <td className="py-3 px-2.5 sm:px-5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {nonStrikerStats.sr}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Active Bowler Bar */}
            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  CURRENT BOWLER:
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {bowlerPlayer?.name || 'Select Bowler'}
                </span>
                {isOrganizer && (
                  <select
                    aria-label="Change Bowler"
                    value={currentInnings.currentBowlerId}
                    onChange={(e) =>
                      onDispatchAction('UPDATE_ACTIVE_PLAYERS', {
                        matchId: activeMatch.id,
                        bowlerId: e.target.value,
                      })
                    }
                    className="text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300"
                  >
                    {bowlingSquad.map((p) => (
                      <option key={p.id} value={p.id}>
                        Switch Bowler: {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300">
                <span>
                  Overs: <strong>{bowlerStats.overs}</strong>
                </span>
                <span>·</span>
                <span>
                  Runs: <strong>{bowlerStats.runs}</strong>
                </span>
                <span>·</span>
                <span>
                  Wickets:{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400">
                    {bowlerStats.wickets}
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Econ: <strong>{bowlerStats.econ}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* 1-Tap Ball-by-Ball Scoring Console */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Scorer Keypad (Tap Runs or Wicket for Each Ball)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  For a normal ball, just tap 0, 1, 2, 3, 4, 6, or OUT. For Wide/No-Ball, select
                  Step 1 first.
                </p>
              </div>
              {!isOrganizer && (
                <button
                  type="button"
                  onClick={onRequireOrganizer}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Unlock PIN (2323) to Score</span>
                </button>
              )}
            </div>

            {/* Extras Selector Row */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                STEP 1 (OPTIONAL): IS THIS BALL AN EXTRA? (DEFAULT IS NORMAL LEGAL BALL)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(
                  [
                    { id: 'NONE', label: 'Normal Ball' },
                    { id: 'WD', label: 'Wide (+1)' },
                    { id: 'NB', label: 'No Ball (+1)' },
                    { id: 'BYE', label: 'Bye' },
                    { id: 'LB', label: 'Leg Bye' },
                  ] as { id: ExtraType; label: string }[]
                ).map((ext) => (
                  <button
                    key={ext.id}
                    type="button"
                    onClick={() => setSelectedExtra(ext.id)}
                    className={`min-h-[44px] px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      selectedExtra === ext.id
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {ext.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Run & Wicket Buttons */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                STEP 2: TAP RUNS SCORED ON THIS BALL (OR TAP OUT FOR A WICKET)
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2.5">
                {[0, 1, 2, 3, 4, 6].map((runsVal) => (
                  <button
                    key={runsVal}
                    type="button"
                    disabled={currentInnings.completed}
                    onClick={() => handleRecordDelivery(runsVal)}
                    className={`min-h-[54px] rounded-xl font-mono text-lg font-bold transition-transform active:scale-95 cursor-pointer flex flex-col items-center justify-center disabled:opacity-40 ${
                      runsVal === 6
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                        : runsVal === 4
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span>{runsVal}</span>
                    <span className="text-[10px] font-sans font-normal opacity-80">
                      {runsVal === 0
                        ? 'Dot Ball'
                        : runsVal === 4
                        ? 'Boundary 4'
                        : runsVal === 6
                        ? 'Six (6)'
                        : `${runsVal} Run${runsVal > 1 ? 's' : ''}`}
                    </span>
                  </button>
                ))}

                <button
                  type="button"
                  disabled={currentInnings.completed}
                  onClick={openWicketDialog}
                  className="min-h-[54px] col-span-2 sm:col-span-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm transition-transform active:scale-95 cursor-pointer flex flex-col items-center justify-center disabled:opacity-40"
                >
                  <ShieldAlert className="w-4 h-4 mb-0.5" />
                  <span>OUT (W)</span>
                </button>
              </div>
            </div>

            {/* Optional Custom Commentary Input + Undo / Innings Controls */}
            <div className="pt-3 space-y-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={customCommentary}
                  onChange={(e) => setCustomCommentary(e.target.value)}
                  placeholder="Optional: Type a custom commentary line before tapping a run button..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!isOrganizer) return onRequireOrganizer();
                    onDispatchAction('UNDO_LAST_BALL', { matchId: activeMatch.id });
                  }}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Undo Last Ball</span>
                </button>

                <div className="flex items-center gap-2">
                  {activeMatch.currentInnings === 1 && (
                    <button
                      type="button"
                      onClick={openStartSecondInnings}
                      className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Switch to 2nd Innings</span>
                    </button>
                  )}

                  {activeMatch.status !== 'Completed' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!isOrganizer) return onRequireOrganizer();
                        onDispatchAction('COMPLETE_MATCH', {
                          matchId: activeMatch.id,
                        });
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Finish Match</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Live Ball-by-Ball Commentary & Full Innings Scorecards */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Ball-by-Ball Live Commentary
              </h3>

              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                {(
                  [
                    { id: 'ALL', label: 'All Balls' },
                    { id: 'BOUNDARIES', label: '4s & 6s' },
                    { id: 'WICKETS', label: 'Wickets' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCommentaryFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      commentaryFilter === tab.id
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[380px] overflow-y-auto">
              {filteredCommentary.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  No balls recorded for this filter yet.
                </div>
              ) : (
                filteredCommentary.map((ball) => (
                  <div
                    key={ball.id}
                    className="p-4 flex items-start gap-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <div
                      className={`w-10 h-10 rounded-xl font-mono text-xs font-bold flex flex-col items-center justify-center shrink-0 tabular-nums ${
                        ball.isWicket
                          ? 'bg-rose-600 text-white'
                          : ball.runsOffBat === 6
                          ? 'bg-amber-500 text-slate-950'
                          : ball.runsOffBat === 4
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span>{ball.overBallLabel}</span>
                      <span className="text-[10px]">
                        {ball.isWicket
                          ? 'OUT'
                          : ball.runsOffBat === 6
                          ? 'SIX'
                          : ball.runsOffBat === 4
                          ? 'FOUR'
                          : `${ball.totalRuns}R`}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                        {ball.commentary}
                      </p>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-mono">
                        Innings {ball.inningsNumber} · Over {ball.overBallLabel}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Full Team Batting Card
              </h3>
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setScorecardInningsTab(1)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                    scorecardInningsTab === 1
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  1st Inn ({activeMatch.innings1.runs}/{activeMatch.innings1.wickets})
                </button>
                <button
                  type="button"
                  onClick={() => setScorecardInningsTab(2)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                    scorecardInningsTab === 2
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  2nd Inn ({activeMatch.innings2.runs}/{activeMatch.innings2.wickets})
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {state.players
                .filter((p) => p.assignedTeamId === inspectedInnings.battingTeamId)
                .map((player) => {
                  const fig = getBatterFigures(player.id, inspectedInnings);
                  const outBall = inspectedInnings.ballLog.find(
                    (b) =>
                      b.isWicket &&
                      (b.dismissedPlayerId || b.strikerId) === player.id
                  );
                  const hasBatted =
                    fig.balls > 0 ||
                    outBall ||
                    player.id === inspectedInnings.strikerId ||
                    player.id === inspectedInnings.nonStrikerId;

                  return (
                    <div
                      key={player.id}
                      className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-white truncate">
                          {player.name}{' '}
                          {player.id === inspectedInnings.strikerId &&
                          !inspectedInnings.completed
                            ? '*'
                            : ''}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {outBall
                            ? `${outBall.wicketType || 'Out'}`
                            : hasBatted
                            ? 'not out'
                            : 'yet to bat'}
                        </div>
                      </div>

                      <div className="font-mono tabular-nums text-right shrink-0">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {fig.runs}
                        </span>{' '}
                        <span className="text-slate-500">({fig.balls}b)</span>
                        <span className="text-slate-400 ml-2">
                          {fig.fours}×4 · {fig.sixes}×6
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* Wicket Detail Modal */}
      {isWicketModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-rose-600 dark:text-rose-400">
                Record Wicket (OUT)
              </h3>
              <button
                type="button"
                onClick={() => setIsWicketModalOpen(false)}
                className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmWicket} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  1. How did the batter get out?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {WICKET_TYPES.map((wt) => (
                    <button
                      key={wt}
                      type="button"
                      onClick={() => setWicketType(wt)}
                      className={`py-2 px-2.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        wicketType === wt
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {wt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  2. Which batter is out?
                </label>
                <select
                  value={dismissedPlayerId}
                  onChange={(e) => setDismissedPlayerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                >
                  {[currentInnings.strikerId, currentInnings.nonStrikerId]
                    .filter(Boolean)
                    .map((id) => {
                      const p = state.players.find((pl) => pl.id === id);
                      return (
                        <option key={id} value={id}>
                          {p?.name || id}
                        </option>
                      );
                    })}
                </select>
              </div>

              {(wicketType === 'Caught' ||
                wicketType === 'Run Out' ||
                wicketType === 'Stumped') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Fielder / Keeper Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={fielderName}
                    onChange={(e) => setFielderName(e.target.value)}
                    placeholder="e.g. Tanvir Ahmed"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  3. Select the New Incoming Batter
                </label>
                <select
                  value={nextBatterId}
                  onChange={(e) => setNextBatterId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                >
                  <option value="">-- Choose Next Batter --</option>
                  {battingSquad.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsWicketModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                >
                  Confirm Wicket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Match & Overs Setup Modal */}
      {isMatchSetupOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Set Match Overs & Toss
              </h3>
              <button
                type="button"
                onClick={() => setIsMatchSetupOpen(false)}
                className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMatchSetup} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Total Overs per Innings
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={setupOvers}
                  onChange={(e) => setSetupOvers(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Who Won the Toss?
                  </label>
                  <select
                    value={setupTossWinner}
                    onChange={(e) => setSetupTossWinner(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  >
                    {[activeMatch.teamAId, activeMatch.teamBId].map((tId) => {
                      const t = state.teams.find((tm) => tm.id === tId);
                      return (
                        <option key={tId} value={tId}>
                          {t?.name || tId}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Toss Decision
                  </label>
                  <select
                    value={setupTossDecision}
                    onChange={(e) =>
                      setSetupTossDecision(e.target.value as 'Bat' | 'Bowl')
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="Bat">Bat First</option>
                    <option value="Bowl">Bowl First</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMatchSetupOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                >
                  Save Match Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Start 2nd Innings Modal */}
      {isSecondInningsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Start 2nd Innings Run Chase
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Target to win: <strong>{activeMatch.innings1.runs + 1} runs</strong> in{' '}
              {activeMatch.oversLimit} overs.
            </p>

            <form onSubmit={handleConfirmSecondInnings} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Opening Striker
                </label>
                <select
                  value={inn2Striker}
                  onChange={(e) => setInn2Striker(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                >
                  {state.players
                    .filter(
                      (p) =>
                        p.assignedTeamId === activeMatch.innings1.bowlingTeamId
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Opening Non-Striker
                </label>
                <select
                  value={inn2NonStriker}
                  onChange={(e) => setInn2NonStriker(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                >
                  {state.players
                    .filter(
                      (p) =>
                        p.assignedTeamId === activeMatch.innings1.bowlingTeamId
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Opening Bowler
                </label>
                <select
                  value={inn2Bowler}
                  onChange={(e) => setInn2Bowler(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                >
                  {state.players
                    .filter(
                      (p) =>
                        p.assignedTeamId === activeMatch.innings1.battingTeamId
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSecondInningsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                >
                  Start 2nd Innings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
