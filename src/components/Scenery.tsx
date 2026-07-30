import type { ReactElement } from 'react';
import type { JourneyLayout } from '../lib/layout';

// Storybook-pastel parallax scenery. Each layer spans worldWidth * speed and
// is translated at that fraction of the world scroll (JourneyStage drives the
// transform). All placement is seeded — same layout, same world, every load.

type Band = 'far' | 'mid';

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

/* ---------- primitive scenery pieces (all bottom-anchored) ---------- */

const Hill = (w: number, h: number, fill: string) => (
  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
    <ellipse cx={w / 2} cy={h * 1.15} rx={w / 2} ry={h} fill={fill} />
  </svg>
);

const Sun = (r: number, fill: string) => (
  <svg width={r * 2.6} height={r * 2.6} viewBox={`0 0 ${r * 2.6} ${r * 2.6}`}>
    <circle cx={r * 1.3} cy={r * 1.3} r={r * 1.25} fill={fill} opacity={0.35} />
    <circle cx={r * 1.3} cy={r * 1.3} r={r * 0.85} fill={fill} />
  </svg>
);

const Moon = (r: number) => (
  <svg width={r * 2.2} height={r * 2.2} viewBox={`0 0 ${r * 2.2} ${r * 2.2}`}>
    <circle cx={r} cy={r} r={r * 0.9} fill="#eceafc" />
    <circle cx={r * 1.4} cy={r * 0.8} r={r * 0.75} fill="#4b3f72" />
  </svg>
);

const Cloud = (w: number, fill: string) => (
  <svg width={w} height={w * 0.4} viewBox={`0 0 ${w} ${w * 0.4}`}>
    <ellipse cx={w * 0.3} cy={w * 0.28} rx={w * 0.28} ry={w * 0.13} fill={fill} />
    <ellipse cx={w * 0.55} cy={w * 0.2} rx={w * 0.24} ry={w * 0.15} fill={fill} />
    <ellipse cx={w * 0.75} cy={w * 0.28} rx={w * 0.22} ry={w * 0.11} fill={fill} />
  </svg>
);

const Palm = (h: number) => (
  <svg width={h * 0.9} height={h} viewBox="0 0 90 100" preserveAspectRatio="none">
    <path d="M45 100 Q42 60 46 38" stroke="#b0795a" strokeWidth="7" fill="none" strokeLinecap="round" />
    {[-70, -35, 0, 35, 70].map((a) => (
      <path
        key={a}
        d="M46 38 q0 -22 4 -30"
        stroke="#7fb069"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
        transform={`rotate(${a} 46 38)`}
      />
    ))}
  </svg>
);

const Campus = (w: number) => (
  <svg width={w} height={w * 0.55} viewBox="0 0 100 55">
    <rect x="8" y="22" width="84" height="33" rx="3" fill="#e8c9a0" />
    <polygon points="50,4 94,24 6,24" fill="#d8a87c" />
    <rect x="44" y="36" width="12" height="19" rx="2" fill="#a97c50" />
    {[16, 30, 62, 76].map((x) => (
      <rect key={x} x={x} y="30" width="9" height="10" rx="1.5" fill="#fff4dd" />
    ))}
  </svg>
);

const Tower = (w: number, h: number, body: string, win: string, r: () => number) => {
  const rows = Math.max(3, Math.floor(h / 26));
  const wins: ReactElement[] = [];
  for (let ry = 0; ry < rows; ry++)
    for (let rx = 0; rx < 3; rx++)
      if (r() > 0.35)
        wins.push(
          <rect
            key={`${rx}-${ry}`}
            x={w * 0.16 + rx * w * 0.26}
            y={12 + ry * (h - 22) / rows}
            width={w * 0.16}
            height={(h - 22) / rows * 0.45}
            rx={1.5}
            fill={win}
          />,
        );
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <rect x="0" y="4" width={w} height={h - 4} rx="4" fill={body} />
      {wins}
    </svg>
  );
};

const Bank = (w: number) => (
  <svg width={w} height={w * 0.62} viewBox="0 0 100 62">
    <polygon points="50,2 96,18 4,18" fill="#b7cde4" />
    <rect x="6" y="18" width="88" height="6" fill="#a9c2dd" />
    {[14, 30, 46, 62, 78].map((x) => (
      <rect key={x} x={x} y="24" width="8" height="30" rx="2" fill="#cfe0f0" />
    ))}
    <rect x="4" y="54" width="92" height="8" rx="2" fill="#a9c2dd" />
  </svg>
);

const Lamp = (h: number) => (
  <svg width={h * 0.34} height={h} viewBox="0 0 34 100" preserveAspectRatio="none">
    <rect x="14" y="16" width="5" height="84" rx="2" fill="#6a7a94" />
    <circle cx="16.5" cy="12" r="9" fill="#ffe9a8" stroke="#6a7a94" strokeWidth="3" />
  </svg>
);

const Mountain = (w: number, body: string, cap: string) => (
  <svg width={w} height={w * 0.62} viewBox="0 0 100 62">
    <polygon points="50,2 100,62 0,62" fill={body} />
    <polygon points="50,2 63,18 55,16 50,24 44,15 38,18" fill={cap} />
  </svg>
);

const Rocket = (h: number) => (
  <svg width={h * 0.5} height={h} viewBox="0 0 50 100" preserveAspectRatio="none">
    <path d="M25 2 Q38 22 38 48 L38 74 L12 74 L12 48 Q12 22 25 2" fill="#f0f0f5" stroke="#d8d8e2" strokeWidth="2" />
    <circle cx="25" cy="34" r="7" fill="#9fd0f0" stroke="#d8d8e2" strokeWidth="2" />
    <polygon points="12,58 0,84 12,80" fill="#ff7a59" />
    <polygon points="38,58 50,84 38,80" fill="#ff7a59" />
    <polygon points="18,74 25,96 32,74" fill="#ffc25e" opacity="0.9" />
  </svg>
);

const Flag = (h: number) => (
  <svg width={h * 0.6} height={h} viewBox="0 0 60 100" preserveAspectRatio="none">
    <rect x="8" y="4" width="4" height="96" rx="2" fill="#8a8fa3" />
    <path d="M12 8 L52 16 L12 28 Z" fill="#ff7a59" />
  </svg>
);

const ServerRack = (h: number, r: () => number) => (
  <svg width={h * 0.62} height={h} viewBox="0 0 62 100" preserveAspectRatio="none">
    <rect x="4" y="4" width="54" height="94" rx="6" fill="#9fd4bd" />
    {[0, 1, 2, 3].map((i) => (
      <g key={i}>
        <rect x="10" y={12 + i * 22} width="42" height="14" rx="3" fill="#7cbfa4" />
        <circle cx="18" cy={19 + i * 22} r="2.6" fill={r() > 0.5 ? '#2c9c72' : '#e4f6ee'} />
        <circle cx="27" cy={19 + i * 22} r="2.6" fill={r() > 0.5 ? '#2c9c72' : '#e4f6ee'} />
        <rect x="34" y={16.5 + i * 22} width="14" height="5" rx="2" fill="#e4f6ee" />
      </g>
    ))}
  </svg>
);

const RoundTree = (h: number, canopy: string) => (
  <svg width={h * 0.8} height={h} viewBox="0 0 80 100" preserveAspectRatio="none">
    <rect x="36" y="58" width="8" height="42" rx="3" fill="#b0795a" />
    <circle cx="40" cy="38" r="30" fill={canopy} />
  </svg>
);

const NeonTower = (w: number, h: number, r: () => number) => (
  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
    <rect x={w * 0.1} y={h * 0.12} width={w * 0.8} height={h * 0.88} rx="5" fill="#3a3f66" />
    <rect x={w * 0.46} y={0} width={w * 0.08} height={h * 0.14} fill="#7df9ff" />
    {Array.from({ length: Math.floor(h / 22) }, (_, i) => (
      <rect
        key={i}
        x={w * (0.2 + (r() > 0.5 ? 0.3 : 0))}
        y={h * 0.18 + i * 20}
        width={w * 0.28}
        height={7}
        rx={2}
        fill={r() > 0.4 ? '#8f9bff' : '#5a5f8f'}
      />
    ))}
  </svg>
);

const Dish = (h: number) => (
  <svg width={h} height={h} viewBox="0 0 100 100" preserveAspectRatio="none">
    <rect x="46" y="55" width="8" height="45" rx="3" fill="#4b5087" />
    <path d="M18 55 A36 36 0 0 1 82 55 Z" fill="#5d63a0" transform="rotate(-22 50 55)" />
    <circle cx="38" cy="30" r="5" fill="#7df9ff" />
  </svg>
);

const Star = (r: number) => (
  <svg width={r * 2} height={r * 2} viewBox="0 0 10 10">
    <circle cx="5" cy="5" r="4" fill="#fff" opacity="0.9" />
  </svg>
);

/* ---------- per-era layer recipes ---------- */

type Placed = { x: number; y?: string; el: ReactElement; cls?: string };

function scatter(
  r: () => number,
  from: number,
  to: number,
  count: number,
  make: (i: number) => ReactElement,
): Placed[] {
  const out: Placed[] = [];
  const span = to - from;
  for (let i = 0; i < count; i++) {
    out.push({ x: from + span * ((i + 0.15 + r() * 0.7) / count), el: make(i) });
  }
  return out;
}

function eraItems(theme: string, band: Band, from: number, to: number, seed: number): Placed[] {
  const r = mulberry32(seed);
  const items: Placed[] = [];
  const hillFills: Record<string, string> = {
    sunrise: '#f7c99b', bank: '#c3d8ec', ascent: '#d9c2ee',
    platform: '#bfe4d2', frontier: '#3f4470',
  };

  if (band === 'far') {
    items.push(...scatter(r, from, to, 3, () => Hill(420 + r() * 260, 120 + r() * 70, hillFills[theme])));
    if (theme === 'sunrise') {
      items.push({ x: from + (to - from) * 0.25, y: '52vh', el: Sun(46, '#ffd166'), cls: 'sc-sky' });
      items.push(...scatter(r, from, to, 2, () => Campus(150 + r() * 60)));
    }
    if (theme === 'bank')
      items.push(...scatter(r, from, to, 5, () => Tower(52 + r() * 30, 180 + r() * 120, '#a8c4e0', '#e8f2fb', r)));
    if (theme === 'ascent') {
      items.push(...scatter(r, from, to, 3, () => Mountain(220 + r() * 140, '#c9a9e0', '#f6e7ff')));
      items.push(...scatter(r, from, to, 6, () => Star(2 + r() * 2)).map((p) => ({ ...p, y: `${45 + r() * 30}vh`, cls: 'sc-sky' })));
    }
    if (theme === 'platform')
      items.push(...scatter(r, from, to, 4, () => Cloud(160 + r() * 90, '#d4efe1')).map((p, i) => (i % 2 ? { ...p, y: `${50 + r() * 25}vh`, cls: 'sc-sky sc-drift' } : p)));
    if (theme === 'frontier') {
      items.push(...scatter(r, from, to, 5, () => NeonTower(46 + r() * 26, 170 + r() * 130, r)));
      items.push({ x: from + (to - from) * 0.3, y: '58vh', el: Moon(34), cls: 'sc-sky' });
      items.push(...scatter(r, from, to, 9, () => Star(1.5 + r() * 2.2)).map((p) => ({ ...p, y: `${40 + r() * 38}vh`, cls: 'sc-sky' })));
    }
    // gentle clouds everywhere except the night era
    if (theme !== 'frontier')
      items.push(...scatter(r, from, to, 2, () => Cloud(110 + r() * 80, 'rgba(255,255,255,0.75)')).map((p) => ({ ...p, y: `${58 + r() * 22}vh`, cls: 'sc-sky sc-drift' })));
  }

  if (band === 'mid') {
    if (theme === 'sunrise') items.push(...scatter(r, from, to, 5, () => Palm(120 + r() * 60)));
    if (theme === 'bank') {
      items.push(...scatter(r, from, to, 2, () => Bank(170 + r() * 50)));
      items.push(...scatter(r, from, to, 4, () => Lamp(90 + r() * 26)));
    }
    if (theme === 'ascent') {
      items.push(...scatter(r, from, to, 2, () => Rocket(120 + r() * 50)));
      items.push(...scatter(r, from, to, 3, () => Flag(80 + r() * 24)));
    }
    if (theme === 'platform') {
      items.push(...scatter(r, from, to, 3, () => ServerRack(110 + r() * 46, r)));
      items.push(...scatter(r, from, to, 4, () => RoundTree(96 + r() * 40, '#8fcfae')));
    }
    if (theme === 'frontier') items.push(...scatter(r, from, to, 4, () => Dish(70 + r() * 40)));
  }

  return items;
}

/* ---------- the layer component ---------- */

export default function ParallaxLayer({
  layout,
  speed,
  band,
}: {
  layout: JourneyLayout;
  speed: number;
  band: Band;
}) {
  const width = layout.worldWidth * speed + 1200;
  const items = layout.chapters.flatMap(({ chapter, startX, endX }, ci) =>
    eraItems(chapter.theme, band, startX * speed, endX * speed, ci * 101 + (band === 'far' ? 7 : 31)),
  );
  return (
    <div
      className={`parallax parallax-${band}`}
      data-speed={speed}
      style={{ width }}
      aria-hidden="true"
    >
      {items.map((it, i) => (
        <div
          key={i}
          className={`sc-item ${it.cls ?? ''}`}
          style={{ left: it.x, ...(it.y ? { bottom: it.y } : {}) }}
        >
          {it.el}
        </div>
      ))}
    </div>
  );
}
