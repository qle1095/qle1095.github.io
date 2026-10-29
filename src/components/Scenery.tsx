import { cloneElement, memo, type CSSProperties, type ReactElement } from 'react';
import type { JourneyLayout } from '../lib/layout';

// Flat-illustration parallax scenery. Each era is built from three silhouette
// depths in its own tones (far ridge → mid skyline → near props), plus one or
// two landmarks that say where we are:
//   sunrise   — campus clock tower, halls, palms (FIU)
//   bank      — glass towers and a spire (generic, no logos)
//   ascent    — mountains, a radar dome on the ridge, pines
//   platform  — a data-centre campus with radomes and masts
//   frontier  — a night city with a holographic shield
// Colours come from CSS variables set per era (`.era-<theme>` in styles.css),
// so an era keeps its own palette while it cross-fades out. Placement is
// seeded: same world every load.

export type Band = 'far' | 'mid' | 'near';

// Each era is drawn over the whole range of layer-x that can be on screen
// while its chapter is active, so the cross-fade never reveals a gap. That
// range depends on where the character stands and on the viewport width, so
// it is padded for anything from a phone up to a 2600px-wide window.
// The scenery is composed in UI-scale-1 px (these constants, every prop size
// below) and the layer then scales positions and SVG sizes by layout.scale,
// so the seeded world is identical at every scale, just larger. The SVGs
// keep their viewBox, so they stay vector-sharp.
const C_REF = 504; // character x on a 1440px window
const PAD_BEFORE = 420;
const VW_MAX = 2600;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;

// Fills and strokes resolve against the era's palette variables.
const fill = (v: string, opacity?: number): CSSProperties => ({ fill: `var(--${v})`, opacity });
const stroke = (v: string, width: number, opacity?: number): CSSProperties => ({
  fill: 'none',
  stroke: `var(--${v})`,
  strokeWidth: width,
  opacity,
});

/* ---------- sky ---------- */

const Sun = (r: number) => (
  <svg width={r * 4} height={r * 4} viewBox="-2 -2 4 4">
    <circle r="1.9" style={fill('sun', 0.18)} />
    <circle r="1.35" style={fill('sun', 0.3)} />
    <circle r="0.95" style={fill('sun')} />
  </svg>
);

const Moon = (r: number) => (
  <svg width={r * 4} height={r * 4} viewBox="-2 -2 4 4">
    <circle r="1.8" fill="#dfe3ff" opacity="0.08" />
    <circle r="1.25" fill="#dfe3ff" opacity="0.12" />
    <circle r="0.9" fill="#eef0ff" />
    <circle cx="-0.28" cy="-0.2" r="0.16" fill="#d6d9f2" />
    <circle cx="0.3" cy="0.25" r="0.11" fill="#d6d9f2" />
  </svg>
);

const Cloud = (w: number, r: Rand) => {
  const a = 0.35 + r() * 0.2;
  return (
    <svg width={w} height={w * 0.34} viewBox="0 0 100 34">
      <path
        d={`M8 30 Q2 30 4 24 Q6 18 16 20 Q${18 + a * 10} 6 36 10 Q46 0 60 8 Q74 4 78 16 Q94 14 96 24 Q98 30 90 30 Z`}
        style={fill('cloud')}
      />
    </svg>
  );
};

const StarField = (w: number, h: number, n: number, r: Rand) => (
  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
    {Array.from({ length: n }, (_, i) => (
      <circle
        key={i}
        cx={r() * w}
        cy={r() * h}
        r={0.7 + r() * 1.3}
        fill="#fff"
        opacity={0.35 + r() * 0.55}
      />
    ))}
  </svg>
);

/* ---------- far ridges (one continuous silhouette per era) ---------- */

type RidgeShape = 'roll' | 'peaks' | 'blocks' | 'city';

function Ridge(w: number, h: number, shape: RidgeShape, r: Rand) {
  const extras: ReactElement[] = [];
  let d = `M0 ${h}`;
  if (shape === 'roll') {
    const step = 260;
    let prev = [0, h * (0.35 + r() * 0.3)];
    d += ` L0 ${prev[1]}`;
    for (let x = step; x <= w + step; x += step) {
      const y = h * (0.2 + r() * 0.5);
      d += ` Q${prev[0] + step / 2} ${(prev[1] + y) / 2 - h * 0.12} ${x} ${y}`;
      prev = [x, y];
    }
  } else if (shape === 'peaks') {
    let x = 0;
    d += ` L0 ${h * 0.6}`;
    while (x < w + 200) {
      const half = 110 + r() * 120;
      const peakY = h * (0.05 + r() * 0.4);
      const px = x + half;
      d += ` L${px} ${peakY} L${px + half} ${h * (0.5 + r() * 0.25)}`;
      // Snow cap: a notched triangle hugging the summit.
      const cw = half * 0.32;
      const ch = cw * ((h * 0.6 - peakY) / half) * 1.2;
      extras.push(
        <path
          key={px}
          d={`M${px} ${peakY} L${px + cw} ${peakY + ch} L${px + cw * 0.4} ${peakY + ch * 0.75} L${px - cw * 0.15} ${peakY + ch * 1.05} L${px - cw * 0.6} ${peakY + ch * 0.7} Z`}
          style={fill('lite', 0.75)}
        />,
      );
      x = px + half;
    }
  } else {
    // Skyline: flat-topped blocks, the odd stepped crown or antenna.
    let x = 0;
    while (x < w) {
      const bw = 36 + r() * 80;
      const bh = h * (0.25 + r() * 0.7);
      const top = h - bh;
      d += ` L${x} ${top}`;
      if (r() > 0.75) {
        d += ` L${x + bw * 0.3} ${top} L${x + bw * 0.3} ${top - 14} L${x + bw * 0.7} ${top - 14} L${x + bw * 0.7} ${top}`;
      }
      if (r() > 0.85) {
        d += ` L${x + bw * 0.48} ${top} L${x + bw * 0.5} ${top - 34} L${x + bw * 0.52} ${top}`;
      }
      d += ` L${x + bw} ${top}`;
      if (shape === 'city') {
        for (let wy = top + 10; wy < h - 10; wy += 16)
          for (let wx = x + 8; wx < x + bw - 10; wx += 14)
            if (r() > 0.86)
              extras.push(
                <rect key={`${wx}-${wy}`} x={wx} y={wy} width="5" height="6" rx="1" style={fill('era-accent', 0.35)} />,
              );
      }
      x += bw;
    }
  }
  d += ` L${w} ${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={d} style={fill('far')} />
      {extras}
    </svg>
  );
}

/* ---------- mid & near props ---------- */

const Hill = (w: number, h: number, tone: string) => (
  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
    <ellipse cx={w / 2} cy={h * 1.1} rx={w / 2} ry={h * 1.05} style={fill(tone)} />
  </svg>
);

// Sunrise / campus
const ClockTower = (h: number) => (
  <svg width={h * 0.36} height={h} viewBox="0 0 36 100">
    <path d="M18 0 L28 18 L8 18 Z" style={fill('mid')} />
    <rect x="9" y="18" width="18" height="82" style={fill('mid')} />
    <rect x="6" y="30" width="24" height="5" style={fill('mid')} />
    <circle cx="18" cy="26" r="4.2" style={fill('lite', 0.85)} />
    {[44, 58, 72].map((y) => (
      <rect key={y} x="15" y={y} width="6" height="8" rx="3" style={fill('lite', 0.5)} />
    ))}
  </svg>
);

const Hall = (w: number, r: Rand) => {
  const pitched = r() > 0.5;
  const cols = 4 + Math.floor(r() * 3);
  return (
    <svg width={w} height={w * 0.46} viewBox="0 0 100 46">
      {pitched ? (
        <path d="M4 16 L50 4 L96 16 Z" style={fill('mid')} />
      ) : (
        <rect x="30" y="6" width="40" height="10" style={fill('mid')} />
      )}
      <rect x="6" y="16" width="88" height="30" style={fill('mid')} />
      {Array.from({ length: cols }, (_, i) => (
        <rect
          key={i}
          x={12 + (i * 76) / cols}
          y="22"
          width={42 / cols}
          height="14"
          rx="1.5"
          style={fill('lite', 0.45)}
        />
      ))}
    </svg>
  );
};

const Palm = (h: number, tone: string, r: Rand) => {
  const lean = (r() - 0.5) * 22;
  const tx = 50 + lean;
  const ty = 24;
  return (
    <svg width={h * 0.8} height={h} viewBox="0 0 100 125" overflow="visible">
      <path d={`M50 125 Q${50 + lean * 0.15} 70 ${tx} ${ty}`} style={stroke(tone, 5.5)} strokeLinecap="round" />
      {[-158, -122, -84, -48, -12, 22].map((a) => (
        <path
          key={a}
          d="M0 0 Q18 -12 42 -3 Q30 0 22 2 Q12 3 0 0 Z"
          style={fill(tone)}
          transform={`translate(${tx} ${ty}) rotate(${a + (r() - 0.5) * 12})`}
        />
      ))}
    </svg>
  );
};

// Bank / glass towers
const GlassTower = (w: number, h: number, r: Rand) => {
  const crown = r();
  const floors = Math.floor(h / 14);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <rect x="0" y={crown > 0.6 ? 12 : 0} width={w} height={h} style={fill('mid')} />
      {crown > 0.6 && <rect x={w * 0.2} y="0" width={w * 0.6} height="13" style={fill('mid')} />}
      {/* Lit facet: the sun catches one face of the glass. */}
      <rect x={w * 0.62} y={crown > 0.6 ? 12 : 0} width={w * 0.38} height={h} style={fill('lite', 0.28)} />
      {Array.from({ length: floors }, (_, i) => (
        <rect key={i} x="0" y={20 + i * 14} width={w} height="1.2" style={fill('lite', 0.22)} />
      ))}
    </svg>
  );
};

const SpireTower = (h: number) => (
  <svg width={h * 0.3} height={h} viewBox="0 0 30 100">
    <rect x="14.2" y="0" width="1.6" height="14" style={fill('mid')} />
    <path d="M9 14 L21 14 L23 24 L7 24 Z" style={fill('mid')} />
    <rect x="5" y="24" width="20" height="14" style={fill('mid')} />
    <rect x="2" y="38" width="26" height="62" style={fill('mid')} />
    <rect x="18" y="24" width="7" height="76" style={fill('lite', 0.28)} />
    {Array.from({ length: 12 }, (_, i) => (
      <rect key={i} x="2" y={42 + i * 4.8} width="26" height="0.8" style={fill('lite', 0.25)} />
    ))}
  </svg>
);

// A clipped street tree: a short trunk under a cluster of three canopies.
const RoundTree = (h: number, tone: string) => (
  <svg width={h * 0.7} height={h} viewBox="0 0 70 100">
    <rect x="33" y="62" width="4.5" height="38" rx="2" style={fill(tone)} />
    <circle cx="23" cy="56" r="16" style={fill(tone)} />
    <circle cx="47" cy="54" r="17" style={fill(tone)} />
    <circle cx="35" cy="38" r="20" style={fill(tone)} />
  </svg>
);

const Lamp = (h: number, tone: string) => (
  <svg width={h * 0.3} height={h} viewBox="0 0 30 100">
    <rect x="13.5" y="10" width="3" height="90" style={fill(tone)} />
    <path d="M15 10 Q15 4 24 4 L24 8 Q19 8 19 12 Z" style={fill(tone)} />
    <circle cx="23" cy="10" r="3.2" style={fill('lite', 0.9)} />
  </svg>
);

// Ascent / defense ridge
const RadarDome = (h: number) => (
  <svg width={h * 0.6} height={h} viewBox="0 0 60 100">
    <path d="M22 100 L26 46 L34 46 L38 100 Z" style={fill('mid')} />
    <path d="M24 70 L36 70 M23 86 L37 86" style={stroke('lite', 1.5, 0.35)} />
    <circle cx="30" cy="28" r="22" style={fill('mid')} />
    <path
      d="M8 28 H52 M11 17 H49 M11 39 H49 M30 6 V50 M19 9 Q14 28 19 47 M41 9 Q46 28 41 47"
      style={stroke('lite', 1.2, 0.4)}
    />
  </svg>
);

const Pylon = (h: number, tone: string) => (
  <svg width={h * 0.4} height={h} viewBox="0 0 40 100">
    <path d="M20 4 L32 100 M20 4 L8 100" style={stroke(tone, 3)} />
    <path d="M12 70 L28 70 M14 46 L26 46 M16 26 L24 26 M12 70 L26 46 M28 70 L14 46" style={stroke(tone, 1.6)} />
    <circle cx="20" cy="4" r="3" style={fill('era-accent')} />
  </svg>
);

const Pine = (h: number, tone: string) => (
  <svg width={h * 0.5} height={h} viewBox="0 0 50 100">
    <rect x="23" y="82" width="4" height="18" style={fill(tone)} />
    <path d="M25 0 L44 40 L34 40 L48 66 L36 66 L50 86 L0 86 L14 66 L2 66 L16 40 L6 40 Z" style={fill(tone)} />
  </svg>
);

// Platform / data-centre campus
const DataCenter = (w: number, r: Rand) => {
  const units = 3 + Math.floor(r() * 3);
  return (
    <svg width={w} height={w * 0.34} viewBox="0 0 100 34">
      {Array.from({ length: units }, (_, i) => (
        <rect key={i} x={10 + (i * 80) / units} y="4" width={50 / units} height="6" rx="1" style={fill('mid')} />
      ))}
      <rect x="2" y="10" width="96" height="24" style={fill('mid')} />
      {[15, 20, 25].map((y) => (
        <rect key={y} x="8" y={y} width="84" height="1.4" style={fill('lite', 0.35)} />
      ))}
      <rect x="80" y="26" width="10" height="8" style={fill('lite', 0.4)} />
    </svg>
  );
};

const Radome = (w: number) => (
  <svg width={w} height={w * 0.92} viewBox="0 0 100 92">
    <rect x="28" y="70" width="44" height="22" style={fill('mid')} />
    <path d="M14 72 A36 36 0 1 1 86 72 Z" style={fill('mid')} />
    <path
      d="M20 52 H80 M28 32 H72 M50 12 V72 M34 18 Q26 44 30 72 M66 18 Q74 44 70 72"
      style={stroke('lite', 1.4, 0.35)}
    />
  </svg>
);

const Mast = (h: number, tone: string) => (
  <svg width={h * 0.36} height={h} viewBox="0 0 36 100">
    <path d="M18 6 L24 100 L12 100 Z" style={fill(tone)} />
    <path d="M8 30 H28 M6 54 H30" style={stroke(tone, 2.4)} />
    <circle cx="18" cy="5" r="3.4" style={fill('era-accent')} />
  </svg>
);

// Frontier / AI security
const NeonTower = (w: number, h: number, r: Rand) => (
  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
    <path d={`M0 ${h} L0 18 L${w * 0.7} 0 L${w} 10 L${w} ${h} Z`} style={fill('mid')} />
    <path d={`M${w - 1.5} ${h} L${w - 1.5} 11`} style={stroke('era-accent', 2, 0.85)} />
    <path d={`M1 18 L${w * 0.7} 1.5 L${w - 1} 10.5`} style={stroke('era-accent', 1.5, 0.6)} />
    {Array.from({ length: Math.floor((h - 40) / 18) }, (_, i) => (
      <rect
        key={i}
        x={w * (r() > 0.5 ? 0.2 : 0.5)}
        y={32 + i * 18}
        width={w * 0.24}
        height="4"
        rx="1"
        style={fill('era-accent', r() > 0.45 ? 0.55 : 0.18)}
      />
    ))}
  </svg>
);

const Shield = (h: number) => (
  <svg width={h * 0.84} height={h} viewBox="0 0 84 100">
    <path d="M42 3 L78 15 L78 48 Q78 78 42 97 Q6 78 6 48 L6 15 Z" style={{ ...fill('era-accent', 0.07) }} />
    <path d="M42 3 L78 15 L78 48 Q78 78 42 97 Q6 78 6 48 L6 15 Z" style={stroke('era-accent', 2, 0.75)} />
    <path d="M42 14 L68 23 L68 48 Q68 70 42 85 Q16 70 16 48 L16 23 Z" style={stroke('era-accent', 1, 0.3)} />
    <rect x="31" y="46" width="22" height="18" rx="3" style={fill('era-accent', 0.75)} />
    <path d="M35 46 V40 A7 7 0 0 1 49 40 V46" style={stroke('era-accent', 3.5, 0.75)} />
  </svg>
);

const NightBlock = (w: number, h: number, r: Rand) => (
  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
    <rect x="0" y="0" width={w} height={h} style={fill('near')} />
    <rect x="0" y="0" width={w} height="2" style={fill('era-accent', 0.5)} />
    {Array.from({ length: Math.floor(w / 16) * Math.floor((h - 12) / 16) }, (_, i) => {
      const cols = Math.floor(w / 16);
      return r() > 0.7 ? (
        <rect
          key={i}
          x={6 + (i % cols) * 16}
          y={10 + Math.floor(i / cols) * 16}
          width="6"
          height="6"
          rx="1"
          style={fill('era-accent', 0.45)}
        />
      ) : null;
    })}
  </svg>
);

/* ---------- per-era recipes ---------- */

type Placed = {
  x: number;
  el: ReactElement;
  /** Sky items hang at a fixed height instead of standing on the horizon. */
  sky?: string;
  /** Left-anchored (ridges) instead of centred on x. */
  span?: boolean;
};

/** Evenly spaced slots with seeded jitter, skipping anything too close to a landmark. */
function row(
  r: Rand,
  from: number,
  to: number,
  step: number,
  make: (i: number) => ReactElement,
  avoid: number[] = [],
  clear = 0,
): Placed[] {
  const out: Placed[] = [];
  let i = 0;
  for (let x = from + step * r(); x < to; x += step * (0.7 + r() * 0.6), i++) {
    if (avoid.some((a) => Math.abs(a - x) < clear)) continue;
    out.push({ x, el: make(i) });
  }
  return out;
}

function eraItems(
  theme: string,
  band: Band,
  from: number,
  to: number,
  entry: number,
  span: number,
  r: Rand,
): Placed[] {
  // Landmarks: one where the chapter opens (right of the character) and, for
  // long chapters, a second further in.
  const marks = [entry + 980];
  if (span > 1400) marks.push(entry + 980 + span * 0.55);
  const items: Placed[] = [];
  const w = to - from;

  if (band === 'far') {
    const shape: Record<string, RidgeShape> = {
      sunrise: 'roll', bank: 'blocks', ascent: 'peaks', platform: 'roll', frontier: 'city',
    };
    const h = { sunrise: 150, bank: 200, ascent: 250, platform: 130, frontier: 220 }[theme] ?? 160;
    items.push({ x: from, el: Ridge(w, h, shape[theme], r), span: true });

    if (theme === 'sunrise') items.push({ x: entry + 760, sky: '46vh', el: Sun(44) });
    if (theme === 'frontier') {
      items.push({ x: entry + 1150, sky: '58vh', el: Moon(30) });
      for (let x = from; x < to; x += 900)
        items.push({ x, sky: '34vh', el: StarField(900, 330, 22, r), span: true });
    } else {
      items.push(
        ...row(r, from, to, 760, () => Cloud(120 + r() * 90, r)).map((p) => ({
          ...p,
          sky: `${50 + r() * 22}vh`,
        })),
      );
    }
  }

  if (band === 'mid') {
    if (theme === 'sunrise') {
      items.push(...marks.map((x) => ({ x, el: ClockTower(250) })));
      items.push(...row(r, from, to, 420, () => Hall(150 + r() * 70, r), marks, 160));
      items.push(...row(r, from + 200, to, 520, () => Palm(130 + r() * 40, 'mid', r), marks, 80));
    }
    if (theme === 'bank') {
      items.push(...marks.map((x) => ({ x, el: SpireTower(330) })));
      items.push(
        ...row(r, from, to, 150, () => GlassTower(56 + r() * 40, 130 + r() * 150, r), marks, 90),
      );
    }
    if (theme === 'ascent') {
      items.push(...row(r, from, to, 520, () => Hill(520 + r() * 300, 110 + r() * 50, 'mid')));
      items.push(...marks.map((x) => ({ x, el: RadarDome(200) })));
      items.push(...row(r, from + 300, to, 900, () => Pylon(150 + r() * 40, 'mid'), marks, 200));
    }
    if (theme === 'platform') {
      items.push(...marks.map((x) => ({ x, el: Radome(150) })));
      items.push(...marks.map((x) => ({ x: x + 130, el: Radome(96) })));
      items.push(...row(r, from, to, 330, () => DataCenter(190 + r() * 90, r), marks, 230));
    }
    if (theme === 'frontier') {
      items.push(...marks.map((x) => ({ x, sky: '44vh', el: Shield(150) })));
      items.push(...row(r, from, to, 140, () => NeonTower(50 + r() * 34, 140 + r() * 170, r)));
    }
  }

  if (band === 'near') {
    if (theme === 'sunrise') {
      items.push(...row(r, from, to, 380, () => Palm(170 + r() * 60, 'near', r)));
    }
    if (theme === 'bank') {
      items.push(...row(r, from, to, 300, (i) => (i % 3 === 1 ? Lamp(120, 'near') : RoundTree(100 + r() * 40, 'near'))));
    }
    if (theme === 'ascent') {
      items.push(...row(r, from, to, 170, () => Pine(90 + r() * 90, 'near')));
    }
    if (theme === 'platform') {
      items.push(...row(r, from, to, 420, (i) => (i % 2 ? Mast(150 + r() * 40, 'near') : Pine(80 + r() * 50, 'near'))));
    }
    if (theme === 'frontier') {
      items.push(...row(r, from, to, 260, (i) => (i % 3 === 2 ? Lamp(120, 'near') : NightBlock(90 + Math.floor(r() * 60), 50 + Math.floor(r() * 50), r))));
    }
  }

  return items;
}

/* ---------- the layer component ---------- */

/** Scale a scenery SVG's rendered size; its viewBox keeps the drawing intact. */
function scaled(el: ReactElement, S: number): ReactElement {
  if (S === 1) return el;
  const { width, height } = el.props as { width?: number; height?: number };
  return cloneElement(el as ReactElement<{ width?: number; height?: number }>, {
    width: typeof width === 'number' ? width * S : width,
    height: typeof height === 'number' ? height * S : height,
  });
}

function ParallaxLayer({
  layout,
  speed,
  band,
}: {
  layout: JourneyLayout;
  speed: number;
  band: Band;
}) {
  const S = layout.scale;
  const width = ((layout.worldWidth / S) * speed + VW_MAX + PAD_BEFORE) * S;
  const seedBase = { far: 7, mid: 31, near: 59 }[band];
  return (
    <div
      className={`parallax parallax-${band}`}
      data-speed={speed}
      style={{ width }}
      aria-hidden="true"
    >
      {layout.chapters.map(({ chapter, startX: sx, endX: ex }, ci) => {
        // Back to scale-1 world units for composing.
        const startX = sx / S;
        const endX = ex / S;
        const entry = (startX - C_REF) * speed;
        const from = Math.max(0, entry - PAD_BEFORE);
        const to = (endX - C_REF) * speed + VW_MAX;
        const items = eraItems(
          chapter.theme,
          band,
          from,
          to,
          entry,
          (endX - startX) * speed,
          mulberry32(ci * 101 + seedBase),
        );
        return (
          <div key={chapter.id} className={`era era-${chapter.theme}`}>
            {items.map((it, i) => (
              <div
                key={i}
                className={`sc-item${it.sky ? ' sc-sky' : ''}${it.span ? ' sc-span' : ''}`}
                style={{ left: it.x * S, ...(it.sky ? { bottom: it.sky } : {}) }}
              >
                {scaled(it.el, S)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default memo(ParallaxLayer);
