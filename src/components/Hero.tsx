import { Fragment } from 'react';
import { ArrowDown, ArrowRight, FileDown, Mail } from 'lucide-react';
import { COURSE } from '../data/course';
import { profile } from '../data/journey';
import { formatExperimentDate, playground } from '../data/playground';
import { smoothScrollTo } from '../lib/scroll';
import { iconSize } from '../lib/uiScale';
import Rich from './Rich';

/** Smooth-scroll to the top of the journey (the pinned stage, or the static list). */
function startJourney() {
  const target = document.querySelector<HTMLElement>('.stage, .static-timeline');
  if (!target) return;
  // A pinned stage sits inside GSAP's pin-spacer; its offset is the stable one.
  const anchor = target.parentElement?.classList.contains('pin-spacer') ? target.parentElement : target;
  const top = anchor.getBoundingClientRect().top + window.scrollY;
  smoothScrollTo(top);
}

/**
 * The first-screen panel, in priority order: what he does at work now, the
 * home lab where he rehearses it (with the two newest Playground benchmarks,
 * data/playground.ts, newest first), and the course he learned it through.
 * Rendered twice, one shown per layout (CSS): in the sky above the character
 * on desktop, and above the CTAs on phones, where anything between the CTAs
 * and the character is in the path of his leap down to the road.
 */
// The platform's own layers (infra → engine → gateway → apps); the model
// served is a detail of the inference card, not a skill.
const WORK_STACK = ['EKS', 'NVIDIA L4', 'Ollama', 'LiteLLM', 'Open WebUI', 'OpenCode', 'vLLM next'];

function NowCard({ placement }: { placement: 'side' | 'inline' }) {
  const titleId = `hero-now-title-${placement}`;
  return (
    <aside className={`hero-now hero-now-${placement}`} aria-labelledby={titleId}>
      <section className="hero-now-work">
        <p className="hero-now-kicker">
          <span className="hero-now-dot" aria-hidden="true" />
          Now, at work
        </p>
        <h2 className="hero-now-title" id={titleId}>
          Leading the <span className="hl">self-hosted LLM inference platform</span>
        </h2>
        <p className="hero-now-text">
          GPU serving for IL4 developers: gateway, chat, coding assistants. Ollama today, vLLM next.
        </p>
        <ul className="hero-now-stack" aria-label="Work stack">
          {WORK_STACK.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>

      <section className="hero-now-lab">
        <div className="hero-now-head">
          <p className="hero-now-label">Home lab: vLLM on Kubernetes</p>
          <a className="hero-now-cta" href="/playground/">
            All benchmarks
            <ArrowRight {...iconSize(14)} strokeWidth={2.2} aria-hidden="true" />
          </a>
        </div>
        <p className="hero-now-text">
          <strong className="kw">vLLM</strong> behind <strong className="kw">KServe, llm-d</strong> and an{' '}
          <strong className="kw">Envoy AI Gateway</strong> on Kubernetes, plus benchmarks on rented GPUs:
        </p>
        <ul className="hero-now-list">
          {playground.slice(0, 2).map((x) => (
            <li key={x.id}>
              <a href={x.href}>
                <span className="hero-now-item-title">{x.title}</span>
                <time dateTime={x.date}>{formatExperimentDate(x.date)}</time>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="hero-now-learn">
        <p className="hero-now-label">How I learned it: a free course I wrote</p>
        <ul className="hero-now-course">
          {COURSE.map((c) => (
            <li key={c.level}>
              <a href={c.href} title={c.title}>
                <span className="hero-now-level">{c.level}</span>
                {c.short}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

/**
 * The title screen: who, what level, proof, and how to reach him, before any
 * scrolling. The right column (below the CTAs on phones) is an empty slot the
 * 3D character is positioned onto; nothing else may sit there.
 */
export default function Hero({ staticMode = false }: { staticMode?: boolean }) {
  return (
    <header className={staticMode ? 'hero hero-static' : 'hero'}>
      <div className="hero-copy">
        <p className="hero-kicker">The career journey of</p>
        <h1 className="hero-name">
          {profile.name}
          <span className="hero-name-dot" aria-hidden="true">.</span>
        </h1>
        <p className="hero-tagline">
          <strong>
            {profile.tagline.split(' · ').map((part, i, all) =>
              i < all.length - 1 ? (
                <Fragment key={part}>
                  <span className="hero-tagline-part">{part} ·</span>{' '}
                </Fragment>
              ) : (
                <span key={part} className="hero-tagline-part">{part}</span>
              ),
            )}
          </strong>{' '}
          <span>
            {profile.location} · {profile.clearance}
          </span>
        </p>
        <p className="hero-intro">
          <Rich text={profile.intro} />
        </p>
        <ul className="hero-stats">
          {profile.stats.map((s) => (
            <li key={s.value}>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </li>
          ))}
        </ul>
        <NowCard placement="inline" />
        <div className="hero-actions">
          <button type="button" className="btn btn-primary" onClick={startJourney}>
            {staticMode ? 'Read the journey' : 'Start the journey'}
            <ArrowDown {...iconSize(18)} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <a className="btn btn-secondary" href={profile.resumePdf} download>
            <FileDown {...iconSize(18)} strokeWidth={2} aria-hidden="true" />
            Resume (PDF)
          </a>
          <a
            className="btn btn-icon"
            href={`mailto:${profile.email}`}
            aria-label={`Email ${profile.email}`}
            title={profile.email}
          >
            <Mail {...iconSize(18)} strokeWidth={2} aria-hidden="true" />
          </a>
          <a
            className="btn btn-icon"
            href={profile.linkedin}
            target="_blank"
            rel="noreferrer"
            aria-label="LinkedIn profile (opens in a new tab)"
            title="LinkedIn"
          >
            <span className="btn-in" aria-hidden="true">in</span>
          </a>
        </div>
      </div>

      <div className="hero-side">
        <NowCard placement="side" />
        {/* The character stands here (positioned by JourneyStage). The platform
            is the first strip of the sunrise world he is about to walk into. */}
        {!staticMode && (
          <div className="hero-stage" aria-hidden="true">
            <div className="hero-character-slot" data-character-slot aria-hidden="true" />
            <div className="hero-platform" />
          </div>
        )}
      </div>

      <p className="hero-scroll-hint">
        {staticMode ? 'Scroll to read the journey' : 'Scroll to walk the journey'}
      </p>
    </header>
  );
}
