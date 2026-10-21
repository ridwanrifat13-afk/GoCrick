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

  useEffect(() => {
    if (!event) return;
    const isCelebrationType =
      event.type === 'SIX' ||
      event.type === 'FOUR' ||
      event.type === 'WICKET' ||
      event.type === 'DRAFT' ||
      event.type === 'MILESTONE' ||
      event.type === 'MATCH_RESULT';

    if (!isCelebrationType) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const width = (canvas.width = window.innerWidth);
    const height = (canvas.height = window.innerHeight);

    const particles: Particle[] = [];

    const spawnSixFireworks = () => {
      const burstCenters = [
        { x: width * 0.25, y: height * 0.28 },
        { x: width * 0.5, y: height * 0.22 },
        { x: width * 0.75, y: height * 0.28 },
        { x: width * 0.35, y: height * 0.4 },
        { x: width * 0.65, y: height * 0.4 },
      ];
      const colors = ['#F59E0B', '#FBBF24', '#FEF08A', '#10B981', '#38BDF8', '#FFFFFF'];

      burstCenters.forEach((center, idx) => {
        const count = 42;
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.2;
          const speed = 3 + Math.random() * 7 + (idx % 2) * 2;
          particles.push({
            x: center.x,
            y: center.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 3 + Math.random() * 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: 1,
            decay: 0.011 + Math.random() * 0.008,
            gravity: 0.12,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.2,
            shape: Math.random() > 0.35 ? 'circle' : 'rect',
          });
        }
      });
    };

    const spawnFourBoundaryWave = () => {
      const colors = ['#10B981', '#34D399', '#6EE7B7', '#0EA5E9', '#A7F3D0'];
      // Left and right turf boundary cannons + speed streaks
      for (let i = 0; i < 110; i++) {
        const fromLeft = i % 2 === 0;
        const startX = fromLeft ? width * 0.08 : width * 0.92;
        const startY = height * 0.55 + (Math.random() - 0.5) * (height * 0.35);
        const vx = (fromLeft ? 1 : -1) * (6 + Math.random() * 10);
        const vy = -4 - Math.random() * 6;
        particles.push({
          x: startX,
          y: startY,
          vx,
          vy,
          size: 4 + Math.random() * 5,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          decay: 0.012 + Math.random() * 0.008,
          gravity: 0.14,
          rotation: Math.atan2(vy, vx),
          rotationSpeed: 0,
          shape: i % 3 === 0 ? 'streak' : 'circle',
        });
      }
    };

    const spawnWicketShatter = () => {
      const cx = width * 0.5;
      const cy = height * 0.34;
      const colors = ['#F43F5E', '#FB7185', '#EF4444', '#F59E0B', '#FDE047', '#FFFFFF'];

      // Flying bails & stump splinters
      for (let i = 0; i < 120; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 11;
        particles.push({
          x: cx + (Math.random() - 0.5) * 40,
          y: cy + (Math.random() - 0.5) * 30,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2.5,
          size: i < 16 ? 8 + Math.random() * 6 : 3 + Math.random() * 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          decay: 0.011 + Math.random() * 0.009,
          gravity: 0.16,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.35,
          shape: i < 16 ? 'bail' : 'circle',
        });
      }
    };

    const spawnDraftConfetti = () => {
      // Team 1 Emerald, Team 2 Amber, Team 3 Sky Blue confetti shower
      const colors = ['#10B981', '#34D399', '#F59E0B', '#FBBF24', '#0EA5E9', '#38BDF8', '#FFFFFF'];
      const count = event.title.includes('Complete') ? 160 : 85;
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: -20 - Math.random() * (height * 0.35),
          vx: (Math.random() - 0.5) * 5,
          vy: 3 + Math.random() * 6,
          size: 5 + Math.random() * 6,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          decay: 0.006 + Math.random() * 0.005,
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
          ctx.fillRect(-p.size * 2.5, -1.5, p.size * 5, 3);
        } else if (p.shape === 'bail') {
          ctx.fillRect(-p.size * 1.4, -2.5, p.size * 2.8, 5);
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
  }, [event]);

  if (!event) return null;

  const isGroupComplete =
    event.type === 'DRAFT' && event.title.toLowerCase().includes('complete');

  const shouldShowCenterBanner =
    event.type === 'SIX' ||
    event.type === 'FOUR' ||
    event.type === 'WICKET' ||
    isGroupComplete ||
    event.type === 'MILESTONE' ||
    event.type === 'MATCH_RESULT';

  return (
    <div
      aria-live="assertive"
      className="fixed inset-0 z-50 pointer-events-none flex items-start justify-center pt-16 sm:pt-24 px-4 overflow-hidden"
    >
      {/* Full-Viewport Particle / Fireworks / Confetti Canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full pointer-events-none"
      />

      {/* Broadcast TV Celebration Banner */}
      <AnimatePresence mode="wait">
        {shouldShowCenterBanner && (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, scale: 0.72, y: -30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: -20 }}
            transition={{ type: 'spring', stiffness: 340, damping: 22 }}
            onClick={onDismiss}
            className={`pointer-events-auto relative cursor-pointer max-w-xl w-full rounded-3xl p-6 sm:p-7 shadow-2xl border-2 backdrop-blur-md overflow-hidden ${
              event.type === 'SIX'
                ? 'bg-slate-950/95 border-amber-400 text-white shadow-amber-500/25'
                : event.type === 'FOUR'
                ? 'bg-slate-950/95 border-emerald-400 text-white shadow-emerald-500/25'
                : event.type === 'WICKET'
                ? 'bg-slate-950/95 border-rose-500 text-white shadow-rose-500/30'
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
              className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 cursor-pointer"
              title="Dismiss overlay"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
              {/* Animated Broadcast Emblem */}
              {event.type === 'SIX' && (
                <motion.div
                  initial={{ rotate: -12, scale: 0.5 }}
                  animate={{ rotate: [0, -6, 6, 0], scale: [1, 1.12, 1] }}
                  transition={{ duration: 0.65 }}
                  className="w-24 h-24 rounded-2xl bg-amber-500 text-slate-950 font-display font-black text-6xl flex flex-col items-center justify-center shrink-0 shadow-lg border-2 border-amber-200"
                >
                  <span className="leading-none">6</span>
                  <span className="text-[10px] font-mono font-extrabold tracking-widest mt-0.5">
                    MAXIMUM
                  </span>
                </motion.div>
              )}

              {event.type === 'FOUR' && (
                <motion.div
                  initial={{ scale: 0.5 }}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.55 }}
                  className="w-24 h-24 rounded-2xl bg-emerald-500 text-slate-950 font-display font-black text-6xl flex flex-col items-center justify-center shrink-0 shadow-lg border-2 border-emerald-200"
                >
                  <span className="leading-none">4</span>
                  <span className="text-[10px] font-mono font-extrabold tracking-widest mt-0.5">
                    BOUNDARY
                  </span>
                </motion.div>
              )}

              {event.type === 'WICKET' && (
                <motion.div
                  initial={{ scale: 0.6 }}
                  animate={{
                    x: [0, -6, 6, -4, 4, 0],
                    scale: [1, 1.08, 1],
                  }}
                  transition={{ duration: 0.6 }}
                  className="w-24 h-24 rounded-2xl bg-rose-600 text-white flex flex-col items-center justify-center shrink-0 shadow-lg border-2 border-rose-300 relative overflow-hidden"
                >
                  {/* Animated Shattering Stumps SVG */}
                  <svg
                    viewBox="0 0 64 64"
                    className="w-14 h-14 stroke-current fill-none"
                    strokeWidth="4"
                    strokeLinecap="round"
                  >
                    {/* Flying Bails */}
                    <line x1="14" y1="12" x2="27" y2="7" className="stroke-amber-300" />
                    <line x1="36" y1="9" x2="50" y2="15" className="stroke-amber-300" />
                    {/* 3 Stumps (middle & off knocked back) */}
                    <line x1="18" y1="22" x2="18" y2="54" />
                    <line x1="32" y1="22" x2="38" y2="54" />
                    <line x1="46" y1="24" x2="54" y2="54" />
                  </svg>
                  <span className="text-[10px] font-mono font-extrabold tracking-widest">
                    OUT!
                  </span>
                </motion.div>
              )}

              {(isGroupComplete ||
                event.type === 'MILESTONE' ||
                event.type === 'MATCH_RESULT') && (
                <motion.div
                  initial={{ rotate: -10, scale: 0.6 }}
                  animate={{ rotate: 0, scale: 1 }}
                  className="w-20 h-20 rounded-2xl bg-emerald-500 text-slate-950 flex flex-col items-center justify-center shrink-0 shadow-lg border-2 border-emerald-200"
                >
                  {isGroupComplete ? (
                    <Sparkles className="w-10 h-10" />
                  ) : (
                    <Trophy className="w-10 h-10" />
                  )}
                  <span className="text-[9px] font-mono font-black tracking-wider mt-1">
                    {isGroupComplete ? 'SHUFFLED' : 'MILESTONE'}
                  </span>
                </motion.div>
              )}

              {/* Broadcast Details */}
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="inline-flex items-center gap-1.5 text-xs font-mono font-extrabold tracking-wider uppercase">
                  {event.type === 'SIX' && (
                    <span className="text-amber-400 flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5" /> STADIUM MAXIMUM · 6 RUNS
                    </span>
                  )}
                  {event.type === 'FOUR' && (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5" /> TURF BOUNDARY · 4 RUNS
                    </span>
                  )}
                  {event.type === 'WICKET' && (
                    <span className="text-rose-400 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" /> BOWLER STRIKES · WICKET!
                    </span>
                  )}
                  {isGroupComplete && (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> TEAM SHUFFLE COMPLETED
                    </span>
                  )}
                  {(event.type === 'MILESTONE' || event.type === 'MATCH_RESULT') && (
                    <span className="text-amber-400 flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5" /> TOURNAMENT HIGHLIGHT
                    </span>
                  )}
                </div>

                <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-tight">
                  {event.title}
                </h3>

                {isGroupComplete ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                    {event.message.split(' · ').map((assignment, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs font-semibold text-emerald-200 truncate"
                      >
                        {assignment}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {event.message}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
