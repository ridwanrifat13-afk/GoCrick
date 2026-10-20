import React, { useState } from 'react';
import {
  Trophy,
  FileDown,
  BarChart3,
  TrendingUp,
  Calendar,
  ArrowUpRight,
  Award,
} from 'lucide-react';
import {
  TournamentState,
  TournamentAction,
  InningsData,
} from '../types/tournament';
import {
  computeTeamStandings,
  formatOvers,
  calculateRunRate,
} from '../utils/tournamentReducer';
import { exportMatchScorecardPDF } from '../utils/pdfExporter';

interface MatchesAndSummaryViewProps {
  state: TournamentState;
  isOrganizer: boolean;
  onRequireOrganizer: () => void;
  onDispatchAction: (
    type: TournamentAction['type'],
    payload: Record<string, unknown>
  ) => void;
  onNavigateToScoreboard: (matchId: string) => void;
}

export const MatchesAndSummaryView: React.FC<MatchesAndSummaryViewProps> = ({
  state,
  isOrganizer,
  onRequireOrganizer,
  onDispatchAction,
  onNavigateToScoreboard,
}) => {
  const [selectedMatchId, setSelectedMatchId] = useState<string>(
    state.activeMatchId || 'match-1'
  );

  const standings = computeTeamStandings(state);
  const inspectedMatch =
    state.matches.find((m) => m.id === selectedMatchId) || state.matches[0];

  const team1 = state.teams.find(
    (t) => t.id === inspectedMatch.innings1.battingTeamId
  );
  const team2 = state.teams.find(
    (t) => t.id === inspectedMatch.innings2.battingTeamId
  );

  // Build over-by-over arrays for Worm & Manhattan charts
  const buildOverSummary = (inn: InningsData, maxOvers: number) => {
    const perOver: {
      over: number;
      runsInOver: number;
      cumulativeRuns: number;
      wicketsInOver: number;
    }[] = [];

    let cum = 0;
    for (let ov = 0; ov < maxOvers; ov++) {
      const ballsInOv = inn.ballLog.filter((b) => b.overNumber === ov);
      if (ballsInOv.length === 0 && ov > Math.floor(inn.legalBalls / 6)) {
        break;
      }
      const runs = ballsInOv.reduce((s, b) => s + b.totalRuns, 0);
      const wkts = ballsInOv.filter((b) => b.isWicket).length;
      cum += runs;
      perOver.push({
        over: ov + 1,
        runsInOver: runs,
        cumulativeRuns: cum,
        wicketsInOver: wkts,
      });
    }
    return perOver;
  };

  const inn1Overs = buildOverSummary(
    inspectedMatch.innings1,
    inspectedMatch.oversLimit
  );
  const inn2Overs = buildOverSummary(
    inspectedMatch.innings2,
    inspectedMatch.oversLimit
  );

  const maxCumulativeRuns = Math.max(
    60,
    inspectedMatch.innings1.runs,
    inspectedMatch.innings2.runs
  );
  const maxOverRuns = Math.max(
    20,
    ...inn1Overs.map((o) => o.runsInOver),
    ...inn2Overs.map((o) => o.runsInOver)
  );

  const handleSeedTopTwoIntoFinal = () => {
    if (!isOrganizer) {
      onRequireOrganizer();
      return;
    }
    if (standings.length >= 2) {
      onDispatchAction('SEED_FINAL_MATCH', {
        teamAId: standings[0].teamId,
        teamBId: standings[1].teamId,
        oversLimit: 8,
      });
    }
  };

  // Compute boundaries & dot balls for summary
  const computeInningsBreakdown = (inn: InningsData) => {
    const fours = inn.ballLog.filter((b) => b.runsOffBat === 4).length;
    const sixes = inn.ballLog.filter((b) => b.runsOffBat === 6).length;
    const dots = inn.ballLog.filter(
      (b) => b.isLegalDelivery && b.totalRuns === 0
    ).length;
    const extras =
      inn.extras.wides +
      inn.extras.noBalls +
      inn.extras.byes +
      inn.extras.legByes;
    return { fours, sixes, dots, extras };
  };

  const inn1Break = computeInningsBreakdown(inspectedMatch.innings1);
  const inn2Break = computeInningsBreakdown(inspectedMatch.innings2);

  return (
    <div className="space-y-8">
      {/* Top Section: League Points Table & Round-Robin + Final Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Points & Net Run Rate Table (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>Round-Robin League Standings</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Top 2 teams qualify for the Floodlight Grand Final
              </p>
            </div>
            <button
              type="button"
              onClick={handleSeedTopTwoIntoFinal}
              className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              Seed Top 2 to Final
            </button>
          </div>

          <div className="w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-2.5 sm:px-4 font-medium">#</th>
                  <th className="py-3 px-2 sm:px-3 font-medium">Team</th>
                  <th className="py-3 px-1.5 sm:px-2.5 font-medium text-right">P</th>
                  <th className="py-3 px-1.5 sm:px-2.5 font-medium text-right">W</th>
                  <th className="py-3 px-1.5 sm:px-2.5 font-medium text-right">L</th>
                  <th className="py-3 px-1.5 sm:px-2.5 font-medium text-right">PTS</th>
                  <th className="py-3 px-2.5 sm:px-4 font-medium text-right">NRR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs sm:text-sm">
                {standings.map((row, idx) => (
                  <tr
                    key={row.teamId}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="py-3 px-2.5 sm:px-4 font-mono text-xs font-bold text-slate-500">
                      0{idx + 1}
                    </td>
                    <td className="py-3 px-2 sm:px-3 min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white leading-snug">
                        {row.teamName}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {idx < 2 ? 'Final Qualifier' : 'Elimination'}
                      </div>
                    </td>
                    <td className="py-3 px-1.5 sm:px-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {row.played}
                    </td>
                    <td className="py-3 px-1.5 sm:px-2.5 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                      {row.won}
                    </td>
                    <td className="py-3 px-1.5 sm:px-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {row.lost}
                    </td>
                    <td className="py-3 px-1.5 sm:px-2.5 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                      {row.points}
                    </td>
                    <td className="py-3 px-2.5 sm:px-4 text-right font-mono tabular-nums text-xs text-slate-700 dark:text-slate-300">
                      {row.nrr >= 0 ? `+${row.nrr.toFixed(2)}` : row.nrr.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tournament Fixtures & Results Cards (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>October 22nd Tournament Fixtures (Round-Robin + Grand Final)</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {state.matches.map((match) => {
              const tA = state.teams.find((t) => t.id === match.teamAId);
              const tB = state.teams.find((t) => t.id === match.teamBId);
              const isSelected = match.id === inspectedMatch.id;

              return (
                <div
                  key={match.id}
                  onClick={() => setSelectedMatchId(match.id)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white dark:bg-slate-900 border-emerald-500 shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {match.stage === 'Final'
                        ? 'GRAND FINAL'
                        : `LEAGUE MATCH ${match.matchNumber}`}
                    </span>
                    <span className="font-mono">{match.oversLimit} Overs</span>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {tA?.name}
                      </span>
                      <span className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                        {match.innings1.battingTeamId === match.teamAId
                          ? `${match.innings1.runs}/${match.innings1.wickets} (${formatOvers(
                              match.innings1.legalBalls
                            )})`
                          : `${match.innings2.runs}/${match.innings2.wickets} (${formatOvers(
                              match.innings2.legalBalls
                            )})`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {tB?.name}
                      </span>
                      <span className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                        {match.innings1.battingTeamId === match.teamBId
                          ? `${match.innings1.runs}/${match.innings1.wickets} (${formatOvers(
                              match.innings1.legalBalls
                            )})`
                          : `${match.innings2.runs}/${match.innings2.wickets} (${formatOvers(
                              match.innings2.legalBalls
                            )})`}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {match.resultSummary || match.scheduledTime}
                    </span>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          exportMatchScorecardPDF(state, match.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
                        title="Download Scorecard PDF"
                      >
                        <FileDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToScoreboard(match.id);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <span>Scoreboard</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Visual Match Summary Section (Worm Progression & Manhattan Over Comparison) */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              VISUAL MATCH SUMMARY & TELEMETRY
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              {inspectedMatch.title} — {team1?.name} vs {team2?.name}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {state.matches.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMatchId(m.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold cursor-pointer ${
                  m.id === inspectedMatch.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                M{m.matchNumber}
              </button>
            ))}

            <button
              type="button"
              onClick={() => exportMatchScorecardPDF(state, inspectedMatch.id)}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-emerald-500" />
              <span>Scorecard PDF</span>
            </button>
          </div>
        </div>

        {/* 2 Visual Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Cumulative Run Worm Chart */}
          <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span>Cumulative Run Progression (Worm)</span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  1st Inn: {team1?.shortName} ({inspectedMatch.innings1.runs}/
                  {inspectedMatch.innings1.wickets})
                </span>
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  2nd Inn: {team2?.shortName} ({inspectedMatch.innings2.runs}/
                  {inspectedMatch.innings2.wickets})
                </span>
              </div>
            </div>

            <div className="h-52 w-full pt-2">
              <svg
                viewBox="0 0 420 170"
                className="w-full h-full overflow-visible"
                role="img"
                aria-label="Run Progression Worm Chart"
              >
                {/* Horizontal grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const y = 140 - ratio * 120;
                  const val = Math.round(ratio * maxCumulativeRuns);
                  return (
                    <g key={idx}>
                      <line
                        x1="34"
                        y1={y}
                        x2="400"
                        y2={y}
                        stroke="currentColor"
                        className="text-slate-200 dark:text-slate-800"
                        strokeDasharray="3 3"
                      />
                      <text
                        x="28"
                        y={y + 3}
                        textAnchor="end"
                        className="text-[9px] fill-slate-400 font-mono"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* Innings 1 Polyline */}
                {inn1Overs.length > 0 && (
                  <>
                    <polyline
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="3"
                      points={[
                        '34,140',
                        ...inn1Overs.map((pt) => {
                          const x =
                            34 +
                            (pt.over / inspectedMatch.oversLimit) * 366;
                          const y =
                            140 -
                            (pt.cumulativeRuns / maxCumulativeRuns) * 120;
                          return `${x},${y}`;
                        }),
                      ].join(' ')}
                    />
                    {inn1Overs.map((pt) => {
                      const x =
                        34 + (pt.over / inspectedMatch.oversLimit) * 366;
                      const y =
                        140 - (pt.cumulativeRuns / maxCumulativeRuns) * 120;
                      return (
                        <g key={`w1-${pt.over}`}>
                          <circle
                            cx={x}
                            cy={y}
                            r={pt.wicketsInOver > 0 ? 5 : 3.5}
                            fill={pt.wicketsInOver > 0 ? '#EF4444' : '#10B981'}
                          />
                        </g>
                      );
                    })}
                  </>
                )}

                {/* Innings 2 Polyline */}
                {inn2Overs.length > 0 && (
                  <>
                    <polyline
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth="3"
                      points={[
                        '34,140',
                        ...inn2Overs.map((pt) => {
                          const x =
                            34 +
                            (pt.over / inspectedMatch.oversLimit) * 366;
                          const y =
                            140 -
                            (pt.cumulativeRuns / maxCumulativeRuns) * 120;
                          return `${x},${y}`;
                        }),
                      ].join(' ')}
                    />
                    {inn2Overs.map((pt) => {
                      const x =
                        34 + (pt.over / inspectedMatch.oversLimit) * 366;
                      const y =
                        140 - (pt.cumulativeRuns / maxCumulativeRuns) * 120;
                      return (
                        <circle
                          key={`w2-${pt.over}`}
                          cx={x}
                          cy={y}
                          r={pt.wicketsInOver > 0 ? 5 : 3.5}
                          fill={pt.wicketsInOver > 0 ? '#EF4444' : '#F59E0B'}
                        />
                      );
                    })}
                  </>
                )}

                {/* X-Axis Over Labels */}
                {Array.from(
                  { length: inspectedMatch.oversLimit },
                  (_, i) => i + 1
                ).map((ov) => {
                  const x = 34 + (ov / inspectedMatch.oversLimit) * 366;
                  return (
                    <text
                      key={ov}
                      x={x}
                      y="158"
                      textAnchor="middle"
                      className="text-[9px] fill-slate-400 font-mono"
                    >
                      Ov {ov}
                    </text>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Chart 2: Over-by-Over Runs Manhattan Chart */}
          <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <BarChart3 className="w-4 h-4 text-amber-500" />
                <span>Over-by-Over Runs Scored (Manhattan)</span>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                Red dot = Wicket in over
              </span>
            </div>

            <div className="h-52 w-full pt-2">
              <svg
                viewBox="0 0 420 170"
                className="w-full h-full overflow-visible"
                role="img"
                aria-label="Over by Over Manhattan Chart"
              >
                {[0, 0.5, 1].map((ratio, idx) => {
                  const y = 140 - ratio * 120;
                  const val = Math.round(ratio * maxOverRuns);
                  return (
                    <g key={idx}>
                      <line
                        x1="34"
                        y1={y}
                        x2="400"
                        y2={y}
                        stroke="currentColor"
                        className="text-slate-200 dark:text-slate-800"
                        strokeDasharray="3 3"
                      />
                      <text
                        x="28"
                        y={y + 3}
                        textAnchor="end"
                        className="text-[9px] fill-slate-400 font-mono"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}

                {Array.from(
                  { length: inspectedMatch.oversLimit },
                  (_, i) => i + 1
                ).map((ov) => {
                  const groupWidth = 366 / inspectedMatch.oversLimit;
                  const centerX = 34 + (ov - 0.5) * groupWidth;
                  const barW = Math.min(14, groupWidth * 0.35);

                  const o1 = inn1Overs.find((o) => o.over === ov);
                  const o2 = inn2Overs.find((o) => o.over === ov);

                  const h1 = o1 ? (o1.runsInOver / maxOverRuns) * 120 : 0;
                  const h2 = o2 ? (o2.runsInOver / maxOverRuns) * 120 : 0;

                  return (
                    <g key={ov}>
                      {o1 && (
                        <rect
                          x={centerX - barW - 1}
                          y={140 - h1}
                          width={barW}
                          height={Math.max(2, h1)}
                          rx={2}
                          fill="#10B981"
                        />
                      )}
                      {o2 && (
                        <rect
                          x={centerX + 1}
                          y={140 - h2}
                          width={barW}
                          height={Math.max(2, h2)}
                          rx={2}
                          fill="#F59E0B"
                        />
                      )}
                      <text
                        x={centerX}
                        y="158"
                        textAnchor="middle"
                        className="text-[9px] fill-slate-400 font-mono"
                      >
                        Ov {ov}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>

        {/* Head-to-Head Match Telemetry Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">
                1st Innings · {team1?.name}
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                {inspectedMatch.innings1.runs}/{inspectedMatch.innings1.wickets}{' '}
                <span className="text-xs font-normal text-slate-500">
                  ({formatOvers(inspectedMatch.innings1.legalBalls)} ov · CRR{' '}
                  {calculateRunRate(
                    inspectedMatch.innings1.runs,
                    inspectedMatch.innings1.legalBalls
                  )}
                  )
                </span>
              </div>
            </div>

            <div className="text-right text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 space-y-0.5">
              <div>
                Boundaries: <strong>{inn1Break.fours}×4</strong> ·{' '}
                <strong>{inn1Break.sixes}×6</strong>
              </div>
              <div>
                Dots: <strong>{inn1Break.dots}</strong> · Extras:{' '}
                <strong>{inn1Break.extras}</strong>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">
                2nd Innings · {team2?.name}
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                {inspectedMatch.innings2.runs}/{inspectedMatch.innings2.wickets}{' '}
                <span className="text-xs font-normal text-slate-500">
                  ({formatOvers(inspectedMatch.innings2.legalBalls)} ov · CRR{' '}
                  {calculateRunRate(
                    inspectedMatch.innings2.runs,
                    inspectedMatch.innings2.legalBalls
                  )}
                  )
                </span>
              </div>
            </div>

            <div className="text-right text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 space-y-0.5">
              <div>
                Boundaries: <strong>{inn2Break.fours}×4</strong> ·{' '}
                <strong>{inn2Break.sixes}×6</strong>
              </div>
              <div>
                Dots: <strong>{inn2Break.dots}</strong> · Extras:{' '}
                <strong>{inn2Break.extras}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
