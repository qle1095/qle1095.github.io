// ---------------------------------------------------------------------------
// Benchmark cards for the home page's "AI Inference Playground" promo.
// Adding an experiment = one entry here. The list is sorted newest first, so
// order in this file doesn't matter. Every number must match the experiment's
// own page under public/playground/. In summary/result, **text** marks a
// highlighted model name or number (rendered by components/Rich.tsx).
// ---------------------------------------------------------------------------

export type PlaygroundThumb =
  | { kind: 'image'; src: string }
  /** Small inline chart drawn by components/Outro.tsx (no image request). */
  | { kind: 'moe-vs-dense' };

export type PlaygroundExperiment = {
  id: string;
  /** ISO date (YYYY-MM-DD). Drives the newest-first order and the shown date. */
  date: string;
  title: string;
  href: string;
  /** One or two sentences: what was compared, on what hardware. */
  summary: string;
  /** The single headline result. */
  result: string;
  thumb: PlaygroundThumb;
};

const EXPERIMENTS: PlaygroundExperiment[] = [
  {
    id: 'moe-vs-dense-concurrency',
    date: '2026-10-30',
    title: 'MoE held 64 requests within SLO; dense held 16',
    href: '/playground/moe-vs-dense-concurrency/',
    summary:
      '**Flint** (MoE, ~2.5B active) vs **Qwen 3.8 27B** (dense), both NVFP4 on vLLM, from 1 to 96 concurrent requests on one **RTX PRO 6000** (96 GB).',
    result:
      'Inside the latency SLO: **64 vs 16** concurrent requests, at **$0.40 vs $1.59** per 1M output tokens. Peak output **1,987 vs 687 tok/s**.',
    thumb: { kind: 'moe-vs-dense' },
  },
  {
    id: 'procedural-cat',
    date: '2026-10-28',
    title: '5 of 8 runs drew a cat; Qwen never stopped planning',
    href: '/playground/procedural-cat/',
    summary:
      '**Qwen 3.8 27B**, **Muse Glimmer** (~30B), **Ornith 1.5** (~35B MoE) and **Flint** (39.8B MoE) each get one try to draw a kitten in Canvas JavaScript on one **RTX 5090**.',
    result:
      'Speculative decoding: **1.3–3.0×** faster decode. One serving flag (CUDA graphs): **7.3×**. Fastest finished cat: **22.6 s**.',
    thumb: { kind: 'image', src: '/playground/procedural-cat/assets/ornith-dflash.png' },
  },
];

export const playground: readonly PlaygroundExperiment[] = [...EXPERIMENTS].sort((a, b) =>
  b.date.localeCompare(a.date),
);

/** "Oct 30, 2026" style label for a card, parsed without time-zone drift. */
export function formatExperimentDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
