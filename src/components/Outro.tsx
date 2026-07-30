import { profile } from '../data/journey';

export default function Outro() {
  return (
    <footer className="outro">
      <h2 className="outro-title">…and the journey continues.</h2>
      <p className="outro-text">
        Today I lead AI/LLM integration on fully self-hosted models and the
        platforms security teams rely on. Want the classic one-pager, or to talk?
      </p>
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
