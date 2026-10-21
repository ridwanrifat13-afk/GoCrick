import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Flame, ShieldAlert, Trophy, X } from 'lucide-react';
import { TournamentNotification } from '../types/tournament';

interface StadiumCelebrationOverlayProps {
  event: TournamentNotification | null;
  onDismiss: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  gravity: number;
  rotation: number;
  rotationSpeed: number;
  shape: 'circle' | 'rect' | 'streak' | 'bail';
}

export const StadiumCelebrationOverlay: React.FC<StadiumCelebrationOverlayProps> = ({
  event,
  onDismiss,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isCelebrationEvent =
    !!event &&
    (event.type === 'SIX' ||
      event.type === 'FOUR' ||
      event.type === 'WICKET' ||
      event.type === 'DRAFT' ||
      event.type === 'MILESTONE' ||
      event.type === 'MATCH_RESULT');

  useEffect(() => {
    if (!event || !isCelebrationEvent) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const width = (canvas.width = window.innerWidth);
    const height = (canvas.height = window.innerHeight);
    const isMobile = width < 640;

    const particles: Particle[] = [];

    const spawnSixFireworks = () => {
      const burstCenters = isMobile
        ? [
            { x: width * 0.25, y: height * 0.22 },
            { x: width * 0.5, y: height * 0.18 },
            { x: width * 0.75, y: height * 0.22 },
          ]
        : [
            { x: width * 0.25, y: height * 0.28 },
            { x: width * 0.5, y: height * 0.22 },
            { x: width * 0.75, y: height * 0.28 },
            { x: width * 0.35, y: height * 0.4 },
            { x: width * 0.65, y: height * 0.4 },
          ];
      const colors = ['#F59E0B', '#FBBF24', '#FEF08A', '#10B981', '#38BDF8', '#FFFFFF'];

      burstCenters.forEach((center, idx) => {
        const count = isMobile ? 32 : 42;
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.2;
          const speed = (isMobile ? 2.5 : 3.5) + Math.random() * 6 + (idx % 2) * 1.5;
          particles.push({
            x: center.x,
            y: center.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 3 + Math.random() * 3.5,
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: 1,
            decay: 0.011 + Math.random() * 0.008,
            gravity: 0.11,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.2,
            shape: Math.random() > 0.35 ? 'circle' : 'rect',
          });
        }
      });
    };

    const spawnFourBoundaryWave = () => {
      const colors = ['#10B981', '#34D399', '#6EE7B7', '#0EA5E9', '#A7F3D0'];
      const total = isMobile ? 70 : 110;
      for (let i = 0; i < total; i++) {
        const fromLeft = i % 2 === 0;
        const startX = fromLeft ? width * 0.05 : width * 0.95;
        const startY = height * 0.45 + (Math.random() - 0.5) * (height * 0.35);
        const vx = (fromLeft ? 1 : -1) * (4 + Math.random() * 8);
        const vy = -3.5 - Math.random() * 5;
        particles.push({
          x: startX,
          y: startY,
          vx,
          vy,
          size: 3.5 + Math.random() * 4.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          decay: 0.012 + Math.random() * 0.008,
          gravity: 0.13,
          rotation: Math.atan2(vy, vx),
          rotationSpeed: 0,
          shape: i % 3 === 0 ? 'streak' : 'circle',
        });
      }
    };

    const spawnWicketShatter = () => {
      const cx = width * 0.5;
      const cy = height * 0.28;
      const colors = ['#F43F5E', '#FB7185', '#EF4444', '#F59E0B', '#FDE047', '#FFFFFF'];
      const total = isMobile ? 80 : 120;

      for (let i = 0; i < total; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * (isMobile ? 8 : 11);
        particles.push({
          x: cx + (Math.random() - 0.5) * 30,
          y: cy + (Math.random() - 0.5) * 24,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          size: i < 14 ? 7 + Math.random() * 5 : 3 + Math.random() * 3.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          decay: 0.011 + Math.random() * 0.009,
          gravity: 0.15,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.35,
          shape: i < 14 ? 'bail' : 'circle',
        });
      }
    };

    const spawnDraftConfetti = () => {
      const colors = ['#10B981', '#34D399', '#F59E0B', '#FBBF24', '#0EA5E9', '#38BDF8', '#FFFFFF'];
      const count = event.title.includes('Complete') ? (isMobile ? 95 : 150) : isMobile ? 55 : 85;
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: -15 - Math.random() * (height * 0.25),
          vx: (Math.random() - 0.5) * 4,
          vy: 2.5 + Math.random() * 5,
          size: 4.5 + Math.random() * 5,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          decay: 0.007 + Math.random() * 0.005,
          gravity: 0.06,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.22,
          shape: 'rect',
        });
      }
    };

    if (event.type === 'SIX') {
      spawnSixFireworks();
    } else if (event.type === 'FOUR') {
      spawnFourBoundaryWave();
    } else if (event.type === 'WICKET') {
      spawnWicketShatter();
    } else {
      spawnDraftConfetti();
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      let activeCount = 0;

      for (const p of particles) {
        if (p.alpha <= 0.01) continue;
        activeCount++;

        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.rotation += p.rotationSpeed;
        p.alpha = Math.max(0, p.alpha - p.decay);

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;

        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'streak') {
          ctx.fillRect(-p.size * 2.2, -1.5, p.size * 4.4, 3);
        } else if (p.shape === 'bail') {
          ctx.fillRect(-p.size * 1.3, -2, p.size * 2.6, 4);
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
        }

        ctx.restore();
      }

      if (activeCount > 0) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [event, isCelebrationEvent]);

  const isGroupComplete =
    !!event && event.type === 'DRAFT' && event.title.toLowerCase().includes('complete');

  return (
    <div
      aria-live="assertive"
      className="fixed inset-0 z-50 pointer-events-none flex items-start justify-center pt-14 sm:pt-20 px-3 sm:px-4 overflow-hidden"
    >
      {/* Full-Viewport Particle / Fireworks / Confetti Canvas */}
      {isCelebrationEvent && (
        <canvas
          ref={canvasRef}
          className="fixed inset-0 w-full h-full pointer-events-none"
        />
      )}

      {/* Mobile-Optimized Broadcast Celebration Pop-up Card */}
      <AnimatePresence mode="wait">
        {event && isCelebrationEvent && (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, scale: 0.85, y: -24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -16 }}
            transition={{ type: 'spring', stiffness: 360, damping: 24 }}
            onClick={onDismiss}
            className={`pointer-events-auto relative cursor-pointer w-full max-w-lg max-h-[82dvh] overflow-y-auto rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl border-2 backdrop-blur-md ${
              event.type === 'SIX'
                ? 'bg-slate-950/95 border-amber-400 text-white shadow-amber-500/30'
                : event.type === 'FOUR'
                ? 'bg-slate-950/95 border-emerald-400 text-white shadow-emerald-500/30'
                : event.type === 'WICKET'
                ? 'bg-slate-950/95 border-rose-500 text-white shadow-rose-500/35'
                : 'bg-slate-950/95 border-emerald-400 text-white shadow-emerald-500/25'
            }`}
          >
            {/* Dismiss button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 cursor-pointer z-10"
              title="Dismiss overlay"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start sm:items-center gap-3.5 sm:gap-5 pr-6">
              {/* Compact Mobile-Safe Animated Broadcast Emblem */}
              {event.type === 'SIX' && (
                <motion.div
                  initial={{ rotate: -12, scale: 0.5 }}
                  animate={{ rotate: [0, -6, 6, 0], scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.6 }}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-amber-500 text-slate-950 font-display font-black text-4xl sm:text-5xl flex flex-col items-center justify-center shrink-0 shadow-lg border-2 border-amber-200"
                >
                  <span className="leading-none">6</span>
                  <span className="text-[8px] sm:text-[10px] font-mono font-extrabold tracking-widest mt-0.5">
                    MAXIMUM
                  </span>
                </motion.div>
              )}

              {event.type === 'FOUR' && (
                <motion.div
                  initial={{ scale: 0.5 }}
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 0.5 }}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-emerald-500 text-slate-950 font-display font-black text-4xl sm:text-5xl flex flex-col items-center justify-center shrink-0 shadow-lg border-2 border-emerald-200"
                >
                  <span className="leading-none">4</span>
                  <span className="text-[8px] sm:text-[10px] font-mono font-extrabold tracking-widest mt-0.5">
                    BOUNDARY
                  </span>
                </motion.div>
              )}

              {event.type === 'WICKET' && (
                <motion.div
                  initial={{ scale: 0.6 }}
                  animate={{
                    x: [0, -5, 5, -3, 3, 0],
                    scale: [1, 1.08, 1],
                  }}
                  transition={{ duration: 0.55 }}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-rose-600 text-white flex flex-col items-center justify-center shrink-0 shadow-lg border-2 border-rose-300 relative overflow-hidden"
                >
                  <svg
                    viewBox="0 0 64 64"
                    className="w-10 h-10 sm:w-12 sm:h-12 stroke-current fill-none"
                    strokeWidth="4"
                    strokeLinecap="round"
                  >
                    <line x1="14" y1="12" x2="27" y2="7" className="stroke-amber-300" />
                    <line x1="36" y1="9" x2="50" y2="15" className="stroke-amber-300" />
                    <line x1="18" y1="22" x2="18" y2="54" />
                    <line x1="32" y1="22" x2="38" y2="54" />
                    <line x1="46" y1="24" x2="54" y2="54" />
                  </svg>
                  <span className="text-[8px] sm:text-[10px] font-mono font-extrabold tracking-widest">
                    OUT!
                  </span>
                </motion.div>
              )}

              {(event.type === 'DRAFT' ||
                event.type === 'MILESTONE' ||
                event.type === 'MATCH_RESULT') && (
                <motion.div
                  initial={{ rotate: -8, scale: 0.6 }}
                  animate={{ rotate: 0, scale: 1 }}
                  className="w-14 h-14 sm:w-18 sm:h-18 rounded-2xl bg-emerald-500 text-slate-950 flex flex-col items-center justify-center shrink-0 shadow-lg border-2 border-emerald-200"
                >
                  {event.type === 'DRAFT' ? (
                    <Sparkles className="w-7 h-7 sm:w-9 sm:h-9" />
                  ) : (
                    <Trophy className="w-7 h-7 sm:w-9 sm:h-9" />
                  )}
                  <span className="text-[8px] sm:text-[9px] font-mono font-black tracking-wider mt-0.5">
                    {isGroupComplete ? 'SHUFFLED' : event.type === 'DRAFT' ? 'PICKED' : 'HIGHLIGHT'}
                  </span>
                </motion.div>
              )}

              {/* Broadcast Details (Full Wrapping on Mobile — Never Truncated) */}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-mono font-extrabold tracking-wider uppercase">
                  {event.type === 'SIX' && (
                    <span className="text-amber-400 flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 shrink-0" /> STADIUM MAXIMUM · 6 RUNS
                    </span>
                  )}
                  {event.type === 'FOUR' && (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 shrink-0" /> TURF BOUNDARY · 4 RUNS
                    </span>
                  )}
                  {event.type === 'WICKET' && (
                    <span className="text-rose-400 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0" /> BOWLER STRIKES · WICKET!
                    </span>
                  )}
                  {event.type === 'DRAFT' && (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />{' '}
                      {isGroupComplete ? 'TEAM SHUFFLE COMPLETED' : 'LIVE DRAFT CARD REVEAL'}
                    </span>
                  )}
                  {(event.type === 'MILESTONE' || event.type === 'MATCH_RESULT') && (
                    <span className="text-amber-400 flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5 shrink-0" /> TOURNAMENT HIGHLIGHT
                    </span>
                  )}
                </div>

                <h3 className="text-base sm:text-xl font-extrabold tracking-tight text-white leading-snug break-words">
                  {event.title}
                </h3>

                {!isGroupComplete && (
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed break-words">
                    {event.message}
                  </p>
                )}
              </div>
            </div>

            {/* Full-Width Uncropped Team Assignments for Completed Group Shuffle */}
            {isGroupComplete && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3.5 pt-3 border-t border-white/15">
                {event.message.split(' · ').map((assignment, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs font-semibold text-emerald-200 break-words leading-snug"
                  >
                    {assignment}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
