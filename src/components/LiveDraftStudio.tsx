import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Shuffle,
  FileDown,
  RotateCcw,
  Edit3,
  Sparkles,
  CheckCircle2,
  Crown,
  Users,
  Lock,
  Play,
  SlidersHorizontal,
  X,
  HelpCircle,
} from 'lucide-react';
import {
  TournamentState,
  GroupKey,
  ALL_GROUPS,
  PlayerRole,
  TournamentAction,
} from '../types/tournament';
import { GROUP_DESCRIPTIONS } from '../data/initialTournamentState';
import { exportSquadsPDF } from '../utils/pdfExporter';

interface LiveDraftStudioProps {
  state: TournamentState;
  isOrganizer: boolean;
  onRequireOrganizer: () => void;
  onDispatchAction: (
    type: TournamentAction['type'],
    payload: Record<string, unknown>
  ) => void;
  onTriggerDramaticGroupShuffle: (group: GroupKey) => void;
}

const ROLES: PlayerRole[] = ['Batter', 'Bowler', 'All-Rounder', 'WK'];

export const LiveDraftStudio: React.FC<LiveDraftStudioProps> = ({
  state,
  isOrganizer,
  onRequireOrganizer,
  onDispatchAction,
  onTriggerDramaticGroupShuffle,
}) => {
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<'ALL' | GroupKey>('ALL');
  const [isCustomizingRoster, setIsCustomizingRoster] = useState(false);

  const [editTeams, setEditTeams] = useState(() =>
    state.teams.map((t) => ({
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      captainName: t.captainName,
    }))
  );
  const [editPlayers, setEditPlayers] = useState(() =>
    state.players.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      group: p.group,
    }))
  );

  const openRosterEditor = () => {
    if (!isOrganizer) {
      onRequireOrganizer();
      return;
    }
    setEditTeams(
      state.teams.map((t) => ({
        id: t.id,
        name: t.name,
        shortName: t.shortName,
        captainName: t.captainName,
      }))
    );
    setEditPlayers(
      state.players.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        group: p.group,
      }))
    );
    setIsCustomizingRoster(true);
  };

  const handleSaveRosterChanges = (e: React.FormEvent) => {
    e.preventDefault();
    onDispatchAction('BULK_UPDATE_GROUP_PLAYERS', {
      players: editPlayers,
      teams: editTeams,
    });
    setIsCustomizingRoster(false);
  };

  const completedGroupsCount = ALL_GROUPS.filter(
    (g) => state.draft.groups[g]?.status === 'completed'
  ).length;
  const nextPendingGroup = ALL_GROUPS.find(
    (g) => state.draft.groups[g]?.status === 'pending'
  );
  const activeRevealGroup = state.draft.activeGroup
    ? state.draft.groups[state.draft.activeGroup]
    : null;

  const handleShuffleClick = (group: GroupKey) => {
    if (!isOrganizer) {
      onRequireOrganizer();
      return;
    }
    onTriggerDramaticGroupShuffle(group);
  };

  const handleResetGroup = (group: GroupKey) => {
    if (!isOrganizer) {
      onRequireOrganizer();
      return;
    }
    onDispatchAction('RESET_GROUP_SHUFFLE', { group });
  };

  const handleResetAllDraft = () => {
    if (!isOrganizer) {
      onRequireOrganizer();
      return;
    }
    onDispatchAction('RESET_ALL_DRAFT', {});
  };

  const handleManualStepReveal = (group: GroupKey, nextStep: 1 | 2 | 3) => {
    if (!isOrganizer) {
      onRequireOrganizer();
      return;
    }
    onDispatchAction('ADVANCE_GROUP_REVEAL', { group, step: nextStep });
  };

  const visibleGroups =
    selectedGroupFilter === 'ALL' ? ALL_GROUPS : [selectedGroupFilter];

  return (
    <div className="space-y-8">
      {/* Simple 3-Step Visual Guide Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-start gap-3.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-sm flex items-center justify-center shrink-0">
            1
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              Set Up Captains & Groups (A–G)
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              Click <strong>Edit Names & Groups</strong> below to customize the 3 Team Captains and
              21 players across Groups A to G.
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-start gap-3.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 font-mono font-bold text-sm flex items-center justify-center shrink-0">
            2
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              Shuffle Each Group Live
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              Click <strong>Shuffle Group</strong> on any group (A–G). Players are revealed one card
              at a time into Team 1, Team 2, and Team 3.
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-start gap-3.5">
          <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 font-mono font-bold text-sm flex items-center justify-center shrink-0">
            3
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              Download Official Teams PDF
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              Once all 7 groups are shuffled (8 players per team), click{' '}
              <strong>Download Teams PDF</strong> for your tournament records.
            </p>
          </div>
        </div>
      </div>

      {/* Main Action & Progress Control Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <span>TEAM FORMATION PROGRESS</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {completedGroupsCount} OF 7 GROUPS COMPLETED
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {3 + completedGroupsCount * 3} OF 24 PLAYERS IN TEAMS
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Live Player Draft & Team Shuffling
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
              {nextPendingGroup
                ? `Next group ready to draw: Group ${nextPendingGroup} (${GROUP_DESCRIPTIONS[nextPendingGroup]}). Click the green button to shuffle and reveal live.`
                : 'All 7 groups (A through G) have been shuffled into the 3 teams! You can download the PDF or re-shuffle any group below.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {nextPendingGroup && (
              <button
                type="button"
                onClick={() => handleShuffleClick(nextPendingGroup)}
                className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-sm"
              >
                <Shuffle className="w-4 h-4" />
                <span>Shuffle Next: Group {nextPendingGroup}</span>
              </button>
            )}

            <button
              type="button"
              onClick={openRosterEditor}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit Names & Groups</span>
            </button>

            <button
              type="button"
              onClick={() => exportSquadsPDF(state)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-sm flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Download Teams PDF</span>
            </button>

            <button
              type="button"
              onClick={handleResetAllDraft}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-500/40 hover:text-rose-600 dark:hover:text-rose-400 text-slate-600 dark:text-slate-400 font-medium text-sm flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Clear all group assignments and start fresh"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Start Over</span>
            </button>
          </div>
        </div>

        {/* Group Status Strip (Wraps cleanly without horizontal scroll) */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500 shrink-0 mr-1">
              Quick Jump:
            </span>
            {ALL_GROUPS.map((g) => {
              const gState = state.draft.groups[g];
              const isDone = gState?.status === 'completed';
              const isRevealing = gState?.status === 'revealing';
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() =>
                    setSelectedGroupFilter((prev) => (prev === g ? 'ALL' : g))
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    isRevealing
                      ? 'bg-amber-500 text-slate-950'
                      : isDone
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span>Group {g}</span>
                  <span>·</span>
                  <span>{isRevealing ? 'DRAWING' : isDone ? 'DONE' : 'WAITING'}</span>
                </button>
              );
            })}
          </div>
          {!isOrganizer && (
            <button
              type="button"
              onClick={onRequireOrganizer}
              className="text-xs text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1.5 font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Spectator Mode · Click to Unlock Organizer Mode to Shuffle</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Dramatic One-by-One Card Reveal Spotlight Stage */}
      {activeRevealGroup && (
        <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-2 border-amber-500/60 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <Sparkles className="w-4 h-4" />
                <span>LIVE SHUFFLE IN PROGRESS</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  CARD {activeRevealGroup.revealStep} OF 3 REVEALED
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mt-1">
                Drawing Group {activeRevealGroup.group} ({activeRevealGroup.label})
              </h3>
            </div>

            <div className="flex items-center gap-2.5">
              {isOrganizer && activeRevealGroup.revealStep < 3 && (
                <button
                  type="button"
                  onClick={() =>
                    handleManualStepReveal(
                      activeRevealGroup.group,
                      (activeRevealGroup.revealStep + 1) as 1 | 2 | 3
                    )
                  }
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>
                    Reveal Card #{activeRevealGroup.revealStep + 1} Immediately
                  </span>
                </button>
              )}
              {isOrganizer && (
                <button
                  type="button"
                  onClick={() =>
                    onDispatchAction('COMPLETE_GROUP_SHUFFLE', {
                      group: activeRevealGroup.group,
                    })
                  }
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium text-xs cursor-pointer whitespace-nowrap shrink-0"
                >
                  {activeRevealGroup.revealStep === 3 ? 'Done / Hide Banner' : 'Skip Animation'}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
            {state.teams.map((team, index) => {
              const cardOrder = (index + 1) as 1 | 2 | 3;
              const isRevealed = activeRevealGroup.revealStep >= cardOrder;
              const assignedPlayerId = activeRevealGroup.assignments[team.id];
              const assignedPlayer = state.players.find(
                (p) => p.id === assignedPlayerId
              );

              return (
                <motion.div
                  key={`${activeRevealGroup.group}-${team.id}-${isRevealed ? 'revealed' : 'waiting'}`}
                  initial={isRevealed ? { scale: 0.85, rotateY: 90, opacity: 0 } : false}
                  animate={{ scale: 1, rotateY: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  className={`rounded-xl p-5 border-2 transition-colors duration-300 ${
                    isRevealed
                      ? 'bg-emerald-50/70 dark:bg-slate-800/95 border-emerald-500 shadow-lg shadow-emerald-500/15'
                      : 'bg-slate-50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 opacity-85'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-3">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      TEAM {cardOrder}: {team.name}
                    </span>
                    <span className="font-mono">
                      Capt. {team.captainName}
                    </span>
                  </div>

                  {isRevealed && assignedPlayer ? (
                    <div className="py-3 space-y-1.5">
                      <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>JOINS {team.name.toUpperCase()}</span>
                      </div>
                      <div className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                        {assignedPlayer.name}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300">
                        {assignedPlayer.role} · Group {assignedPlayer.group}
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-amber-500 dark:text-amber-400">
                        <Shuffle className="w-5 h-5 animate-spin" />
                      </div>
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Shuffling Card #{cardOrder}...
                      </div>
                      <div className="text-xs text-slate-500">
                        Revealing player for {team.name}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3 Formed Teams Overview (Captains + 7 Group Slots each) */}
      <section aria-label="Formed Tournament Teams">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>The 3 Tournament Teams (Live Squad Rosters)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Each team starts with 1 Captain and receives 1 player from each Group (A, B, C, D, E,
              F & G) for a total of 8 players per team.
            </p>
          </div>
          {isOrganizer && (
            <button
              type="button"
              onClick={openRosterEditor}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Team or Captain Names</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {state.teams.map((team, idx) => {
            const captain = state.players.find((p) => p.id === team.captainId);
            const draftedCount = ALL_GROUPS.filter((g) =>
              state.players.some(
                (p) => p.group === g && p.assignedTeamId === team.id
              )
            ).length;

            return (
              <div
                key={team.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col"
              >
                {/* Team Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
                      TEAM 0{idx + 1} · {team.shortName}
                    </span>
                    <span className="text-xs font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-semibold">
                      {1 + draftedCount} / 8 Players Filled
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 dark:text-white mt-1 truncate">
                    {team.name}
                  </h4>

                  {/* Captain Row */}
                  <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                      <div className="truncate">
                        <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {team.captainName} (Captain)
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Role: {captain?.role || 'All-Rounder'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 7 Group Slots (A to G) */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80 flex-1">
                  {ALL_GROUPS.map((g) => {
                    const draftedPlayer = state.players.find(
                      (p) => p.group === g && p.assignedTeamId === team.id
                    );
                    const groupStatus = state.draft.groups[g]?.status;

                    return (
                      <div
                        key={g}
                        className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`w-7 h-7 rounded-lg font-mono text-xs font-bold flex items-center justify-center shrink-0 ${
                              draftedPlayer
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            {g}
                          </span>
                          {draftedPlayer ? (
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {draftedPlayer.name}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {draftedPlayer.role} · From Group {g}
                              </div>
                            </div>
                          ) : (
                            <div className="min-w-0">
                              <div className="text-sm text-slate-400 dark:text-slate-500 italic">
                                {groupStatus === 'revealing'
                                  ? 'Drawing card now...'
                                  : `Empty — Shuffle Group ${g} below`}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="text-xs font-mono text-slate-400 dark:text-slate-500 shrink-0">
                          {draftedPlayer ? 'ASSIGNED' : 'OPEN'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Group-by-Group Pool & Shuffle Controls (Groups A to G) */}
      <section aria-label="Performance Groups Pool">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Player Groups to Shuffle (Groups A to G · 3 Players Each)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Click the green <strong>Shuffle Group</strong> button on any row to randomly assign
              its 3 players across the 3 teams.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setSelectedGroupFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                selectedGroupFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Show All (A–G)
            </button>
            {ALL_GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setSelectedGroupFilter(g)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  selectedGroupFilter === g
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {visibleGroups.map((groupKey) => {
            const groupState = state.draft.groups[groupKey];
            const groupPlayers = state.players.filter((p) => p.group === groupKey);
            const isCompleted = groupState?.status === 'completed';
            const isRevealing = groupState?.status === 'revealing';

            return (
              <div
                key={groupKey}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl font-display font-bold text-lg flex items-center justify-center shrink-0 border ${
                        isCompleted
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {groupKey}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-slate-900 dark:text-white">
                          Group {groupKey}
                        </h4>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                          {GROUP_DESCRIPTIONS[groupKey]}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>3 Players</span>
                        <span>·</span>
                        <span>
                          Status:{' '}
                          <strong
                            className={
                              isCompleted
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }
                          >
                            {isRevealing
                              ? 'Revealing Cards Live...'
                              : isCompleted
                              ? 'Completed (Assigned to Teams)'
                              : 'Waiting to Shuffle'}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleShuffleClick(groupKey)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        isCompleted
                          ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                      }`}
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      <span>
                        {isCompleted
                          ? `Shuffle Group ${groupKey} Again`
                          : `Shuffle Group ${groupKey} Now`}
                      </span>
                    </button>

                    {isCompleted && (
                      <button
                        type="button"
                        onClick={() => handleResetGroup(groupKey)}
                        className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Undo Group</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 3 Player Cards in this Group */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  {groupPlayers.map((player) => {
                    const assignedTeam = state.teams.find(
                      (t) => t.id === player.assignedTeamId
                    );

                    return (
                      <div
                        key={player.id}
                        className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/90 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {player.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {player.role} · Group {player.group}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          {assignedTeam ? (
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>{assignedTeam.name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              Not Shuffled Yet
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Customize Captains, Players & Groups Modal */}
      {isCustomizingRoster && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Edit Team Names, 3 Captains & 21 Grouped Players (A–G)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Change any name, playing role, or group below and click Save Changes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomizingRoster(false)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveRosterChanges}
              className="p-6 overflow-y-auto space-y-6 flex-1"
            >
              {/* 3 Teams & Captains */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                  1. Team Names & 3 Team Captains
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {editTeams.map((team, idx) => (
                    <div
                      key={team.id}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3"
                    >
                      <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        TEAM 0{idx + 1}
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">
                          Team Name
                        </label>
                        <input
                          type="text"
                          required
                          value={team.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditTeams((prev) =>
                              prev.map((t) =>
                                t.id === team.id ? { ...t, name: val } : t
                              )
                            );
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-1">
                          <label className="block text-xs text-slate-500 mb-1">
                            Short Code
                          </label>
                          <input
                            type="text"
                            maxLength={4}
                            required
                            value={team.shortName}
                            onChange={(e) => {
                              const val = e.target.value.toUpperCase();
                              setEditTeams((prev) =>
                                prev.map((t) =>
                                  t.id === team.id ? { ...t, shortName: val } : t
                                )
                              );
                            }}
                            className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-white"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-slate-500 mb-1">
                            Captain Name
                          </label>
                          <input
                            type="text"
                            required
                            value={team.captainName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditTeams((prev) =>
                                prev.map((t) =>
                                  t.id === team.id ? { ...t, captainName: val } : t
                                )
                              );
                            }}
                            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 21 Players across Groups A to G */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  2. Grouped Players (21 Players across Groups A – G)
                </h4>

                {ALL_GROUPS.map((g) => {
                  const gPlayers = editPlayers.filter((p) => p.group === g);
                  return (
                    <div
                      key={g}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                    >
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3">
                        Group {g} · {GROUP_DESCRIPTIONS[g]}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {gPlayers.map((p) => (
                          <div
                            key={p.id}
                            className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2"
                          >
                            <input
                              type="text"
                              required
                              value={p.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditPlayers((prev) =>
                                  prev.map((item) =>
                                    item.id === p.id ? { ...item, name: val } : item
                                  )
                                );
                              }}
                              className="w-full px-2.5 py-1.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <select
                                value={p.role}
                                onChange={(e) => {
                                  const val = e.target.value as PlayerRole;
                                  setEditPlayers((prev) =>
                                    prev.map((item) =>
                                      item.id === p.id ? { ...item, role: val } : item
                                    )
                                  );
                                }}
                                className="px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300"
                              >
                                {ROLES.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={p.group}
                                onChange={(e) => {
                                  const val = e.target.value as GroupKey;
                                  setEditPlayers((prev) =>
                                    prev.map((item) =>
                                      item.id === p.id ? { ...item, group: val } : item
                                    )
                                  );
                                }}
                                className="px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300"
                              >
                                {ALL_GROUPS.map((grp) => (
                                  <option key={grp} value={grp}>
                                    Group {grp}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCustomizingRoster(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
