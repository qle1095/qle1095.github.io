import { useState } from 'react';
import { Check, Copy, FileDown, Mail } from 'lucide-react';
import { profile } from '../data/journey';
import { iconSize } from '../lib/uiScale';

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
 * The finale: where he is today and how to reach him. The benchmarks and the
 * course live in the hero's Now panel. The empty platform beside the title
 * ([data-character-landing]) is where the character lands when he drops out
 * of the stage; keep text out of it.
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
            Today I lead our self-hosted LLM inference platform on Kubernetes
            and the organization’s AI initiative, and rehearse what comes next,
            vLLM in production, in my home lab and the{' '}
            <a href="/playground/">AI Inference Playground</a>.
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
    </section>
  );
}
