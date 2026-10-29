import { chapters, sideQuests } from '../data/journey';
import MilestoneCard from './MilestoneCard';
import Rich from './Rich';
import SkillIcon from './SkillIcon';

// Fallback for prefers-reduced-motion: the same story as a designed vertical
// timeline (same cards, era-coloured rail), no pinning, no animation.
export default function StaticTimeline() {
  return (
    <main className="static-timeline">
      {chapters.map((chapter, ci) => (
        <section
          key={chapter.id}
          className={`static-chapter theme-${chapter.theme}`}
          aria-labelledby={`static-${chapter.id}`}
        >
          <header className="static-chapter-head">
            <span className="static-chapter-num">Chapter {String(ci + 1).padStart(2, '0')}</span>
            <h2 className="static-chapter-label" id={`static-${chapter.id}`}>
              {chapter.label}
            </h2>
            <span className="static-chapter-company">{chapter.company}</span>
          </header>
          <ol className="static-list">
            {chapter.milestones.map((m) => (
              <li key={m.id} className="static-milestone">
                <MilestoneCard milestone={m} variant="flat" />
                {m.skills && m.skills.length > 0 && (
                  <ul className="static-skills" aria-label="Skills picked up">
                    {m.skills.map((s) => (
                      <li key={s.id} className="tech-chip">
                        <SkillIcon icon={s.icon} size={14} />
                        {s.label}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
      <section className="static-chapter theme-side" aria-labelledby="static-side-quests">
        <header className="static-chapter-head">
          <span className="static-chapter-num">Optional</span>
          <h2 className="static-chapter-label" id="static-side-quests">
            Side Quests
          </h2>
        </header>
        <ol className="static-list">
          {sideQuests.map((q) => (
            <li key={q.id} className="static-milestone">
              <article className="side-quest-card">
                <h4>{q.title}</h4>
                {q.metric && (
                  <p className="milestone-metric">
                    <strong>{q.metric.value}</strong>
                    <span>{q.metric.label}</span>
                  </p>
                )}
                <p>
                  <Rich text={q.story} />
                </p>
              </article>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
