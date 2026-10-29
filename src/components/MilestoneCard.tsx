import { useState, type CSSProperties } from 'react';
import { Briefcase, ChevronDown, GraduationCap, Rocket, Star, Trophy, type LucideIcon } from 'lucide-react';
import type { Milestone, MilestoneKind } from '../data/journey';
import type { PlacedMilestone } from '../lib/layout';
import { iconSize } from '../lib/uiScale';
import Rich from './Rich';

export const KIND_META: Record<MilestoneKind, { tag: string; Icon: LucideIcon }> = {
  job: { tag: 'New role', Icon: Briefcase },
  education: { tag: 'Learning', Icon: GraduationCap },
  achievement: { tag: 'Achievement', Icon: Trophy },
  launch: { tag: 'Shipped', Icon: Rocket },
};

/** The card face, shared by the in-world signpost and flat (static / panel) layouts. */
function CardContent({ milestone }: { milestone: Milestone }) {
  const { Icon, tag } = KIND_META[milestone.kind];
  return (
    <>
      {milestone.celebrate && (
        <span className="milestone-star" aria-hidden="true">
          <Star {...iconSize(15)} strokeWidth={2.2} fill="currentColor" />
        </span>
      )}
      <header className="milestone-head">
        <span className="milestone-tag">
          <span className="milestone-kind-icon" aria-hidden="true">
            <Icon {...iconSize(14)} strokeWidth={2.2} />
          </span>
          {tag}
        </span>
        {milestone.display && <time className="milestone-date">{milestone.display}</time>}
      </header>
      <h3 className="milestone-title">{milestone.title}</h3>
      {milestone.subtitle && <p className="milestone-subtitle">{milestone.subtitle}</p>}
      {milestone.metric && (
        <p className="milestone-metric">
          <strong>{milestone.metric.value}</strong>
          <span>{milestone.metric.label}</span>
        </p>
      )}
      <div className="milestone-body">
        <p className="milestone-story">
          <Rich text={milestone.story} />
        </p>
      </div>
    </>
  );
}

const rootClass = (m: Milestone, extra: string[]) =>
  [`kind-${m.kind}`, m.celebrate ? 'is-celebrate' : '', ...extra].filter(Boolean).join(' ');

/**
 * A milestone card. The default variant is the in-world signpost: the root
 * `.milestone` is positioned by the stage (left / --post-h / .active), the
 * article is a click-to-expand button. `variant="flat"` renders the same face
 * fully expanded with no post and no positioning, for layouts outside the
 * world (static timeline, a mobile reading panel).
 */
export default function MilestoneCard({
  milestone,
  index = 0,
  onFocus,
  variant = 'world',
}: {
  milestone: PlacedMilestone | Milestone;
  index?: number;
  onFocus?: () => void;
  variant?: 'world' | 'flat';
}) {
  const [open, setOpen] = useState(false);

  if (variant === 'flat') {
    return (
      <div className={rootClass(milestone, ['milestone-flat'])} data-milestone-id={milestone.id}>
        <article className="milestone-card">
          <CardContent milestone={milestone} />
        </article>
      </div>
    );
  }

  // Alternate post heights for rhythm; celebrate cards get a mid-tall post so
  // the bigger card still clears the ground.
  const postHeight = milestone.celebrate ? '4.6rem' : index % 2 === 0 ? '6rem' : '2.4rem';
  const x = 'x' in milestone ? milestone.x : undefined;

  return (
    <div
      className={['milestone', rootClass(milestone, [open ? 'open' : ''])].join(' ')}
      style={{ left: x, '--post-h': postHeight } as CSSProperties}
      data-milestone-id={milestone.id}
      data-celebrate={milestone.celebrate ? 'true' : undefined}
    >
      <article
        className="milestone-card"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onFocus={onFocus}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
      >
        <CardContent milestone={milestone} />
        <span className="milestone-more" aria-hidden="true">
          <ChevronDown {...iconSize(16)} strokeWidth={2.2} />
        </span>
      </article>
      <div className="milestone-post" />
    </div>
  );
}
