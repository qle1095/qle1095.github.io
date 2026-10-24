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
