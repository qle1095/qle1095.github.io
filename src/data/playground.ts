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
    title: 'MoE vs dense under load',
    href: '/playground/moe-vs-dense-concurrency/',
    summary:
      '**Flint** (MoE, ~2.5B active) vs **Qwen 3.8 27B** (dense), both NVFP4 on vLLM, from 1 to 96 concurrent requests on one **RTX PRO 6000** (96 GB).',
    result:
      'One request: **224 vs 51.5 tok/s**. Under load Qwen’s total output levels off at **675–687 tok/s**; Flint reaches **1,987** and is still climbing.',
    thumb: { kind: 'moe-vs-dense' },
  },
  {
    id: 'procedural-cat',
    date: '2026-10-28',
    title: 'Four open LLMs drawing a cat',
    href: '/playground/procedural-cat/',
    summary:
      '**Qwen 3.8 27B**, **Muse Glimmer** (~30B), **Ornith 1.5** (~35B MoE) and **Flint** (39.8B MoE) each get one try to draw a kitten in Canvas JavaScript on one **RTX 5090**.',
    result: '**5 of 8** runs drew a valid cat; fastest decode **363 tok/s**.',
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
