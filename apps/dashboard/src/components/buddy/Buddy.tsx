import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import '../../styles/buddy.css';

/* Lith — a cute cartoon pebble that lives at the edge of the screen. He patrols
   his column vertically (so he never drifts across your content), with idle
   antics: hop, spin, nap, sparkle, little thoughts, and cursor-tracking eyes.
   You can grab and drag him anywhere; clicking opens a speech bubble. Phase 2
   turns that bubble into a real chat over the trace/heal data. */

type Action = 'idle' | 'walk' | 'jump' | 'spin' | 'sleep';

const LINES: ((name: string) => string)[] = [
  (n) => `Hey ${n}! 👋 I'm Lith — your pet rock for debugging.`,
  () => `I hang out on the edge, keeping an eye on your traces.`,
  () => `Soon you'll be able to ask me things like "what failed today?" or "what healed this week?"`,
  () => `Drag me anywhere you like. Until then… I'll just be a rock. 🪨`,
];
const QUIPS = ['hmm…', 'ooh ✨', 'rock solid', 'just vibing', '👀', 'all healthy', '🪨'];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;

type Expr = 'smile' | 'happy' | 'grin' | 'surprised' | 'sleep';

/* Lith's mouth changes with his mood so he isn't perma-smiling. */
function Mouth({ expr }: { expr: Expr }) {
  if (expr === 'surprised') return <ellipse cx="32" cy="41.6" rx="2.1" ry="2.6" fill="#3c4b3f" />;
  if (expr === 'grin') return <path d="M26.8 39.6 Q32 46.6 37.2 39.6 Q32 41.9 26.8 39.6 Z" fill="#3c4b3f" />;
  if (expr === 'sleep')
    return <path d="M30 41.3 q2 1.5 4 0" stroke="#3c4b3f" strokeWidth="1.5" fill="none" strokeLinecap="round" />;
  if (expr === 'happy')
    return <path d="M27.3 40 q4.7 4.4 9.4 0" stroke="#3c4b3f" strokeWidth="1.7" fill="none" strokeLinecap="round" />;
  return <path d="M28 40.5 q4 3.4 8 0" stroke="#3c4b3f" strokeWidth="1.7" fill="none" strokeLinecap="round" />;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
function computeBounds() {
  return {
    minX: 66,
    maxX: Math.max(120, window.innerWidth - 66),
    minY: 74,
    maxY: Math.max(150, window.innerHeight - 118),
  };
}

export function Buddy() {
  const { user } = useAuth();
  const firstName = useMemo(() => {
    const meta = user?.user_metadata as Record<string, unknown> | undefined;
    const full = (meta?.['full_name'] as string | undefined) ?? (meta?.['name'] as string | undefined);
    const src = full || user?.email?.split('@')[0] || 'there';
    return src.split(/[\s.@]+/)[0].replace(/^\w/, (c) => c.toUpperCase());
  }, [user]);

  const initial = useMemo(() => {
    const b = computeBounds();
    return { x: b.maxX, y: 120 };
  }, []);

  const [pos, setPos] = useState(initial);
  const [walkMs, setWalkMs] = useState(1600);
  const [dir, setDir] = useState<1 | -1>(-1);
  const [action, setAction] = useState<Action>('idle');
  const [thought, setThought] = useState<string | null>(null);
  const [sparkle, setSparkle] = useState(false);
  const [pop, setPop] = useState(false);
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState(0);
  const [frozen, setFrozen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [lean, setLean] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pupilsRef = useRef<SVGGElement>(null);
  const posRef = useRef(initial);
  const dirRef = useRef<1 | -1>(-1);
  const laneXRef = useRef(initial.x);
  const pausedRef = useRef(false);
  const dragRef = useRef<{ ox: number; oy: number; sx: number; sy: number; moved: boolean } | null>(null);

  function moveTo(x: number, y: number) {
    posRef.current = { x, y };
    setPos({ x, y });
  }
  useEffect(() => { dirRef.current = dir; }, [dir]);
  useEffect(() => { pausedRef.current = open; }, [open]);

  // Click-outside / Esc closes the bubble.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

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

  // Keep him on-screen when the window resizes.
  useEffect(() => {
    function onResize() {
      const b = computeBounds();
      laneXRef.current = clamp(laneXRef.current, b.minX, b.maxX);
      moveTo(clamp(posRef.current.x, b.minX, b.maxX), clamp(posRef.current.y, b.minY, b.maxY));
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Scroll knocks him off-balance (tilt by scroll velocity) + a slight haze,
  // springing back when you stop. Capture catches the inner .shell-main scroller.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let lastTop = 0;
    let lastTarget: EventTarget | null = null;
    let reset = 0;
    function onScroll(e: Event) {
      const t = e.target as Document | Element;
      const top = t === document ? window.scrollY : (t as Element).scrollTop ?? 0;
      if (t !== lastTarget) { lastTarget = t; lastTop = top; return; }
      const delta = top - lastTop;
      lastTop = top;
      if (!delta) return;
      setLean(clamp(delta * 0.5, -16, 16));
      window.clearTimeout(reset);
      reset = window.setTimeout(() => setLean(0), 150);
    }
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('scroll', onScroll, true);
      window.clearTimeout(reset);
    };
  }, []);

  // Roam engine — vertical-only patrol within his lane, plus idle antics.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let alive = true;
    let timer = 0;
    const wait = (ms: number, fn: () => void) => {
      timer = window.setTimeout(() => { if (alive) fn(); }, ms);
    };
    function step() {
      if (!alive) return;
      if (pausedRef.current) { wait(700, step); return; }
      const r = Math.random();
      if (r < 0.34) {
        // short vertical shuffle along the lane (never sideways over content)
        const b = computeBounds();
        const ty = Math.round(clamp(posRef.current.y + rand(-150, 150), b.minY, b.maxY));
        setDir(laneXRef.current > window.innerWidth / 2 ? -1 : 1);
        const dist = Math.abs(ty - posRef.current.y);
        const ms = clamp(dist * 8, 700, 2600);
        setWalkMs(ms);
        setAction('walk');
        moveTo(laneXRef.current, ty);
        wait(ms + 150, () => { setAction('idle'); wait(rand(1200, 2800), step); });
      } else if (r < 0.48) {
        setAction('jump');
        wait(640, () => { setAction('idle'); wait(rand(1200, 2200), step); });
      } else if (r < 0.6) {
        setAction('spin');
        wait(820, () => { setAction('idle'); wait(rand(1400, 2400), step); });
      } else if (r < 0.74) {
        setAction('sleep');
        setThought('Zzz');
        wait(4200, () => { setThought(null); setAction('idle'); wait(800, step); });
      } else if (r < 0.88) {
        setSparkle(true);
        setThought(pick(QUIPS));
        wait(1400, () => { setSparkle(false); setThought(null); wait(rand(1400, 2400), step); });
      } else {
        setThought(pick(QUIPS));
        wait(1700, () => { setThought(null); wait(rand(1200, 2200), step); });
      }
    }
    timer = window.setTimeout(step, 1800);
    return () => { alive = false; window.clearTimeout(timer); };
  }, []);

  function handleClick() {
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

  // ── drag to reposition ────────────────────────────────────────────────
  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pausedRef.current = true;
    setFrozen(true);
    setAction('idle');
    const rect = rootRef.current?.getBoundingClientRect();
    const left = rect?.left ?? posRef.current.x;
    const top = rect?.top ?? posRef.current.y;
    moveTo(left, top);
    dragRef.current = { ox: e.clientX - left, oy: e.clientY - top, sx: e.clientX, sy: e.clientY, moved: false };
  }
  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4) {
      d.moved = true;
      setDragging(true);
    }
    if (d.moved) {
      const b = computeBounds();
      moveTo(clamp(e.clientX - d.ox, b.minX, b.maxX), clamp(e.clientY - d.oy, b.minY, b.maxY));
    }
  }
  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    setFrozen(false);
    if (d && d.moved) {
      setDragging(false);
      laneXRef.current = posRef.current.x; // new home column
      setDir(posRef.current.x > window.innerWidth / 2 ? -1 : 1);
      pausedRef.current = open;
    } else {
      handleClick();
    }
  }

  // Open the bubble toward the screen interior so it never overflows the edge.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const bubbleSide = pos.x + 29 > vw / 2 ? 'left' : 'right';
  const bubbleV = pos.y + 29 < vh / 2 ? 'top' : 'bottom';
  const blurPx = Math.min(1.3, Math.abs(lean) / 9);
  const expression: Expr =
    action === 'sleep'
      ? 'sleep'
      : Math.abs(lean) > 6
        ? 'surprised'
        : action === 'jump' || action === 'spin'
          ? 'grin'
          : sparkle
            ? 'happy'
            : 'smile';

  return (
    <div
      className="buddy-root"
      ref={rootRef}
      style={{
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        transitionDuration: frozen ? '0ms' : walkMs + 'ms',
      }}
    >
      {thought && <div className="buddy-thought">{thought}</div>}

      <button
        type="button"
        className={
          'buddy is-' + action + (pop ? ' is-pop' : '') + (open ? ' is-active' : '') + (dragging ? ' is-drag' : '')
        }
        style={{ transform: `scaleX(${dir})` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        aria-label="Lith — your coding buddy (drag to move)"
        title="Lith — drag me!"
      >
        <span
          className="buddy-stage"
          style={{
            transform: `rotate(${lean.toFixed(2)}deg)`,
            filter: blurPx > 0.05 ? `blur(${blurPx.toFixed(2)}px)` : undefined,
          }}
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

          <Mouth expr={expression} />

          {sparkle && (
            <path
              className="buddy-sparkle"
              d="M50 15 l1.3 3 3 1.3 -3 1.3 -1.3 3 -1.3 -3 -3 -1.3 3 -1.3 Z"
              fill="#34d399"
            />
          )}
        </svg>
        </span>
      </button>

      {open && (
        <div className={'buddy-bubble to-' + bubbleSide + ' v-' + bubbleV} role="status">
          <span className="buddy-bubble-tail" />
          <p className="buddy-bubble-text">{LINES[line](firstName)}</p>
          <div className="buddy-bubble-foot">
            <span className="buddy-bubble-hint">💬 Full chat coming soon</span>
          </div>
        </div>
      )}
    </div>
  );
}
