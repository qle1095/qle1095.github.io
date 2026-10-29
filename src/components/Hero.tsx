import { ArrowDown, FileDown, Mail } from 'lucide-react';
import { profile } from '../data/journey';
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
          <strong>{profile.tagline}</strong>{' '}
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

      {/* The character stands here (positioned by JourneyStage). The platform
          is the first strip of the sunrise world he is about to walk into. */}
      {!staticMode && (
        <div className="hero-stage" aria-hidden="true">
          <div className="hero-character-slot" data-character-slot aria-hidden="true" />
          <div className="hero-platform" />
        </div>
      )}

      <p className="hero-scroll-hint">
        {staticMode ? 'Scroll to read the journey' : 'Scroll to walk the journey'}
      </p>
    </header>
  );
}
