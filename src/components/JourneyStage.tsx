import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { buildLayout } from '../lib/layout';
import Character, { type CharacterHandle } from './Character';
import MilestoneCard from './MilestoneCard';
import Rich from './Rich';
import SkillHUD from './SkillHUD';

gsap.registerPlugin(ScrollTrigger);

// The character stands at this fraction of the viewport width; the world
// slides past so that a point at world-x meets the character when
// scroll-x = x - CHARACTER_AT * viewportWidth.
const CHARACTER_AT = 0.35;

export default function JourneyStage() {
  const layout = useMemo(() => buildLayout(), []);
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const characterRef = useRef<CharacterHandle>(null);
  const [collected, setCollected] = useState<Set<string>>(new Set());

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const world = worldRef.current;
    if (!stage || !world) return;

    const ctx = gsap.context(() => {
      const scrollDist = () =>
        Math.max(1, layout.worldWidth - window.innerWidth);

      // The card nearest the character is "active": full size, story expanded.
      const cardEls = gsap.utils.toArray<HTMLElement>('.milestone');
      let lastActive = -2;
      const updateActive = (progress: number) => {
        const charWorldX =
          scrollDist() * progress + CHARACTER_AT * window.innerWidth;
        let best = -1;
        let bestDist = Infinity;
        layout.milestones.forEach((m, i) => {
          const d = Math.abs(m.x - charWorldX);
          if (d < bestDist) {
            bestDist = d;
            best = i;
          }
        });
        const active = bestDist < 340 ? best : -1;
        if (active === lastActive) return;
        lastActive = active;
        cardEls.forEach((el, i) => el.classList.toggle('active', i === active));
      };

      // Master timeline: scroll scrubs the world horizontally.
      const worldTween = gsap.to(world, {
        x: () => -scrollDist(),
        ease: 'none',
        scrollTrigger: {
          trigger: stage,
          start: 'top top',
          end: () => `+=${scrollDist()}`,
          scrub: 0.6,
          pin: true,
          invalidateOnRefresh: true,
          onUpdate(self) {
            if (progressFillRef.current) {
              progressFillRef.current.style.width = `${self.progress * 100}%`;
            }
            updateActive(self.progress);
            const v = self.getVelocity();
            if (Math.abs(v) > 30) {
              characterRef.current?.setWalking(true, v >= 0 ? 1 : -1);
              idleTimer.restart(true);
            }
          },
        },
      });

      const idleTimer = gsap.delayedCall(0.18, () =>
        characterRef.current?.setWalking(false, 1),
      );
      idleTimer.pause();

      // Milestone cards rise in as the character approaches them.
      gsap.utils.toArray<HTMLElement>('.milestone').forEach((el) => {
        gsap.from(el, {
          autoAlpha: 0,
          y: 60,
          duration: 0.6,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el,
            containerAnimation: worldTween,
            start: 'left 85%',
            toggleActions: 'play none none reverse',
          },
        });
        if (el.dataset.celebrate) {
          ScrollTrigger.create({
            trigger: el,
            containerAnimation: worldTween,
            start: `left ${CHARACTER_AT * 100 + 8}%`,
            onEnter: () => characterRef.current?.celebrate(),
          });
        }
      });

      // Skill pickups: collected the moment the character reaches them.
      gsap.utils.toArray<HTMLElement>('.skill-pickup').forEach((el) => {
        ScrollTrigger.create({
          trigger: el,
          containerAnimation: worldTween,
          start: `left ${CHARACTER_AT * 100 + 4}%`,
          onEnter: () => {
            el.classList.add('collected');
            const id = el.dataset.skillId;
            if (id) setCollected((prev) => new Set(prev).add(id));
          },
          onLeaveBack: () => {
            el.classList.remove('collected');
            const id = el.dataset.skillId;
            if (id)
              setCollected((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
          },
        });
      });

      // Era theming: chapter under the character sets the stage palette.
      layout.chapters.forEach(({ chapter, startX }) => {
        ScrollTrigger.create({
          start: () =>
            startX - CHARACTER_AT * window.innerWidth + stageTop(stage),
          end: '+=1',
          onEnter: () => stage.setAttribute('data-theme', chapter.theme),
          onLeaveBack: () => {
            const idx = layout.chapters.findIndex((c) => c.chapter === chapter);
            const prev = layout.chapters[idx - 1];
            if (prev) stage.setAttribute('data-theme', prev.chapter.theme);
          },
        });
      });
      stage.setAttribute('data-theme', layout.chapters[0].chapter.theme);
      updateActive(worldTween.scrollTrigger?.progress ?? 0);
    }, stage);

    return () => ctx.revert();
  }, [layout]);

  const jumpTo = (x: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const target =
      stageTop(stage) +
      Math.max(0, Math.min(x - CHARACTER_AT * window.innerWidth, layout.worldWidth - window.innerWidth));
    window.scrollTo({ top: target, behavior: 'smooth' });
  };

  return (
    <section className="stage" ref={stageRef}>
      <div
        className="world"
        ref={worldRef}
        style={{ width: layout.worldWidth }}
      >
        {layout.chapters.map(({ chapter, startX, endX }) => (
          <div
            key={chapter.id}
            className={`chapter-strip theme-${chapter.theme}`}
            style={{ left: startX, width: endX - startX }}
          >
            <span className="chapter-label">{chapter.label}</span>
          </div>
        ))}

        <div className="ground" />

        {layout.milestones.map((m, i) => (
          <MilestoneCard key={m.id} milestone={m} index={i} />
        ))}

        {layout.skills.map((s) => (
          <div
            key={`${s.milestoneId}-${s.id}`}
            className="skill-pickup"
            style={{ left: s.x }}
            data-skill-id={s.id}
            title={s.label}
          >
            <span className="skill-pickup-icon">{s.icon}</span>
            <span className="skill-pickup-label">{s.label}</span>
          </div>
        ))}

        {layout.sideQuests.map((q) => (
          <div key={q.id} className="side-quest" style={{ left: q.x }}>
            <article className="side-quest-card">
              <h4>{q.title}</h4>
              <p>
                <Rich text={q.story} />
              </p>
            </article>
          </div>
        ))}
      </div>

      <Character ref={characterRef} />

      <div className="progress" role="navigation" aria-label="Timeline">
        <div className="progress-track">
          <div className="progress-fill" ref={progressFillRef} />
          {layout.yearMarkers.map((m) => (
            <button
              key={m.year}
              className="progress-year"
              style={{ left: `${(m.x / layout.worldWidth) * 100}%` }}
              onClick={() => jumpTo(m.x)}
            >
              {m.year}
            </button>
          ))}
        </div>
      </div>

      <SkillHUD collected={collected} />
    </section>
  );
}

function stageTop(stage: HTMLElement): number {
  // The stage's document offset — stable because pinning inserts a spacer
  // that keeps the trigger position fixed.
  const pinSpacer = stage.parentElement?.classList.contains('pin-spacer')
    ? stage.parentElement
    : stage;
  return pinSpacer.getBoundingClientRect().top + window.scrollY;
}
