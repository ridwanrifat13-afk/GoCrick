import React from 'react';
import {
  Bell,
  X,
  Volume2,
  VolumeX,
  Trash2,
  ShieldAlert,
  Sparkles,
  Flame,
  Trophy,
  Info,
} from 'lucide-react';
import {
  TournamentNotification,
  NotificationCategory,
} from '../types/tournament';

interface NotificationCenterProps {
  notifications: TournamentNotification[];
  activeToast: TournamentNotification | null;
  onDismissToast: () => void;
  isOpen: boolean;
  onClose: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onClearAll: () => void;
}

function getCategoryStyle(type: NotificationCategory) {
  switch (type) {
    case 'WICKET':
      return {
        icon: ShieldAlert,
        accent: 'text-rose-500',
        border: 'border-rose-500/40',
        label: 'WICKET ALERT',
      };
    case 'SIX':
      return {
        icon: Flame,
        accent: 'text-amber-500',
        border: 'border-amber-500/40',
        label: 'MAXIMUM · SIX',
      };
    case 'FOUR':
      return {
        icon: Flame,
        accent: 'text-emerald-500',
        border: 'border-emerald-500/40',
        label: 'BOUNDARY · FOUR',
      };
    case 'DRAFT':
      return {
        icon: Sparkles,
        accent: 'text-emerald-400',
        border: 'border-emerald-500/40',
        label: 'LIVE DRAFT PICK',
      };
    case 'MILESTONE':
    case 'MATCH_RESULT':
      return {
        icon: Trophy,
        accent: 'text-amber-400',
        border: 'border-amber-500/40',
        label: 'TOURNAMENT MILESTONE',
      };
    default:
      return {
        icon: Info,
        accent: 'text-sky-400',
        border: 'border-sky-500/40',
        label: 'MATCH UPDATE',
      };
  }
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  activeToast,
  onDismissToast,
  isOpen,
  onClose,
  soundEnabled,
  onToggleSound,
  onClearAll,
}) => {
  // StadiumCelebrationOverlay renders the primary broadcast pop-up for SIX, FOUR, WICKET, DRAFT, MILESTONE, MATCH_RESULT.
  // Only render the bottom info toast for general INFO notifications so mobile screens never have duplicate pop-ups.
  const showInfoToast = activeToast && activeToast.type === 'INFO';

  return (
    <>
      {showInfoToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 inset-x-3 sm:left-auto sm:right-5 z-50 sm:max-w-sm sm:w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-2xl transition-all"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {getCategoryStyle(activeToast.type).label}
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white break-words">
                {activeToast.title}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words">
                {activeToast.message}
              </p>
            </div>
            <button
              type="button"
              onClick={onDismissToast}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Slide-Over Notification Feed Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end">
          <div className="bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-full sm:max-w-md h-dvh flex flex-col shadow-2xl">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Bell className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                  Live Match & Draft Updates
                </h3>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={onToggleSound}
                  className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1 cursor-pointer"
                  title="Toggle stadium audio alerts"
                >
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-400" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClearAll}
                  className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-rose-500 cursor-pointer"
                  title="Clear notifications"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  No match or draft notifications yet. Events like wickets, sixes, fours, and
                  group draft reveals appear here in real time.
                </div>
              ) : (
                notifications.map((item) => {
                  const st = getCategoryStyle(item.type);
                  const Icon = st.icon;
                  return (
                    <div
                      key={item.id}
                      className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-start gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className={`w-4 h-4 ${st.accent}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-mono text-slate-400">
                          {st.label}
                        </div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 break-words">
                          {item.title}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed break-words">
                          {item.message}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
