import { Fragment } from 'react';
import { ArrowDown, ArrowRight, FileDown, FlaskConical, Mail } from 'lucide-react';
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
 * What he works on today, on the first screen: the inference platform and the
 * two newest Playground benchmarks (data/playground.ts, newest first). On
 * desktop it sits in the sky above the character; on phones, under the CTAs.
 */
function NowCard() {
  return (
    <aside className="hero-now" aria-labelledby="hero-now-title">
      <p className="hero-now-kicker">
        <span className="hero-now-dot" aria-hidden="true" />
        Now
      </p>
      <h2 className="hero-now-title" id="hero-now-title">
        Leading self-hosted LLM inference on Kubernetes
      </h2>
      <p className="hero-now-stack">EKS GPU nodes · Flint 40B MoE · LiteLLM · Open WebUI · vLLM next</p>
      <p className="hero-now-label">Latest benchmarks from my AI Inference Playground</p>
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
      <a className="hero-now-cta" href="/playground/">
        All benchmarks
        <ArrowRight {...iconSize(16)} strokeWidth={2.2} aria-hidden="true" />
      </a>
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
        <div className="hero-actions">
          <button type="button" className="btn btn-primary" onClick={startJourney}>
            {staticMode ? 'Read the journey' : 'Start the journey'}
            <ArrowDown {...iconSize(18)} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <a className="btn btn-secondary" href={profile.resumePdf} download>
            <FileDown {...iconSize(18)} strokeWidth={2} aria-hidden="true" />
            Resume (PDF)
          </a>
          <a className="btn btn-secondary" href="/playground/">
            <FlaskConical {...iconSize(18)} strokeWidth={2} aria-hidden="true" />
            AI Inference Playground
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
        <NowCard />
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
