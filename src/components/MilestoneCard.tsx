import { useState, type CSSProperties } from 'react';
import type { PlacedMilestone } from '../lib/layout';
import Rich from './Rich';

const KIND_META: Record<PlacedMilestone['kind'], { tag: string; icon: string }> = {
  job: { tag: 'New chapter', icon: '💼' },
  education: { tag: 'Education', icon: '🎓' },
  achievement: { tag: 'Achievement', icon: '🏆' },
  launch: { tag: 'Shipped', icon: '🚀' },
};

export default function MilestoneCard({
  milestone,
  index,
}: {
  milestone: PlacedMilestone;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const meta = KIND_META[milestone.kind];
  // Alternate post heights for rhythm; celebrate cards get a mid-tall post so
  // the bigger card still clears the ground.
  const postHeight = milestone.celebrate
    ? '4.6rem'
    : index % 2 === 0
      ? '6rem'
      : '2.4rem';

  return (
    <div
      className={[
        'milestone',
        `kind-${milestone.kind}`,
        milestone.celebrate ? 'is-celebrate' : '',
        open ? 'open' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ left: milestone.x, '--post-h': postHeight } as CSSProperties}
      data-milestone-id={milestone.id}
      data-celebrate={milestone.celebrate ? 'true' : undefined}
    >
      <article
        className="milestone-card"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
      >
        {milestone.celebrate && (
          <span className="milestone-star" aria-hidden="true">
            ★
          </span>
        )}
        <header className="milestone-head">
          <span className="milestone-tag">
            <span className="milestone-kind-icon" aria-hidden="true">
              {meta.icon}
            </span>
            {meta.tag}
          </span>
          {milestone.display && (
            <time className="milestone-date">{milestone.display}</time>
          )}
        </header>
        <h3 className="milestone-title">{milestone.title}</h3>
        {milestone.subtitle && (
          <p className="milestone-subtitle">{milestone.subtitle}</p>
        )}
        <div className="milestone-body">
          <p className="milestone-story">
            <Rich text={milestone.story} />
          </p>
        </div>
        <span className="milestone-more" aria-hidden="true">
          ▾
        </span>
      </article>
      <div className="milestone-post" />
    </div>
  );
}
