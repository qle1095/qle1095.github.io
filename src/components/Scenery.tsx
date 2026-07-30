import type { ReactElement } from 'react';
import type { JourneyLayout } from '../lib/layout';

// Storybook-pastel parallax scenery, themed to the work of each era:
//   foundations — Miami palms + campus (education)
//   the-bank    — finance: skyline, bank, coin stacks, drifting bills, stock chart
//   startup-ascent — defense contractor: mountains, radar towers, jets, flags
//   platform-era   — warfare data: radomes, satellites, server racks, antenna masts
//   ai-frontier    — AI security: neon towers, shields, neural nets, dishes
// Placement is seeded — same layout, same world, every load.

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

/* ---------- shared pieces ---------- */

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

const Star = (r: number) => (
  <svg width={r * 2} height={r * 2} viewBox="0 0 10 10">
    <circle cx="5" cy="5" r="4" fill="#fff" opacity="0.9" />
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

/* ---------- foundations (education) ---------- */

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

/* ---------- the bank (finance) ---------- */

const Bank = (w: number) => (
  <svg width={w} height={w * 0.62} viewBox="0 0 100 62">
    <polygon points="50,2 96,18 4,18" fill="#b7cde4" />
    <rect x="6" y="18" width="88" height="6" fill="#a9c2dd" />
    {[14, 30, 46, 62, 78].map((x) => (
      <rect key={x} x={x} y="24" width="8" height="30" rx="2" fill="#cfe0f0" />
    ))}
    <rect x="4" y="54" width="92" height="8" rx="2" fill="#a9c2dd" />
    <text x="50" y="14" textAnchor="middle" fontSize="9" fontWeight="700" fill="#eef5fc">$</text>
  </svg>
);

const CoinStack = (h: number, r: () => number) => {
  const coins = 3 + Math.floor(r() * 3);
  return (
    <svg width={h * 0.9} height={h} viewBox={`0 0 90 ${coins * 16 + 22}`} preserveAspectRatio="xMidYMax meet">
      {Array.from({ length: coins }, (_, i) => (
        <g key={i} transform={`translate(${(r() - 0.5) * 8} 0)`}>
          <ellipse cx="45" cy={coins * 16 + 12 - i * 14} rx="26" ry="9" fill="#f0b429" />
          <ellipse cx="45" cy={coins * 16 + 9 - i * 14} rx="26" ry="9" fill="#ffd166" stroke="#e8a815" strokeWidth="1.5" />
        </g>
      ))}
      <text x="45" y={coins * 16 + 13 - (coins - 1) * 14} textAnchor="middle" fontSize="11" fontWeight="800" fill="#b07d00">$</text>
    </svg>
  );
};

const DollarBill = (w: number) => (
  <svg width={w} height={w * 0.46} viewBox="0 0 100 46">
    <rect x="2" y="2" width="96" height="42" rx="5" fill="#9fd4a8" stroke="#6fae79" strokeWidth="2" transform="rotate(-6 50 23)" />
    <circle cx="50" cy="23" r="12" fill="#c6ecca" transform="rotate(-6 50 23)" />
    <text x="50" y="28" textAnchor="middle" fontSize="15" fontWeight="800" fill="#4c8757" transform="rotate(-6 50 23)">$</text>
  </svg>
);

const StockChart = (w: number) => (
  <svg width={w} height={w * 0.52} viewBox="0 0 100 52">
    <polyline points="4,46 22,38 34,42 52,26 66,30 82,12 96,16" fill="none" stroke="#7fae5f" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
    <polygon points="82,12 96,16 90,3" fill="#7fae5f" opacity="0.75" />
  </svg>
);

const Vault = (w: number) => (
  <svg width={w} height={w * 0.9} viewBox="0 0 100 90">
    <rect x="8" y="6" width="84" height="84" rx="10" fill="#9fb4cf" />
    <circle cx="50" cy="48" r="24" fill="#b9cbe2" stroke="#7d94b4" strokeWidth="5" />
    <circle cx="50" cy="48" r="9" fill="#7d94b4" />
    {[0, 60, 120, 180, 240, 300].map((a) => (
      <rect key={a} x="48" y="20" width="4" height="12" rx="2" fill="#7d94b4" transform={`rotate(${a} 50 48)`} />
    ))}
  </svg>
);

/* ---------- startup ascent (defense) ---------- */

const Mountain = (w: number, body: string, cap: string) => (
  <svg width={w} height={w * 0.62} viewBox="0 0 100 62">
    <polygon points="50,2 100,62 0,62" fill={body} />
    <polygon points="50,2 63,18 55,16 50,24 44,15 38,18" fill={cap} />
  </svg>
);

const Jet = (w: number) => (
  <svg width={w} height={w * 0.42} viewBox="0 0 100 42">
    <polygon points="4,22 62,16 96,22 62,28" fill="#7d8aa0" />
    <polygon points="40,20 58,4 66,18" fill="#93a0b4" />
    <polygon points="40,24 58,40 66,26" fill="#93a0b4" />
    <polygon points="8,16 20,6 26,20" fill="#93a0b4" />
    <circle cx="78" cy="21" r="4" fill="#cfe0f0" />
  </svg>
);

const RadarTower = (h: number) => (
  <svg width={h * 0.7} height={h} viewBox="0 0 70 100" preserveAspectRatio="none">
    <polygon points="30,30 40,30 46,100 24,100" fill="#8a9b7c" />
    <line x1="27" y1="52" x2="43" y2="52" stroke="#748468" strokeWidth="3" />
    <line x1="26" y1="74" x2="45" y2="74" stroke="#748468" strokeWidth="3" />
    <path d="M14 28 A22 22 0 0 1 56 24 L35 32 Z" fill="#aebfa0" transform="rotate(-14 35 30)" />
    <circle cx="35" cy="30" r="4" fill="#5d6b52" />
    <path d="M50 12 A26 26 0 0 1 62 26" fill="none" stroke="#aebfa0" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    <path d="M56 4 A36 36 0 0 1 72 24" fill="none" stroke="#aebfa0" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
  </svg>
);

const WatchTower = (h: number) => (
  <svg width={h * 0.6} height={h} viewBox="0 0 60 100" preserveAspectRatio="none">
    <polygon points="16,34 44,34 50,100 10,100" fill="#a09274" />
    <rect x="10" y="16" width="40" height="20" rx="4" fill="#b8ab8c" />
    <rect x="18" y="22" width="10" height="9" rx="2" fill="#efe6cf" />
    <rect x="34" y="22" width="10" height="9" rx="2" fill="#efe6cf" />
    <rect x="6" y="12" width="48" height="6" rx="3" fill="#8f8264" />
  </svg>
);

const Flag = (h: number) => (
  <svg width={h * 0.6} height={h} viewBox="0 0 60 100" preserveAspectRatio="none">
    <rect x="8" y="4" width="4" height="96" rx="2" fill="#8a8fa3" />
    <path d="M12 8 L52 16 L12 28 Z" fill="#ff7a59" />
  </svg>
);

/* ---------- platform era (warfare data) ---------- */

const Radome = (w: number) => (
  <svg width={w} height={w * 0.82} viewBox="0 0 100 82">
    <path d="M18 62 A32 32 0 1 1 82 62 Z" fill="#dcefe4" stroke="#a8cdb8" strokeWidth="2.5" />
    <path d="M30 40 L70 40 M24 52 L76 52 M40 24 L60 24" stroke="#a8cdb8" strokeWidth="2" opacity="0.8" />
    <rect x="30" y="62" width="40" height="14" rx="4" fill="#9fbfae" />
  </svg>
);

const Satellite = (w: number) => (
  <svg width={w} height={w * 0.6} viewBox="0 0 100 60">
    <rect x="2" y="22" width="26" height="16" rx="3" fill="#8f9bff" />
    <rect x="72" y="22" width="26" height="16" rx="3" fill="#8f9bff" />
    <line x1="28" y1="30" x2="40" y2="30" stroke="#6a76d8" strokeWidth="4" />
    <line x1="60" y1="30" x2="72" y2="30" stroke="#6a76d8" strokeWidth="4" />
    <rect x="40" y="18" width="20" height="24" rx="5" fill="#c4c9f4" />
    <path d="M44 18 A12 12 0 0 1 56 8" fill="none" stroke="#c4c9f4" strokeWidth="3" />
    <circle cx="57" cy="7" r="3" fill="#7df9ff" />
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

const AntennaMast = (h: number) => (
  <svg width={h * 0.42} height={h} viewBox="0 0 42 100" preserveAspectRatio="none">
    <polygon points="19,6 23,6 27,100 15,100" fill="#7f9c8d" />
    <line x1="10" y1="30" x2="32" y2="30" stroke="#6b8a79" strokeWidth="3" />
    <line x1="8" y1="55" x2="34" y2="55" stroke="#6b8a79" strokeWidth="3" />
    <line x1="6" y1="80" x2="36" y2="80" stroke="#6b8a79" strokeWidth="3" />
    <circle cx="21" cy="5" r="4" fill="#ff8f73" />
  </svg>
);

const DataStream = (w: number, r: () => number) => (
  <svg width={w} height={16} viewBox={`0 0 ${w} 16`}>
    {Array.from({ length: Math.floor(w / 18) }, (_, i) => (
      <rect
        key={i}
        x={i * 18}
        y={4 + Math.sin(i * 1.2) * 3}
        width="9"
        height="9"
        rx="2.5"
        fill="#2c9c72"
        opacity={0.25 + r() * 0.5}
      />
    ))}
  </svg>
);

/* ---------- AI frontier (AI security) ---------- */

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

const ShieldLock = (h: number) => (
  <svg width={h * 0.82} height={h} viewBox="0 0 82 100">
    <path d="M41 4 L74 16 L74 50 Q74 78 41 96 Q8 78 8 50 L8 16 Z" fill="#4b5087" stroke="#7df9ff" strokeWidth="3" />
    <rect x="29" y="44" width="24" height="20" rx="4" fill="#7df9ff" />
    <path d="M33 44 v-6 a8 8 0 0 1 16 0 v6" fill="none" stroke="#7df9ff" strokeWidth="5" />
    <circle cx="41" cy="53" r="3.5" fill="#2b2e4a" />
  </svg>
);

const NeuralNet = (w: number) => {
  const layers = [[20, 50, 80], [10, 38, 64, 90], [28, 62]];
  const xs = [12, 50, 88];
  const edges: ReactElement[] = [];
  const nodes: ReactElement[] = [];
  layers.forEach((ys, li) => {
    ys.forEach((y, ni) => {
      nodes.push(<circle key={`${li}-${ni}`} cx={xs[li]} cy={y} r="5.5" fill={li === 2 ? '#7df9ff' : '#8f9bff'} />);
      if (li < layers.length - 1)
        layers[li + 1].forEach((y2, mi) => {
          edges.push(
            <line key={`${li}-${ni}-${mi}`} x1={xs[li]} y1={y} x2={xs[li + 1]} y2={y2} stroke="#5d63a0" strokeWidth="1.4" opacity="0.75" />,
          );
        });
    });
  });
  return (
    <svg width={w} height={w} viewBox="0 0 100 100">
      {edges}
      {nodes}
    </svg>
  );
};

const Dish = (h: number) => (
  <svg width={h} height={h} viewBox="0 0 100 100" preserveAspectRatio="none">
    <rect x="46" y="55" width="8" height="45" rx="3" fill="#4b5087" />
    <path d="M18 55 A36 36 0 0 1 82 55 Z" fill="#5d63a0" transform="rotate(-22 50 55)" />
    <circle cx="38" cy="30" r="5" fill="#7df9ff" />
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
    if (theme === 'bank') {
      items.push(...scatter(r, from, to, 5, () => Tower(52 + r() * 30, 180 + r() * 120, '#a8c4e0', '#e8f2fb', r)));
      items.push(...scatter(r, from, to, 2, () => StockChart(150 + r() * 80)).map((p) => ({ ...p, y: `${44 + r() * 16}vh`, cls: 'sc-sky' })));
    }
    if (theme === 'ascent') {
      items.push(...scatter(r, from, to, 3, () => Mountain(220 + r() * 140, '#c9a9e0', '#f6e7ff')));
      items.push(...scatter(r, from, to, 3, () => Jet(90 + r() * 60)).map((p) => ({ ...p, y: `${48 + r() * 26}vh`, cls: 'sc-sky sc-drift' })));
      items.push(...scatter(r, from, to, 5, () => Star(2 + r() * 2)).map((p) => ({ ...p, y: `${58 + r() * 22}vh`, cls: 'sc-sky' })));
    }
    if (theme === 'platform') {
      items.push(...scatter(r, from, to, 3, () => Radome(120 + r() * 70)));
      items.push(...scatter(r, from, to, 2, () => Satellite(110 + r() * 50)).map((p) => ({ ...p, y: `${52 + r() * 22}vh`, cls: 'sc-sky sc-drift' })));
      items.push(...scatter(r, from, to, 2, () => DataStream(220 + r() * 120, r)).map((p) => ({ ...p, y: `${36 + r() * 12}vh`, cls: 'sc-sky' })));
    }
    if (theme === 'frontier') {
      items.push(...scatter(r, from, to, 5, () => NeonTower(46 + r() * 26, 170 + r() * 130, r)));
      items.push({ x: from + (to - from) * 0.3, y: '58vh', el: Moon(34), cls: 'sc-sky' });
      items.push(...scatter(r, from, to, 9, () => Star(1.5 + r() * 2.2)).map((p) => ({ ...p, y: `${40 + r() * 38}vh`, cls: 'sc-sky' })));
    }
    if (theme === 'sunrise' || theme === 'bank')
      items.push(...scatter(r, from, to, 2, () => Cloud(110 + r() * 80, 'rgba(255,255,255,0.75)')).map((p) => ({ ...p, y: `${58 + r() * 22}vh`, cls: 'sc-sky sc-drift' })));
  }

  if (band === 'mid') {
    if (theme === 'sunrise') items.push(...scatter(r, from, to, 5, () => Palm(120 + r() * 60)));
    if (theme === 'bank') {
      items.push(...scatter(r, from, to, 2, () => Bank(170 + r() * 50)));
      items.push(...scatter(r, from, to, 3, () => CoinStack(80 + r() * 40, r)));
      items.push({ x: from + (to - from) * 0.62, el: Vault(90 + r() * 30) });
      items.push(...scatter(r, from, to, 3, () => DollarBill(64 + r() * 26)).map((p) => ({ ...p, y: `${34 + r() * 26}vh`, cls: 'sc-sky sc-drift' })));
    }
    if (theme === 'ascent') {
      items.push(...scatter(r, from, to, 2, () => RadarTower(120 + r() * 50)));
      items.push({ x: from + (to - from) * 0.55, el: WatchTower(100 + r() * 30) });
      items.push(...scatter(r, from, to, 2, () => Flag(80 + r() * 24)));
    }
    if (theme === 'platform') {
      items.push(...scatter(r, from, to, 3, () => ServerRack(110 + r() * 46, r)));
      items.push(...scatter(r, from, to, 2, () => AntennaMast(110 + r() * 40)));
      items.push(...scatter(r, from, to, 2, () => DataStream(160 + r() * 80, r)).map((p) => ({ ...p, y: `${28 + r() * 10}vh`, cls: 'sc-sky' })));
    }
    if (theme === 'frontier') {
      items.push(...scatter(r, from, to, 2, () => ShieldLock(78 + r() * 26)));
      items.push(...scatter(r, from, to, 2, () => NeuralNet(84 + r() * 30)).map((p, i) => (i % 2 ? { ...p, y: `${30 + r() * 14}vh`, cls: 'sc-sky' } : p)));
      items.push(...scatter(r, from, to, 2, () => Dish(70 + r() * 40)));
    }
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
