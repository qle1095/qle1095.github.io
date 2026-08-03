import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { buildLayout } from '../lib/layout';
import { type CharacterHandle } from './Character';
import { type Outfit } from '../character/outfits';
import MilestoneCard from './MilestoneCard';
import Rich from './Rich';
import ParallaxLayer from './Scenery';
import SkillHUD from './SkillHUD';
import SoundToggle from './SoundToggle';
import { sfxCelebrate, sfxPickup } from '../lib/sfx';

gsap.registerPlugin(ScrollTrigger);

// The character stands at this fraction of the viewport width; the world
// slides past so that a point at world-x meets the character when
// scroll-x = x - CHARACTER_AT * viewportWidth.
const CHARACTER_AT = 0.35;

// What the character wears in each era.
const CHAPTER_OUTFITS: Record<string, Outfit> = {
  foundations: 'dev',
  'the-bank': 'suit',
  'startup-ascent': 'tactical',
  'platform-era': 'tactical',
  'ai-frontier': 'cyber',
};

export default function JourneyStage({
  characterRef,
}: {
  characterRef: RefObject<CharacterHandle | null>;
}) {
  const layout = useMemo(() => buildLayout(), []);
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const companyRef = useRef<HTMLDivElement>(null);
  const [collected, setCollected] = useState<Set<string>>(new Set());

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const world = worldRef.current;
    if (!stage || !world) return;

    const ctx = gsap.context(() => {
      const scrollDist = () =>
        Math.max(1, layout.worldWidth - window.innerWidth);

      // --- Hero entrance: the character waves under the name, then leaps
      // down to its walking spot as the hero scrolls away. ---
      const charLayer = document.querySelector<HTMLElement>('.character-layer');
      const heroEl = document.querySelector<HTMLElement>('.hero');
      const charW = 210;
      const heroX = () => window.innerWidth * 0.5 - charW / 2;
      const walkX = () =>
        window.innerWidth * (window.innerWidth <= 640 ? 0.22 : CHARACTER_AT);
      if (charLayer && heroEl) {
        gsap.set(charLayer, { x: heroX(), y: -14 });
        characterRef.current?.setWaving(true);
        gsap
          .timeline({
            scrollTrigger: {
              trigger: heroEl,
              start: 'top top',
              end: 'bottom 35%',
              scrub: 0.4,
              invalidateOnRefresh: true,
              onUpdate(self) {
                characterRef.current?.setWaving(self.progress < 0.06);
              },
            },
          })
          .to(charLayer, { x: () => walkX(), ease: 'none', duration: 1 }, 0)
          .to(
            charLayer,
            {
              keyframes: [
                { y: -130, ease: 'power2.out', duration: 0.42 },
                { y: 0, ease: 'power2.in', duration: 0.58 },
              ],
            },
            0,
          );
      }

      const parallaxEls = gsap.utils.toArray<HTMLElement>('.parallax', stage);

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
            const shift = scrollDist() * self.progress;
            parallaxEls.forEach((el) => {
              el.style.transform = `translate3d(${-shift * Number(el.dataset.speed)}px,0,0)`;
            });
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

      // --- Outro exit: the journey ends, the character leaps down into the
      // outro, lands center-stage below the contact buttons, and waves
      // goodbye. Scrubbed, so scrolling back reverses it.
      // NOTE: must be created AFTER the pinning trigger above, so its scroll
      // positions include the pin's added distance — otherwise its range
      // overlaps the whole pinned journey and he waves the entire way. ---
      const outroEl = document.querySelector<HTMLElement>('.outro');
      const actionsEl = outroEl?.querySelector<HTMLElement>('.outro-actions');
      if (charLayer && outroEl && actionsEl) {
        const centerX = () => window.innerWidth * 0.5 - charW / 2;

        // The canvas carries transparent padding, so his visible pixels run
        // from CHAR_HEAD to CHAR_FEET inside the layer's own box.
        const CHAR_HEAD = 27;
        const CHAR_FEET = 213;

        // His resting offset from the bottom of the viewport, cached rather
        // than read on demand. Docking (below) swaps `bottom` for a
        // document-space `top`, and getComputedStyle would then resolve
        // `bottom` against the whole document — a five-figure number that
        // throws the landing thousands of pixels off screen.
        let restBottom = parseFloat(getComputedStyle(charLayer).bottom);
        const measureRest = () => {
          if (charLayer.style.position !== 'absolute') {
            restBottom = parseFloat(getComputedStyle(charLayer).bottom);
          }
        };
        const restTop = () =>
          window.innerHeight - restBottom - charLayer.offsetHeight;

        // Where the layer box has to end up, relative to the outro's top, for
        // him to stand in the landing pad under the contact buttons. Measured
        // from the outro's real layout rather than a fraction of the viewport:
        // on short windows and on mobile — where the buttons wrap to two rows —
        // a fixed drop lands him on top of them.
        const landingInOutro = () => {
          const outroRect = outroEl.getBoundingClientRect();
          const padTop = actionsEl.getBoundingClientRect().bottom - outroRect.top;
          const pad = outroRect.height - padTop;
          return (
            padTop + Math.max(12, (pad - (CHAR_FEET - CHAR_HEAD)) / 2) - CHAR_HEAD
          );
        };

        // The drop ends when the outro's top hits 25% of the viewport (see the
        // trigger below), so the landing is a known viewport position there.
        const dropY = () =>
          window.innerHeight * 0.25 + landingInOutro() - restTop();
        gsap
          .timeline({
            scrollTrigger: {
              trigger: outroEl,
              start: 'top bottom',
              end: 'top 25%',
              scrub: 0.4,
              invalidateOnRefresh: true,
              onUpdate(self) {
                characterRef.current?.setWaving(self.progress > 0.55);
              },
              onLeaveBack() {
                characterRef.current?.setWaving(false);
              },
            },
          })
          .to(charLayer, { x: () => centerX(), ease: 'none', duration: 1 }, 0)
          .to(charLayer, { y: -70, ease: 'power2.out', duration: 0.35 }, 0)
          .to(charLayer, { y: () => dropY(), ease: 'power2.in', duration: 0.65 }, 0.35);

        // Once he has landed, hand the layer off from position:fixed to a spot
        // anchored in the page under the contact buttons — otherwise he stays
        // glued to the viewport and hovers over the tech stack below.
        // Only the `bottom` anchor is converted to a document-space `top`; the
        // drop timeline keeps owning the transform, so the swap is jump-free
        // even while the scrub is still settling.
        // `at` is the scroll position the landing belongs to — the trigger's
        // own start, not the live scroll, so a jump straight into the outro
        // (deep link, back button) docks him in the same spot as a slow scroll.
        const dock = (at: number) => {
          if (charLayer.style.position === 'absolute') return;
          charLayer.style.top = `${at + restTop()}px`;
          charLayer.style.bottom = 'auto';
          charLayer.style.position = 'absolute';
        };
        const undock = () => {
          charLayer.style.position = '';
          charLayer.style.bottom = '';
          charLayer.style.top = '';
          measureRest();
        };
        ScrollTrigger.create({
          trigger: outroEl,
          start: 'top 25%', // where the drop above ends
          end: 'max',
          invalidateOnRefresh: true,
          onEnter: (self) => dock(self.start),
          // Only scrolling back UP undocks him. Reaching the very bottom of the
          // page counts as leaving the trigger forward, and undocking there
          // would snap him back into view over the tech stack.
          onEnterBack: (self) => dock(self.start),
          onLeaveBack: undock,
          // A docked `top` is stale after a resize: undock so the resting
          // offset is re-measured against the new viewport, then re-dock.
          onRefreshInit: undock,
          onRefresh: (self) => {
            if (self.scroll() >= self.start) dock(self.start);
          },
        });
      }

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
            onEnter: () => {
              characterRef.current?.celebrate();
              sfxCelebrate();
            },
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
            sfxPickup();
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

      // Era theming: chapter under the character sets the stage palette and
      // the company badge.
      const applyChapter = (chapter: (typeof layout.chapters)[number]['chapter']) => {
        stage.setAttribute('data-theme', chapter.theme);
        characterRef.current?.setOutfit(CHAPTER_OUTFITS[chapter.id] ?? 'dev');
        const badge = companyRef.current;
        if (badge && badge.textContent !== chapter.company) {
          badge.textContent = chapter.company;
          badge.classList.remove('company-pop');
          void badge.offsetWidth; // restart the pop animation
          badge.classList.add('company-pop');
        }
      };
      layout.chapters.forEach(({ chapter, startX }) => {
        ScrollTrigger.create({
          start: () =>
            startX - CHARACTER_AT * window.innerWidth + stageTop(stage),
          end: '+=1',
          onEnter: () => applyChapter(chapter),
          onLeaveBack: () => {
            const idx = layout.chapters.findIndex((c) => c.chapter === chapter);
            const prev = layout.chapters[idx - 1];
            if (prev) applyChapter(prev.chapter);
          },
        });
      });
      applyChapter(layout.chapters[0].chapter);
      updateActive(worldTween.scrollTrigger?.progress ?? 0);
    }, stage);

    return () => {
      ctx.revert();
      // ctx.revert() only unwinds GSAP-set styles; the dock's are ours.
      const layer = document.querySelector<HTMLElement>('.character-layer');
      if (layer) layer.style.cssText = '';
    };
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
      <ParallaxLayer layout={layout} speed={0.3} band="far" />
      <ParallaxLayer layout={layout} speed={0.6} band="mid" />
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

      <div className="progress" role="navigation" aria-label="Timeline">
        <div className="company-badge" ref={companyRef} aria-live="polite" />
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
      <SoundToggle />
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
