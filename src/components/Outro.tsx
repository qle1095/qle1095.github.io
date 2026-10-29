import { useState } from 'react';
import { ArrowRight, Check, Copy, FileDown, Mail } from 'lucide-react';
import { profile } from '../data/journey';
import { iconSize } from '../lib/uiScale';

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

          <a className="promo-card playground-promo" href="/playground/">
            <span className="promo-kicker">AI Inference Playground</span>
            <span className="promo-headline">I benchmark, break, and tune models on real GPUs</span>
            <span className="playground-row">
              <img
                className="playground-thumb"
                src="/playground/procedural-cat/assets/ornith-dflash.png"
                alt=""
                width={72}
                height={72}
                loading="lazy"
              />
              <span className="promo-pitch">
                Real numbers, honest failures. Start with four open LLMs drawing
                a cat on one RTX 5090.
              </span>
            </span>
            <span className="promo-cta">
              Visit the Playground
              <ArrowRight {...iconSize(16)} strokeWidth={2.2} aria-hidden="true" />
            </span>
          </a>
        </div>
      </section>
    </section>
  );
}
