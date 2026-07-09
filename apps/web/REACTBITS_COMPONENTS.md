# React Bits — component plan for Veralith

Components picked from [reactbits.dev](https://reactbits.dev), planned against the
landing page (`apps/web/index.html`) and, where noted, the dashboard.

> **Porting note:** `apps/web` is a static `index.html` (no React). Each pick gets
> ported to vanilla JS/CSS — WebGL ones via three.js / raw shaders on a `<canvas>`.
> **Budget rules:** every effect behind `prefers-reduced-motion`; WebGL/canvas
> effects lazy-init and **pause when off-screen** (IntersectionObserver) and when
> the tab is hidden; at most **one WebGL effect rendering at a time**.
>
> **Source:** React Bits exposes a shadcn registry — component code can be pulled
> from `https://reactbits.dev/r/<Name>-JS-CSS` (or via the shadcn MCP:
> `npx shadcn@latest mcp init --client claude`, needs a session restart to load).
> We port the logic from there into vanilla.

Workflow: implement on localhost (`http://localhost:5175/`) → user reviews →
push only when told.

---

## Page map (landing) — where each core pick lives

```
NAV          ─ (keep clean — no effects)
HERO         ─ Light Rays ("side rays") backdrop, emerald, very low intensity
             ─ Gradient Text on one phrase of the h1 ("self-heal")
             ─ Card Swap: hero screenshots become an auto-swapping 3-shot stack
LOGOS STRIP  ─ Logo Loop: infinite marquee replacing the static row
LOOP SECTION ─ Gradual Blur at panel bottoms (upgrade current mask fades)
   (pinned)  ─ Dot Grid: faint pointer-reactive background behind the panels
MARQUEE BAND ─ Scroll Velocity: failure-cell names ribbon between sections
STATEMENT    ─ (keep the word-fill we built — already the star here)
PRICING      ─ Star Border on the highlighted Team card + "Try" pill
FINAL CTA    ─ Laser Flow behind "Stop shipping hallucinations. Make 'em grounded!"
FOOTER       ─ (keep clean)
```

---

## Tier 1 — core set (implement)

| # | Component | Placement | Why / how | Cost |
|---|---|---|---|---|
| 1 | **Logo Loop** | AI-stack logos strip | Direct upgrade: static row → seamless marquee, pause on hover. Pure CSS/JS | tiny |
| 2 | **Gradient Text** | One phrase in hero h1 + CTA heading | Animated emerald gradient on "self-heal" / "grounded" — brand accent, nothing else moves | tiny (CSS) |
| 3 | **Card Swap** | Hero screenshots | Replaces the static 2-shot overlap with an auto-swapping stack (overview → analytics → heals). Shows more product in the same space | small |
| 4 | **Star Border** | Pricing "Team" card + "Try Self-heal via MCP" pill | Rotating light along the border marks the recommended tier | tiny (CSS) |
| 5 | **Gradual Blur** | Bottoms of pinned loop panels; heal-diff fade | Progressive backdrop blur instead of plain opacity mask — subtle depth | tiny (CSS) |
| 6 | **Scroll Velocity** | New thin ribbon between loop and statement | `complete_grounded · incomplete_ungrounded · retrieval gap …` scrolling with scroll velocity — dev-tool flavor, on-brand data | small |
| 7 | **Light Rays** ("side rays") | Hero backdrop, top-down, emerald @ low opacity | The Linear-style "lit stage" upgrade of our hero-floor glow | WebGL ① |
| 8 | **Dot Grid** | Loop-section background | Faint dots that ripple near the pointer — depth without noise | canvas 2D |
| 9 | **Laser Flow** | Final CTA section only | The one "wow" moment, saved for the close. Renders only when scrolled to (Light Rays paused by then → still one WebGL live) | WebGL ② |

## Tier 2 — maybe (needs a new section or a decision)

| Component | Possible home | Note |
|---|---|---|
| Chroma Grid | A "capabilities" card grid (doesn't exist yet) | Only if we add a features-grid section |
| Grid Motion | "Wall of traces" band | Cool, but overlaps Scroll Velocity's job — pick one |
| Shape Blur | CTA panel hover | Competes with Laser Flow in the same section — Laser wins |
| Antigravity / Liquid Ether | Alternative hero backdrops | Both compete with Light Rays — Light Rays is the most Linear-like of the three; swap later if it feels flat |
| Fluid Glass | Nav bar lens | Very heavy (R3F 3D lens) for a nav; revisit post-launch |
| Cubes | 404 page | Fun easter egg, zero business value on the landing |

## Tier 3 — skip / consolidate

| Component | Verdict |
|---|---|
| Ghost Cursor, Blob Cursor, Image Trail, Meta Balls | All four are cursor-followers — mutually exclusive by definition, and global cursor effects read gimmicky on a b2b infra tool. Recommend **none** on the landing; if you want one, Ghost Cursor on the 404/playground only |
| Pixel Card | 8-bit pixelation clashes with the refined dark aesthetic |
| Line sidebar | Not sure which reactbits item this is (Staggered Menu? Gooey Nav?) — send the exact link |
| Scroll back | If this = scroll-to-top button: fine utility, add plain (no fancy effect needed). Send link if it's something else |

## Dashboard candidates (secondary)

| Component | Where | Why |
|---|---|---|
| Gradual Blur | Long trace tables / heal panel scroll edges | Signals "more content below" elegantly |
| Star Border | FREE-plan badge → Upgrade CTA | Draws the eye to the upgrade path |
| Dot Grid | Empty states (no traces yet) | Makes empty screens feel alive, not broken |
| Card Swap | Onboarding "what you'll get" preview | Rotates screenshots before first trace arrives |

---

## Status (accurate as of this session — supersedes the plan tables above)

**Live on the page now:**
| Component | Where | Notes |
|---|---|---|
| Gradient Text | "self-heal" (hero h1) + "grounded!" (closing CTA) | `.grad`, animated emerald flow |
| Spotlight Card | 2 hero screenshots **+** new AI-era card grid | cursor-tracked emerald glow (`--mouse-x/-y` + radial `::before`) |
| Laser Flow | big hero shot (`.shot-base`) | WebGL, three.js r0.160 CDN; shader verbatim from `/r/LaserFlow-JS-CSS`; `public/laserflow.js`; emerald tint |
| AI-era image section | new `#era` section before pricing | 3 Spotlight cards, open-license Unsplash imgs (`public/stock/*.jpg`) dark-duotone, brighten on hover |

**Tried and removed (user rejected):**
| Component | Verdict |
|---|---|
| Dot Field | removed from hero |
| Shape Blur | removed (user didn't like) |
| Logo Loop / Card Swap / Star Border / Gradual Blur / Scroll Velocity | were built, then reverted in the big revert; NOT currently on page |

**Not yet built:** Light Rays ("side rays") — user wanted to try it after Dot Field.

**Fixes:** hero-floor now fades in on load (1s delay) so the glow doesn't flash before content.

Stock images are **Unsplash license** (free commercial use, no attribution required):
`agents.jpg` = photo-1677442136019, `retrieval.jpg` = photo-1555949963, `hallucination.jpg` = photo-1635776062127.

All local only — not committed/pushed (per no-push rule).
