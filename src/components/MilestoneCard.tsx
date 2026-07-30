import type { PlacedMilestone } from '../lib/layout';

const KIND_TAGS: Record<PlacedMilestone['kind'], string> = {
  job: 'New chapter',
  education: 'Education',
  achievement: 'Achievement',
  launch: 'Shipped',
};

export default function MilestoneCard({ milestone }: { milestone: PlacedMilestone }) {
  return (
    <div
      className={`milestone kind-${milestone.kind}${milestone.celebrate ? ' is-celebrate' : ''}`}
      style={{ left: milestone.x }}
      data-milestone-id={milestone.id}
      data-celebrate={milestone.celebrate ? 'true' : undefined}
    >
      <article className="milestone-card">
        <span className="milestone-tag">{KIND_TAGS[milestone.kind]}</span>
        <time className="milestone-date">{formatDate(milestone.date)}</time>
        <h3 className="milestone-title">{milestone.title}</h3>
        {milestone.subtitle && (
          <p className="milestone-subtitle">{milestone.subtitle}</p>
        )}
        <p className="milestone-story">{milestone.story}</p>
      </article>
      <div className="milestone-post" />
    </div>
  );
}

function formatDate(date: string): string {
  const [y, m] = date.split('-').map(Number);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${months[m - 1]} ${y}`;
}
