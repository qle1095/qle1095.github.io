import { chapters, sideQuests } from '../data/journey';

// Fallback for prefers-reduced-motion: the same story as a clean vertical
// timeline, no pinning, no animation.
export default function StaticTimeline() {
  return (
    <main className="static-timeline">
      {chapters.map((chapter) => (
        <section key={chapter.id} className={`static-chapter theme-${chapter.theme}`}>
          <h2 className="static-chapter-label">{chapter.label}</h2>
          <ol>
            {chapter.milestones.map((m) => (
              <li key={m.id} className="static-milestone">
                <span className="static-date">{m.date}</span>
                <h3>{m.title}</h3>
                {m.subtitle && <p className="milestone-subtitle">{m.subtitle}</p>}
                <p>{m.story}</p>
                {m.skills && m.skills.length > 0 && (
                  <p className="static-skills">
                    {m.skills.map((s) => `${s.icon} ${s.label}`).join(' · ')}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
      <section className="static-chapter">
        <h2 className="static-chapter-label">Side Quests</h2>
        <ol>
          {sideQuests.map((q) => (
            <li key={q.id} className="static-milestone">
              <span className="static-date">{q.date}</span>
              <h3>{q.title}</h3>
              <p>{q.story}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
