import { ArrowUp } from 'lucide-react';
import { profile, spokenLanguages, techStack } from '../data/journey';
import SkillIcon from './SkillIcon';

/** Chip label → icon registry key. Only items with a real mark get one. */
const TECH_ICON: Record<string, string> = {
  'Active TS/SCI clearance': 'clearance',
  'CKAD (2025)': 'kubernetes',
  'CompTIA Security+ (SY0-701)': 'cert',
  'CompTIA SecurityX (in progress)': 'cert',
  Go: 'go',
  Java: 'java',
  Python: 'python',
  Scala: 'scala',
  TypeScript: 'typescript',
  JavaScript: 'javascript',
  SQL: 'sql',
  Bash: 'bash',
  'Multi-agent workflows': 'agents',
  Ollama: 'ollama',
  Kubernetes: 'kubernetes',
  Docker: 'docker',
  Helm: 'helm',
  Istio: 'istio',
  MinIO: 'minio',
  Linux: 'linux',
  Kafka: 'kafka',
  'Kafka Streams': 'kafka',
  'Kafka Connect': 'kafka',
  Avro: 'avro',
  Trino: 'trino',
  'Delta Lake': 'deltalake',
  Superset: 'superset',
  PostgreSQL: 'postgresql',
  MongoDB: 'mongodb',
  'Spring Boot': 'springboot',
  Quarkus: 'quarkus',
  'REST APIs': 'rest',
  React: 'react',
  'Material UI': 'mui',
  Keycloak: 'keycloak',
  'OPA / Rego': 'opa',
  JUnit: 'junit',
  Cypress: 'cypress',
  JMeter: 'jmeter',
  'GitLab CI/CD': 'gitlab',
  Backstage: 'backstage',
  Git: 'git',
};

/**
 * The scannable technology inventory, grouped like the resume, plus the
 * site footer. The skill pickups during the journey are a game mechanic;
 * this is the list a recruiter actually scans.
 */
export default function TechStack() {
  return (
    <>
      <section className="tech-stack" aria-labelledby="tech-stack-heading">
        <div className="tech-stack-inner">
          <h2 className="tech-stack-heading" id="tech-stack-heading">
            The full toolkit
          </h2>
          <p className="tech-stack-sub">
            Everything from the journey, plus the rest, grouped for a quick scan.
          </p>
          <div className="tech-grid">
            {techStack.map((group, gi) => (
              <div className={gi === 0 ? 'tech-group tech-group-featured' : 'tech-group'} key={group.label}>
                <h3 className="tech-group-label">{group.label}</h3>
                <ul className="tech-items">
                  {group.items.map((item) => (
                    <li className="tech-chip" key={item}>
                      {TECH_ICON[item] && <SkillIcon icon={TECH_ICON[item]} size={14} />}
                      {item}
                    </li>
                  ))}
                </ul>
                {gi === 0 && (
                  <p className="tech-spoken">
                    <span>Spoken languages:</span> {spokenLanguages.join(' · ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <p className="site-footer-name">
            <strong>{profile.name}</strong> · {profile.tagline}
          </p>
          <p className="site-footer-meta">
            Built with React, GSAP &amp; Three.js · © {new Date().getFullYear()}
          </p>
          <a
            className="site-footer-replay"
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            Replay the journey
            <ArrowUp size={16} strokeWidth={2.2} aria-hidden="true" />
          </a>
        </div>
      </footer>
    </>
  );
}
