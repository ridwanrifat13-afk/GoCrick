import React, { useState } from 'react';
import { Award, Search, Flame, Shield, Zap } from 'lucide-react';
import { TournamentState, ALL_GROUPS } from '../types/tournament';
import { computeAllPlayerStats, formatOvers } from '../utils/tournamentReducer';

interface PlayerStatsDashboardProps {
  state: TournamentState;
}

export const PlayerStatsDashboard: React.FC<PlayerStatsDashboardProps> = ({
  state,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');
  const [groupFilter, setGroupFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'MVP' | 'RUNS' | 'WICKETS' | 'SR'>('MVP');

  const allStats = computeAllPlayerStats(state);

  const orangeCapLeader = [...allStats].sort((a, b) => {
    if (b.runs !== a.runs) return b.runs - a.runs;
    return b.strikeRate - a.strikeRate;
  })[0];

  const purpleCapLeader = [...allStats].sort((a, b) => {
    if (b.wickets !== a.wickets) return b.wickets - a.wickets;
    return a.economy - b.economy;
  })[0];

  const mvpLeader = [...allStats].sort((a, b) => b.mvpPoints - a.mvpPoints)[0];

  const filteredStats = allStats
    .filter((st) => {
      if (teamFilter !== 'ALL' && st.teamId !== teamFilter) return false;
      if (groupFilter !== 'ALL' && st.group !== groupFilter) return false;
      if (
        searchQuery.trim() &&
        !st.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'RUNS') return b.runs - a.runs || b.strikeRate - a.strikeRate;
      if (sortBy === 'WICKETS') return b.wickets - a.wickets || a.economy - b.economy;
      if (sortBy === 'SR') return b.strikeRate - a.strikeRate;
      return b.mvpPoints - a.mvpPoints;
    });

  return (
    <div className="space-y-8">
      {/* Top 3 Leaderboard Cap Spotlight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Orange Cap */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-600 dark:text-amber-400">
            <span className="flex items-center gap-1.5">
              <Flame className="w-4 h-4" />
              <span>ORANGE CAP · MOST RUNS</span>
            </span>
            <span className="font-mono">{orangeCapLeader?.teamShortName}</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {orangeCapLeader?.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {orangeCapLeader?.role} · Group {orangeCapLeader?.group}
              </p>
            </div>
            <div className="text-right font-mono tabular-nums">
              <div className="text-3xl font-extrabold text-amber-500">
                {orangeCapLeader?.runs}
              </div>
              <div className="text-xs text-slate-500">
                SR {orangeCapLeader?.strikeRate}
              </div>
            </div>
          </div>
        </div>

        {/* Purple Cap */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="flex items-center gap-1.5">
              <Shield className="w-4 h-4" />
              <span>PURPLE CAP · MOST WICKETS</span>
            </span>
            <span className="font-mono">{purpleCapLeader?.teamShortName}</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {purpleCapLeader?.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {purpleCapLeader?.role} · Group {purpleCapLeader?.group}
              </p>
            </div>
            <div className="text-right font-mono tabular-nums">
              <div className="text-3xl font-extrabold text-emerald-500">
                {purpleCapLeader?.wickets}
              </div>
              <div className="text-xs text-slate-500">
                ECON {purpleCapLeader?.economy.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Tournament MVP */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-sky-600 dark:text-sky-400">
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4" />
              <span>TOURNAMENT MVP LEADER</span>
            </span>
            <span className="font-mono">{mvpLeader?.teamShortName}</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {mvpLeader?.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {mvpLeader?.fours}×4 · {mvpLeader?.sixes}×6 · {mvpLeader?.wickets}W
              </p>
            </div>
            <div className="text-right font-mono tabular-nums">
              <div className="text-3xl font-extrabold text-sky-500">
                {mvpLeader?.mvpPoints}
              </div>
              <div className="text-xs text-slate-500">Impact Pts</div>
            </div>
          </div>
        </div>
      </div>

      {/* Full 24-Player Statistics & Performance Registry */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-500" />
              <span>Player Statistics Dashboard (All 24 Tournament Players)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Real-time batting, bowling, boundary, and MVP metrics across all tournament matches.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search player name..."
                className="pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>

            {/* Team Filter */}
            <select
              aria-label="Filter by Team"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">All 3 Teams + Pool</option>
              {state.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            {/* Group Filter */}
            <select
              aria-label="Filter by Group"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">All Groups (Captains + A–G)</option>
              <option value="CAPTAIN">Team Captains</option>
              {ALL_GROUPS.map((g) => (
                <option key={g} value={g}>
                  Group {g}
                </option>
              ))}
            </select>

            {/* Sort Selector */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              {(
                [
                  { id: 'MVP', label: 'MVP' },
                  { id: 'RUNS', label: 'Runs' },
                  { id: 'WICKETS', label: 'Wickets' },
                  { id: 'SR', label: 'Strike Rate' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSortBy(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    sortBy === tab.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-950/40">
                <th className="py-3 px-4 font-medium">Player</th>
                <th className="py-3 px-3 font-medium">Group & Role</th>
                <th className="py-3 px-3 font-medium">Team</th>
                <th className="py-3 px-3 font-medium text-right">Runs</th>
                <th className="py-3 px-3 font-medium text-right">Balls</th>
                <th className="py-3 px-3 font-medium text-right">4s / 6s</th>
                <th className="py-3 px-3 font-medium text-right">SR</th>
                <th className="py-3 px-3 font-medium text-right">Overs</th>
                <th className="py-3 px-3 font-medium text-right">Wkts</th>
                <th className="py-3 px-3 font-medium text-right">Econ</th>
                <th className="py-3 px-4 font-medium text-right">MVP Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-sm">
              {filteredStats.map((st) => (
                <tr
                  key={st.playerId}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    {st.name}
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-400">
                    {st.group === 'CAPTAIN' ? 'Captain' : `Group ${st.group}`} · {st.role}
                  </td>
                  <td className="py-3 px-3 text-xs font-mono text-slate-700 dark:text-slate-300">
                    {st.teamShortName}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                    {st.runs}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                    {st.ballsFaced}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-xs text-slate-600 dark:text-slate-400">
                    {st.fours} / {st.sixes}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {st.strikeRate.toFixed(1)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                    {formatOvers(st.ballsBowled)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                    {st.wickets}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                    {st.economy.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-sky-600 dark:text-sky-400">
                    {st.mvpPoints}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
