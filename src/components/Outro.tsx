import { profile } from '../data/journey';

/** The three interactive decks, published from the ai-inference-101 repo into public/inference/. */
const COURSE = [
  { level: '101', title: 'From weights to pods', href: '/inference/' },
  { level: '201', title: 'Making it fast', href: '/inference/optimization.html' },
  { level: '301', title: '25 production scenarios', href: '/inference/advanced.html' },
];

export default function Outro({ staticMode = false }: { staticMode?: boolean }) {
  return (
    <footer className={staticMode ? 'outro outro-static' : 'outro'}>
      <h2 className="outro-title">…and the journey continues.</h2>
      <p className="outro-text">
        Today I lead AI/LLM integration on fully self-hosted models and the
        platforms security teams rely on.
      </p>
      <section className="course-promo" aria-labelledby="course-promo-title">
        <span className="course-kicker">AI Inference Engineering</span>
        <h3 className="course-headline" id="course-promo-title">
          Learn to serve AI models on Kubernetes, with me
        </h3>
        <p className="course-pitch">
          I turned what I&apos;ve learned running self-hosted LLMs into a free,
          hands-on course. Press play, drag the sliders, and watch tokens, GPUs
          and pods do their thing.
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
        <a className="course-cta" href={COURSE[0].href}>
          Start the course
        </a>
      </section>
      {/* Static library of experiments in public/playground/. Must not use
          .outro-actions: the character lands under the first one of those. */}
      <a className="playground-promo" href="/playground/">
        <img
          className="playground-thumb"
          src="/playground/procedural-cat/assets/ornith-dflash.png"
          alt=""
          width={88}
          height={88}
          loading="lazy"
        />
        <span className="playground-copy">
          <span className="course-kicker">AI Inference Playground</span>
          <span className="playground-headline">
            I spend a lot of time benchmarking, breaking and tuning models
          </span>
          <span className="playground-pitch">
            Real GPUs, real numbers, honest failures. Curious? Start with four
            open LLMs drawing a cat on one RTX 5090.
          </span>
          <span className="playground-cta">Visit the Playground</span>
        </span>
      </a>
      <p className="outro-ask">Want the classic one-pager, or to talk?</p>
      <div className="outro-actions">
        <a className="btn btn-primary" href={profile.resumePdf} download>
          Download resume (PDF)
        </a>
        <a className="btn" href={`mailto:${profile.email}`}>
          {profile.email}
        </a>
        <a className="btn" href={profile.linkedin} target="_blank" rel="noreferrer">
          LinkedIn
        </a>
      </div>
    </footer>
  );
}
