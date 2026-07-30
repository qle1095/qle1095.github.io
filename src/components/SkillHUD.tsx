import { allSkills } from '../data/journey';

// Compact game-style inventory: icon tiles, the newest pickup keeps its label.
export default function SkillHUD({ collected }: { collected: Set<string> }) {
  const items = allSkills.filter((s) => collected.has(s.id));
  const newest = items[items.length - 1];
  return (
    <aside className="skill-hud" aria-label="Skills collected so far">
      <span className="skill-hud-label">
        Skills {items.length}/{allSkills.length}
      </span>
      <div className="skill-hud-items">
        {items.map((s) => (
          <span key={s.id} className="skill-hud-badge" title={s.label}>
            <span className="skill-hud-icon">{s.icon}</span>
            {s === newest && <span className="skill-hud-name">{s.label}</span>}
          </span>
        ))}
      </div>
    </aside>
  );
}
