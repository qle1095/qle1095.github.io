import { useEffect, useRef, useState } from 'react';
import { allSkills, type Skill } from '../data/journey';
import SkillIcon from './SkillIcon';

const VISIBLE = 10; // newest tiles shown in the tray; the rest collapse into "+N"
const TOAST_MS = 1500;

// Game-style inventory. One fixed-height row of logo tiles (newest last), a
// brief toast naming each new pickup, and a popover with the readable list.
// On phones it collapses to a pill (see .skill-hud in styles.css).
export default function SkillHUD({ collected }: { collected: Set<string> }) {
  const items = allSkills.filter((s) => collected.has(s.id));
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<Skill | null>(null);
  const prev = useRef<Set<string>>(new Set());
  const root = useRef<HTMLDivElement>(null);

  // Toast only on gains: walking backwards un-collects silently.
  useEffect(() => {
    const gained = allSkills.filter((s) => collected.has(s.id) && !prev.current.has(s.id));
    prev.current = new Set(collected);
    if (gained.length === 0) return;
    setToast(gained[gained.length - 1]);
    const t = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [collected]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const shown = items.slice(-VISIBLE);
  const hidden = items.length - shown.length;
  const newest = items[items.length - 1];

  return (
    <div className="skill-hud" ref={root} data-empty={items.length === 0 || undefined}>
      {toast && (
        <span className="skill-hud-toast" key={toast.id} role="status">
          <SkillIcon icon={toast.icon} size={14} />
          {toast.label} unlocked
        </span>
      )}
      <button
        type="button"
        className="skill-hud-tray"
        aria-expanded={open}
        aria-controls="skill-hud-list"
        aria-label={`Skills unlocked: ${items.length} of ${allSkills.length}. Show list`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="skill-hud-label">
          <span className="skill-hud-label-text">
            Skills<span className="skill-hud-label-long"> unlocked</span>
          </span>
          <span className="skill-hud-count">
            {items.length}/{allSkills.length}
          </span>
        </span>
        <span className="skill-hud-items" aria-hidden="true">
          {hidden > 0 && <span className="skill-hud-more">+{hidden}</span>}
          {shown.map((s) => (
            <SkillIcon key={s.id} icon={s.icon} size={18} tile className="skill-hud-tile" />
          ))}
        </span>
        {/* Phone pill: just the latest mark next to the count. */}
        {newest && (
          <span className="skill-hud-latest" aria-hidden="true">
            <SkillIcon icon={newest.icon} size={14} tile />
          </span>
        )}
      </button>
      {open && (
        <div className="skill-hud-popover" id="skill-hud-list" role="region" aria-label="Skills unlocked" data-lenis-prevent>
          <p className="skill-hud-popover-title">
            Skills unlocked · {items.length}/{allSkills.length}
          </p>
          {items.length === 0 ? (
            <p className="skill-hud-empty">Walk the journey to pick some up.</p>
          ) : (
            <ul className="skill-hud-list">
              {items.map((s) => (
                <li key={s.id}>
                  <SkillIcon icon={s.icon} size={16} tile />
                  {s.label}
                </li>
              ))}
            </ul>
          )}
          <p className="skill-hud-foot">Full toolkit at the end ↓</p>
        </div>
      )}
    </div>
  );
}
