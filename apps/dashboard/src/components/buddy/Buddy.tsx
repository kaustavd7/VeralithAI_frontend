import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import '../../styles/buddy.css';

/* Lith — a cute cartoon pebble that roams the dashboard. He wanders to random
   spots, waddles, naps, hops, spins and mutters little thoughts so the screen
   feels alive. Hovering pauses him (so you can grab him); clicking opens a
   speech bubble. Phase 2 turns that bubble into a real chat over the data. */

type Action = 'idle' | 'walk' | 'jump' | 'spin' | 'sleep';

const LINES: ((name: string) => string)[] = [
  (n) => `Hey ${n}! 👋 I'm Lith — your pet rock for debugging.`,
  () => `I roam around keeping an eye on your traces.`,
  () => `Soon you'll be able to ask me things like "what failed today?" or "what healed this week?"`,
  () => `Until then… I'll just be here. Being a rock. 🪨`,
];
const QUIPS = ['hmm…', 'ooh ✨', 'rock solid', 'just vibing', '👀', 'all healthy', 'wandering…', '🪨'];

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;

export function Buddy() {
  const { user } = useAuth();
  const firstName = useMemo(() => {
    const meta = user?.user_metadata as Record<string, unknown> | undefined;
    const full = (meta?.['full_name'] as string | undefined) ?? (meta?.['name'] as string | undefined);
    const src = full || user?.email?.split('@')[0] || 'there';
    return src.split(/[\s.@]+/)[0].replace(/^\w/, (c) => c.toUpperCase());
  }, [user]);

  const [pos, setPos] = useState(() => ({ x: Math.max(40, window.innerWidth - 96), y: 86 }));
  const [walkMs, setWalkMs] = useState(2000);
  const [dir, setDir] = useState<1 | -1>(-1);
  const [action, setAction] = useState<Action>('idle');
  const [thought, setThought] = useState<string | null>(null);
  const [sparkle, setSparkle] = useState(false);
  const [pop, setPop] = useState(false);
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState(0);
  const [frozen, setFrozen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pupilsRef = useRef<SVGGElement>(null);
  const posRef = useRef(pos);
  const dirRef = useRef<1 | -1>(dir);
  const pausedRef = useRef(false);

  function moveTo(x: number, y: number) {
    posRef.current = { x, y };
    setPos({ x, y });
  }
  useEffect(() => { dirRef.current = dir; }, [dir]);
  useEffect(() => { pausedRef.current = open; }, [open]);

  // Pupils drift toward the cursor (countering the facing flip).
  useEffect(() => {
    let raf = 0;
    function onMove(e: MouseEvent) {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const svg = svgRef.current;
        const p = pupilsRef.current;
        if (!svg || !p) return;
        const r = svg.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy) || 1;
        const max = 2.1;
        p.style.transform = `translate(${(dx / d) * max * dirRef.current}px, ${(dy / d) * max}px)`;
      });
    }
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Roam engine — a self-scheduling behaviour loop.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let alive = true;
    let timer = 0;
    const wait = (ms: number, fn: () => void) => {
      timer = window.setTimeout(() => { if (alive) fn(); }, ms);
    };
    function bounds() {
      return {
        minX: 70,
        maxX: Math.max(120, window.innerWidth - 88),
        minY: 74,
        maxY: Math.max(140, window.innerHeight - 120),
      };
    }
    function step() {
      if (!alive) return;
      if (pausedRef.current) { wait(700, step); return; }
      const r = Math.random();
      if (r < 0.5) {
        // wander to a new spot
        const b = bounds();
        const tx = Math.round(rand(b.minX, b.maxX));
        const ty = Math.round(rand(b.minY, b.maxY));
        const dist = Math.hypot(tx - posRef.current.x, ty - posRef.current.y);
        const ms = Math.min(4200, Math.max(1300, dist * 6));
        setDir(tx < posRef.current.x ? -1 : 1);
        setWalkMs(ms);
        setAction('walk');
        moveTo(tx, ty);
        wait(ms + 150, () => { setAction('idle'); wait(rand(500, 1600), step); });
      } else if (r < 0.64) {
        setAction('jump');
        wait(640, () => { setAction('idle'); wait(rand(600, 1200), step); });
      } else if (r < 0.76) {
        setAction('spin');
        wait(820, () => { setAction('idle'); wait(rand(700, 1300), step); });
      } else if (r < 0.86) {
        setAction('sleep');
        setThought('Zzz');
        wait(3800, () => { setThought(null); setAction('idle'); wait(600, step); });
      } else if (r < 0.95) {
        setSparkle(true);
        setThought(pick(QUIPS));
        wait(1400, () => { setSparkle(false); setThought(null); wait(rand(700, 1400), step); });
      } else {
        setThought(pick(QUIPS));
        wait(1700, () => { setThought(null); wait(rand(600, 1200), step); });
      }
    }
    timer = window.setTimeout(step, 1600);
    return () => { alive = false; window.clearTimeout(timer); };
  }, []);

  function onEnter() {
    pausedRef.current = true;
    // Freeze where he currently is so he's grabbable.
    const el = rootRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      setFrozen(true);
      moveTo(rect.left, rect.top);
    }
    setAction('idle');
  }
  function onLeave() {
    setFrozen(false);
    pausedRef.current = open;
  }

  function onClick() {
    setPop(true);
    window.setTimeout(() => setPop(false), 400);
    setAction('idle');
    setThought(null);
    if (!open) {
      setLine(0);
      setOpen(true);
      return;
    }
    setLine((l) => {
      const n = l + 1;
      if (n >= LINES.length) { setOpen(false); return 0; }
      return n;
    });
  }

  return (
    <div
      className="buddy-root"
      ref={rootRef}
      style={{
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        transitionDuration: frozen ? '0ms' : walkMs + 'ms',
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {thought && <div className="buddy-thought">{thought}</div>}

      <button
        type="button"
        className={'buddy is-' + action + (pop ? ' is-pop' : '') + (open ? ' is-active' : '')}
        style={{ transform: `scaleX(${dir})` }}
        onClick={onClick}
        aria-label="Lith — your coding buddy"
        title="Lith"
      >
        <span className="buddy-shadow" aria-hidden="true" />
        <svg ref={svgRef} className="buddy-svg" width="58" height="58" viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="buddyBody" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c6d0b8" />
              <stop offset="100%" stopColor="#93a482" />
            </linearGradient>
            <radialGradient id="buddyCheek" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
            </radialGradient>
          </defs>

          <path
            className="buddy-body"
            d="M32 13 C44.5 13 53 21.5 53 33 C53 44.5 45 51 32 51 C19 51 11 44.5 11 33 C11 21.5 19.5 13 32 13 Z"
            fill="url(#buddyBody)"
            stroke="#7c8d6c"
            strokeWidth="1.4"
          />
          <ellipse cx="30" cy="21" rx="13" ry="6" fill="#ffffff" opacity="0.16" />
          <circle cx="44" cy="25" r="1" fill="#7c8d6c" opacity="0.5" />
          <circle cx="17" cy="35" r="0.9" fill="#7c8d6c" opacity="0.45" />

          <circle cx="18.5" cy="38" r="3.4" fill="url(#buddyCheek)" />
          <circle cx="45.5" cy="38" r="3.4" fill="url(#buddyCheek)" />

          <g className="buddy-eyes">
            <ellipse cx="24" cy="31" rx="4.4" ry="5" fill="#fbfdf8" />
            <ellipse cx="40" cy="31" rx="4.4" ry="5" fill="#fbfdf8" />
            <g className="buddy-pupils" ref={pupilsRef}>
              <circle cx="24" cy="31.5" r="2.3" fill="#27322a" />
              <circle cx="40" cy="31.5" r="2.3" fill="#27322a" />
              <circle cx="23.1" cy="30.4" r="0.85" fill="#ffffff" />
              <circle cx="39.1" cy="30.4" r="0.85" fill="#ffffff" />
            </g>
          </g>

          <path
            className="buddy-mouth"
            d="M28 40.5 q4 3.4 8 0"
            stroke="#3c4b3f"
            strokeWidth="1.7"
            fill="none"
            strokeLinecap="round"
          />

          {sparkle && (
            <path
              className="buddy-sparkle"
              d="M50 15 l1.3 3 3 1.3 -3 1.3 -1.3 3 -1.3 -3 -3 -1.3 3 -1.3 Z"
              fill="#34d399"
            />
          )}
        </svg>
      </button>

      {open && (
        <div className="buddy-bubble" role="status">
          <span className="buddy-bubble-tail" />
          <p className="buddy-bubble-text">{LINES[line](firstName)}</p>
          <div className="buddy-bubble-foot">
            <span className="buddy-bubble-hint">💬 Full chat coming soon</span>
            <span className="buddy-bubble-next">{line < LINES.length - 1 ? 'tap me →' : 'tap to close'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
