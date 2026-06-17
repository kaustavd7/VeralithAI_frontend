import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import '../../styles/buddy.css';

/* Lith — a cute cartoon pebble that watches your traces. Phase 1: idle
   personality (bob, blink, cursor-tracking eyes, healing sparkle) + a click
   speech bubble. Phase 2 will turn the bubble into a real chat over the data. */

const LINES: ((name: string) => string)[] = [
  (n) => `Hey ${n}! 👋 I'm Lith — your pet rock for debugging.`,
  () => `I keep an eye on your traces while you work.`,
  () => `Soon you'll be able to ask me things like "what failed today?" or "what healed this week?"`,
  () => `Until then… I'll just be here. Being a rock. 🪨`,
];

export function Buddy() {
  const { user } = useAuth();
  const firstName = useMemo(() => {
    const meta = user?.user_metadata as Record<string, unknown> | undefined;
    const full = (meta?.['full_name'] as string | undefined) ?? (meta?.['name'] as string | undefined);
    const src = full || user?.email?.split('@')[0] || 'there';
    return src.split(/[\s.@]+/)[0].replace(/^\w/, (c) => c.toUpperCase());
  }, [user]);

  const [open, setOpen] = useState(false);
  const [line, setLine] = useState(0);
  const [sparkle, setSparkle] = useState(false);
  const [pop, setPop] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const pupilsRef = useRef<SVGGElement>(null);

  // Pupils drift toward the cursor — the "it's alive" trick.
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
        p.style.transform = `translate(${(dx / d) * max}px, ${(dy / d) * max}px)`;
      });
    }
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Occasional idle healing sparkle.
  useEffect(() => {
    let t = window.setTimeout(function tick() {
      setSparkle(true);
      window.setTimeout(() => setSparkle(false), 1050);
      t = window.setTimeout(tick, 9000 + Math.random() * 9000);
    }, 4000 + Math.random() * 4000);
    return () => window.clearTimeout(t);
  }, []);

  function onClick() {
    setPop(true);
    window.setTimeout(() => setPop(false), 400);
    if (!open) {
      setLine(0);
      setOpen(true);
      return;
    }
    setLine((l) => {
      const next = l + 1;
      if (next >= LINES.length) {
        setOpen(false);
        return 0;
      }
      return next;
    });
  }

  return (
    <div className="buddy-root">
      <button
        type="button"
        className={'buddy' + (pop ? ' is-pop' : '') + (open ? ' is-active' : '')}
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

          {/* pebble body */}
          <path
            className="buddy-body"
            d="M32 13 C44.5 13 53 21.5 53 33 C53 44.5 45 51 32 51 C19 51 11 44.5 11 33 C11 21.5 19.5 13 32 13 Z"
            fill="url(#buddyBody)"
            stroke="#7c8d6c"
            strokeWidth="1.4"
          />
          {/* glossy top highlight + a couple of stone specks */}
          <ellipse cx="30" cy="21" rx="13" ry="6" fill="#ffffff" opacity="0.16" />
          <circle cx="44" cy="25" r="1" fill="#7c8d6c" opacity="0.5" />
          <circle cx="17" cy="35" r="0.9" fill="#7c8d6c" opacity="0.45" />

          {/* rosy emerald cheeks */}
          <circle cx="18.5" cy="38" r="3.4" fill="url(#buddyCheek)" />
          <circle cx="45.5" cy="38" r="3.4" fill="url(#buddyCheek)" />

          {/* big cute eyes — white sclera + cursor-tracking pupils with a shine */}
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

          {/* little smile */}
          <path d="M28 40.5 q4 3.4 8 0" stroke="#3c4b3f" strokeWidth="1.7" fill="none" strokeLinecap="round" />

          {/* healing sparkle */}
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
