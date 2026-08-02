import { techStack } from '../data/journey';

/**
 * The scannable technology inventory, grouped like the resume. The skill
 * pickups during the journey are a game mechanic — icon tiles a recruiter
 * can't read; this is the list they actually scan.
 */
export default function TechStack() {
  return (
    <section className="tech-stack" aria-labelledby="tech-stack-heading">
      <h2 className="tech-stack-heading" id="tech-stack-heading">
        The full toolkit
      </h2>
      <p className="tech-stack-sub">
        Everything above, unpacked — the stack behind the journey.
      </p>
      <div className="tech-grid">
        {techStack.map((group) => (
          <div className="tech-group" key={group.label}>
            <h3 className="tech-group-label">{group.label}</h3>
            <ul className="tech-items">
              {group.items.map((item) => (
                <li className="tech-chip" key={item}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
