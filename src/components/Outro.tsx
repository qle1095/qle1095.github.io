import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Copy, FileDown, Mail } from 'lucide-react';
import { profile } from '../data/journey';
import { formatExperimentDate, playground, type PlaygroundThumb } from '../data/playground';
import { iconSize } from '../lib/uiScale';
import Rich from './Rich';

/** The three interactive decks, published from the ai-inference-101 repo into public/inference/. */
const COURSE = [
  { level: '101', title: 'From weights to pods', href: '/inference/' },
  { level: '201', title: 'Making it fast', href: '/inference/optimization.html' },
  { level: '301', title: '25 production scenarios', href: '/inference/advanced.html' },
];

function CopyEmail() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-icon btn-copy"
      aria-label={copied ? 'Email address copied' : `Copy ${profile.email}`}
      title={copied ? 'Copied' : `Copy ${profile.email}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(profile.email);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard blocked (insecure context / permissions): the mailto link still works.
        }
      }}
    >
      {copied ? <Check {...iconSize(18)} strokeWidth={2.2} aria-hidden="true" /> : <Copy {...iconSize(18)} strokeWidth={2} aria-hidden="true" />}
    </button>
  );
}

/**
 * The MoE-vs-dense chart thumbnail, redrawn from the Playground library tile
 * (public/playground/index.html) with that page's dark palette.
 */
function MoeVsDenseThumb() {
  return (
    <svg className="pg-thumb" viewBox="0 0 200 200" width={72} height={72} aria-hidden="true" focusable="false">
      <rect width="200" height="200" fill="#272834" />
      <g stroke="rgba(255,255,255,0.12)" strokeWidth="1">
        <line x1="24" y1="176" x2="188" y2="176" />
        <line x1="24" y1="148.9" x2="188" y2="148.9" />
        <line x1="24" y1="59" x2="188" y2="59" />
      </g>
      <polyline fill="none" stroke="#3987e5" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points="28.1,84.8 37.4,93.1 47.5,97.6 59.7,108.9 67.7,115.3 72.2,122.4 79.8,131.7 80.3,140.4 79.4,158.2" />
      <polyline fill="none" stroke="#d95926" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points="41.2,27.4 74.7,39.7 96.1,53.5 117.1,71.4 128.7,82.6 141.5,89.5 152.4,103.0 164.5,110.4 186.9,118.2" />
      <g fill="#3987e5" stroke="#272834" strokeWidth="1.5">
        <circle cx="28.1" cy="84.8" r="3.5" />
        <circle cx="79.8" cy="131.7" r="3.5" />
        <circle cx="79.4" cy="158.2" r="3.5" />
      </g>
      <g fill="#d95926" stroke="#272834" strokeWidth="1.5">
        <rect x="37.7" y="23.9" width="7" height="7" rx="1" />
        <rect x="183.4" y="114.7" width="7" height="7" rx="1" />
      </g>
      <g fontFamily="Inter, system-ui, sans-serif" fontSize="9.5" fontWeight="600" fill="#a6a9b8">
        <text x="80" y="30">Flint · MoE</text>
        <text x="92" y="161">Qwen · dense</text>
      </g>
    </svg>
  );
}

function ExperimentThumb({ thumb }: { thumb: PlaygroundThumb }) {
  if (thumb.kind === 'moe-vs-dense') return <MoeVsDenseThumb />;
  return <img className="pg-thumb" src={thumb.src} alt="" width={72} height={72} loading="lazy" />;
}

/**
 * The Playground promo: a native, scroll-snapped row of benchmark cards
 * (newest first, from data/playground.ts). Prev/next buttons appear only when
 * the row overflows; touch, trackpad and arrow keys (row focused) scroll it
 * natively. Cards are narrower than the row, so the next one always peeks in.
 */
function PlaygroundPromo() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ overflow: false, atStart: true, atEnd: true });

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const next = { overflow: max > 1, atStart: el.scrollLeft <= 1, atEnd: el.scrollLeft >= max - 1 };
    setEdges((prev) =>
      prev.overflow === next.overflow && prev.atStart === next.atStart && prev.atEnd === next.atEnd ? prev : next,
    );
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      ro.disconnect();
    };
  }, [measure]);

  const step = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const item = el.querySelector<HTMLElement>('.pg-item');
    const list = el.querySelector<HTMLElement>('.pg-list');
    const gap = list ? parseFloat(getComputedStyle(list).columnGap) || 0 : 0;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({
      left: dir * ((item?.offsetWidth ?? el.clientWidth) + gap),
      behavior: reduce ? 'auto' : 'smooth',
    });
  };

  return (
    <article className="promo-card playground-promo" aria-labelledby="playground-promo-title">
      <div className="pg-head">
        <span className="promo-kicker">AI Inference Playground</span>
        {edges.overflow && (
          <div className="pg-nav">
            <button
              type="button"
              className="pg-nav-btn"
              aria-label="Previous benchmark"
              aria-controls="playground-track"
              disabled={edges.atStart}
              onClick={() => step(-1)}
            >
              <ChevronLeft {...iconSize(18)} strokeWidth={2.2} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="pg-nav-btn"
              aria-label="Next benchmark"
              aria-controls="playground-track"
              disabled={edges.atEnd}
              onClick={() => step(1)}
            >
              <ChevronRight {...iconSize(18)} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      <h4 className="promo-headline" id="playground-promo-title">
        I benchmark, break, and tune models on real GPUs
      </h4>
      <div
        ref={trackRef}
        id="playground-track"
        className="pg-track"
        role="region"
        aria-label="Playground benchmarks, newest first"
        tabIndex={edges.overflow ? 0 : undefined}
        data-at-start={edges.atStart}
        data-at-end={edges.atEnd}
      >
        <ul className="pg-list">
          {playground.map((x) => (
            <li className="pg-item" key={x.id}>
              <a className="pg-card" href={x.href}>
                <span className="pg-card-top">
                  <ExperimentThumb thumb={x.thumb} />
                  <span className="pg-card-titles">
                    <time className="pg-date" dateTime={x.date}>
                      {formatExperimentDate(x.date)}
                    </time>
                    <span className="pg-title">{x.title}</span>
                  </span>
                </span>
                <span className="pg-summary">
                  <Rich text={x.summary} />
                </span>
                <span className="pg-result">
                  <Rich text={x.result} />
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <a className="promo-cta" href="/playground/">
        Visit the Playground
        <ArrowRight {...iconSize(16)} strokeWidth={2.2} aria-hidden="true" />
      </a>
    </article>
  );
}

/**
 * The finale: contact first, then the bonus material. The empty platform
 * beside the title ([data-character-landing]) is where the character lands
 * when he drops out of the stage; keep text out of it.
 */
export default function Outro({ staticMode = false }: { staticMode?: boolean }) {
  return (
    <section
      id="contact"
      className={staticMode ? 'outro outro-static' : 'outro'}
      aria-labelledby="outro-title"
    >
      <div className="outro-head">
        <div className="outro-intro">
          <h2 className="outro-title" id="outro-title">
            …and the journey continues.
          </h2>
          <p className="outro-text">
            Today I lead our self-hosted AI inference platform and the
            organization’s AI use cases, and own the vulnerability-assessment
            platform security analysts use to review every release.
          </p>
          <p className="outro-ask">Want the one-page resume, or to talk?</p>
          <div className="outro-actions">
            <a className="btn btn-primary" href={profile.resumePdf} download>
              <FileDown {...iconSize(18)} strokeWidth={2} aria-hidden="true" />
              Resume (PDF)
            </a>
            <span className="btn-group">
              <a className="btn" href={`mailto:${profile.email}`} title={profile.email}>
                <Mail {...iconSize(18)} strokeWidth={2} aria-hidden="true" />
                Email me
              </a>
              <CopyEmail />
            </span>
            <a className="btn" href={profile.linkedin} target="_blank" rel="noreferrer">
              <span className="btn-in" aria-hidden="true">in</span>
              LinkedIn
            </a>
          </div>
        </div>
        {!staticMode && (
          <div className="outro-landing" data-character-landing aria-hidden="true" />
        )}
      </div>

      <section className="outro-extras" aria-labelledby="outro-extras-title">
        <h3 className="outro-extras-title" id="outro-extras-title">
          Things I teach &amp; tinker with
        </h3>
        <div className="promo-grid">
          <article className="promo-card course-promo" aria-labelledby="course-promo-title">
            <span className="promo-kicker">AI Inference Engineering · free course</span>
            <h4 className="promo-headline" id="course-promo-title">
              Learn to serve AI models on Kubernetes
            </h4>
            <p className="promo-pitch">
              I turned what I’ve learned running self-hosted LLMs into a free,
              hands-on course. Press play, drag the sliders, and watch tokens,
              GPUs, and pods do their thing.
            </p>
            <ol className="course-tracks">
              {COURSE.map((c) => (
                <li key={c.level}>
                  <a className="course-track" href={c.href}>
                    <span className="course-level">{c.level}</span>
                    <span>{c.title}</span>
                  </a>
                </li>
              ))}
            </ol>
            <a className="promo-cta" href={COURSE[0].href}>
              Start the course
              <ArrowRight {...iconSize(16)} strokeWidth={2.2} aria-hidden="true" />
            </a>
          </article>

          <PlaygroundPromo />
        </div>
      </section>
    </section>
  );
}
