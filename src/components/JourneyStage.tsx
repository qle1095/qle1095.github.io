import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { buildLayout, type PlacedChapter } from '../lib/layout';
import { type CharacterHandle } from './Character';
import { type Outfit } from '../character/outfits';
import MilestoneCard from './MilestoneCard';
import Rich from './Rich';
import ParallaxLayer from './Scenery';
import SkillHUD from './SkillHUD';
import SoundToggle from './SoundToggle';
import SkillIcon from './SkillIcon';
import { sfxCelebrate, sfxFinale, sfxPickup } from '../lib/sfx';
import { smoothScrollTo } from '../lib/scroll';

gsap.registerPlugin(ScrollTrigger);

// The character stands at this fraction of the viewport width; the world
// slides past so that a point at world-x meets his centre when
// scroll-x = x - charCenter(). On phones the cards move to a screen-space
// panel, so he can stand nearer the middle.
const CHARACTER_AT = 0.35;
const CHARACTER_AT_MOBILE = 0.45;
const MOBILE_MAX = 640;

// Every px constant below is at UI scale 1 and is multiplied by the stage's
// `scale` prop (lib/uiScale.ts) where it is used; charCenter() is a fraction
// of the viewport, so it needs no scaling.

// The `.character` box is 210px wide and his canvas overflows it
// symmetrically, so the layer's left edge is his centre minus half of that.
const CHAR_W = 210;
// The canvas carries transparent padding: his visible pixels run from
// CHAR_HEAD to CHAR_FEET inside the layer's own box.
const CHAR_HEAD = 27;
const CHAR_FEET = 213;

// Cards are signposts read AHEAD of him, never through him. A card is active
// only while its left edge is at least CHAR_CLEAR right of his centre (his
// visible half-width plus air), and it is in its ideal reading spot when it
// sits CARD_LEAD ahead. The stage stops once the last card reaches that spot.
const CHAR_CLEAR = 64;
const CARD_LEAD = 300;
const FINALE_LEAD_MOBILE = 30;

const isMobile = () => window.innerWidth <= MOBILE_MAX;
const charCenter = () =>
  window.innerWidth * (isMobile() ? CHARACTER_AT_MOBILE : CHARACTER_AT);

// What the character wears in each era.
const CHAPTER_OUTFITS: Record<string, Outfit> = {
  foundations: 'dev',
  'the-bank': 'suit',
  'startup-ascent': 'tactical',
  'platform-era': 'tactical',
  'ai-frontier': 'cyber',
};

function useIsMobile() {
  const [mobile, setMobile] = useState(isMobile);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`);
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
}

/**
 * The pinned journey. Built once for a UI `scale`: when the scale changes,
 * App remounts the stage (key) so the world, its GSAP context and every
 * scaled constant are rebuilt from scratch rather than patched.
 */
export default function JourneyStage({
  characterRef,
  scale = 1,
}: {
  characterRef: RefObject<CharacterHandle | null>;
  scale?: number;
}) {
  const S = scale;
  const layout = useMemo(() => buildLayout(S), [S]);
  const charW = CHAR_W * S;
  const charHead = CHAR_HEAD * S;
  const charFeet = CHAR_FEET * S;
  const charClear = CHAR_CLEAR * S;
  const cardLead = CARD_LEAD * S;
  const finaleLeadMobile = FINALE_LEAD_MOBILE * S;
  const mobile = useIsMobile();
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(-1);
  const [collected, setCollected] = useState<Set<string>>(new Set());
  const [chapterIdx, setChapterIdx] = useState(0);
  const [titleCard, setTitleCard] = useState<{ idx: number; n: number } | null>(null);
  const [panel, setPanel] = useState<{ cur: number; prev: number }>({ cur: -1, prev: -1 });

  const lastX = layout.milestones[layout.milestones.length - 1].x;
  // Horizontal scroll distance: until the last card sits in its reading spot.
  const scrollDist = () =>
    Math.max(1, lastX - (isMobile() ? finaleLeadMobile : cardLead) - charCenter());

  // Scroll so the character stands at world-x `x` (clamped to the stage).
  const jumpTo = (x: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const target =
      stageTop(stage) + Math.max(0, Math.min(x - charCenter(), scrollDist()));
    smoothScrollTo(target);
  };
  // Where he stands while milestone i is being read.
  const milestoneSpot = (i: number) =>
    layout.milestones[i].x - (isMobile() ? finaleLeadMobile : cardLead);
  const navRef = useRef({ idx: -1, at: 0 });
  const goToMilestone = (i: number) => {
    const n = Math.max(0, Math.min(layout.milestones.length - 1, i));
    navRef.current = { idx: n, at: performance.now() };
    jumpTo(milestoneSpot(n));
  };

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const world = worldRef.current;
    if (!stage || !world) return;

    const ctx = gsap.context(() => {
      const charLayer = document.querySelector<HTMLElement>('.character-layer');
      const heroEl = document.querySelector<HTMLElement>('.hero');

      // His resting offset from the bottom of the viewport, cached rather
      // than read on demand. Docking (below) swaps `bottom` for a
      // document-space `top`, and getComputedStyle would then resolve
      // `bottom` against the whole document — a five-figure number.
      let restBottom = charLayer ? parseFloat(getComputedStyle(charLayer).bottom) : 0;
      const measureRest = () => {
        if (charLayer && charLayer.style.position !== 'absolute') {
          restBottom = parseFloat(getComputedStyle(charLayer).bottom);
        }
      };
      const restTop = () =>
        window.innerHeight - restBottom - (charLayer?.offsetHeight ?? 0);
      const walkX = () => charCenter() - charW / 2;

      // --- Hero: he stands on the hero's character slot (centred on it, feet
      // on its bottom edge), rides up with it for a moment as the page
      // scrolls, then leaps down to his walking spot. Falls back to the
      // middle of the screen if the hero has no slot. ---
      const slotRect = () => {
        const slot = document.querySelector<HTMLElement>('[data-character-slot]');
        if (!slot || !slot.offsetWidth) return null;
        const r = slot.getBoundingClientRect();
        // Document coordinates == viewport coordinates at scroll 0.
        return { cx: r.left + r.width / 2, bottom: r.bottom + window.scrollY };
      };
      const heroX = () => {
        const s = slotRect();
        return (s ? s.cx : window.innerWidth * 0.5) - charW / 2;
      };
      const heroY = () => {
        const s = slotRect();
        return s ? s.bottom - charFeet - restTop() : -14 * S;
      };
      if (charLayer && heroEl) {
        characterRef.current?.setWaving(true);
        const heroDist = () => Math.max(1, heroEl.offsetHeight - window.innerHeight * 0.35);
        const RIDE = 0.3; // share of the hero scroll he spends riding the slot
        const UP = (1 - RIDE) * 0.42; // share of the leap spent rising
        const rideEnd = () => heroY() - heroDist() * RIDE;
        const apex = () => Math.min(rideEnd(), 0) - 110 * S;
        gsap
          .timeline({
            scrollTrigger: {
              trigger: heroEl,
              start: 'top top',
              end: 'bottom 35%',
              // A touch slower than the outro's 0.4: after a jump straight
              // from the outro back to the top both reverse at once, and the
              // hero (which must win) then renders last.
              scrub: 0.5,
              invalidateOnRefresh: true,
              onUpdate(self) {
                characterRef.current?.setWaving(self.progress < 0.06);
              },
            },
          })
          // Every value is explicit (fromTo), so nothing depends on where
          // the layer happened to be when a tween first recorded its start.
          .fromTo(
            charLayer,
            { x: heroX, y: heroY },
            { x: heroX, y: rideEnd, ease: 'none', duration: RIDE },
            0,
          )
          .fromTo(
            charLayer,
            { x: heroX },
            {
              x: walkX,
              ease: 'power1.inOut',
              duration: 1 - RIDE,
              immediateRender: false,
            },
            RIDE,
          )
          .fromTo(
            charLayer,
            { y: rideEnd },
            { y: apex, ease: 'power2.out', duration: UP, immediateRender: false },
            RIDE,
          )
          .fromTo(
            charLayer,
            { y: apex },
            { y: 0, ease: 'power2.in', duration: 1 - RIDE - UP, immediateRender: false },
            RIDE + UP,
          );
      }

      const parallaxEls = gsap.utils.toArray<HTMLElement>('.parallax', stage);
      const cardEls = gsap.utils.toArray<HTMLElement>('.milestone', world);
      const pickupEls = gsap.utils.toArray<HTMLElement>('.skill-pickup', world);

      // Card half-widths, cached (read on refresh, not per frame).
      let halfW: number[] = [];
      const measureCards = () => {
        halfW = cardEls.map((el) => el.offsetWidth / 2);
      };
      measureCards();

      // Desktop: the first card whose left edge is still clear ahead of him.
      // Mobile: the post he is standing at (the card itself is in the panel).
      const activeAt = (cx: number) => {
        const ms = layout.milestones;
        if (isMobile()) {
          let best = -1;
          let bestD = Infinity;
          ms.forEach((m, i) => {
            const d = Math.abs(m.x - cx);
            if (d < bestD) {
              bestD = d;
              best = i;
            }
          });
          return bestD < 420 * S ? best : -1;
        }
        for (let i = 0; i < ms.length; i++) {
          if (ms[i].x - (halfW[i] ?? 168 * S) >= cx + charClear) {
            return ms[i].x - cx < window.innerWidth ? i : -1;
          }
        }
        return -1;
      };
      const setActive = (i: number) => {
        if (i === activeRef.current) return;
        activeRef.current = i;
        cardEls.forEach((el, k) => el.classList.toggle('active', k === i));
        setPanel((p) => (p.cur === i ? p : { cur: i, prev: p.cur }));
      };

      // Skills: collected the moment he reaches them; only the next one ahead
      // shows its label.
      const got = layout.skills.map(() => false);
      let nextPickup = -2;
      const flyToHud = (el: HTMLElement) => {
        const icon = el.querySelector<HTMLElement>('.skill-pickup-icon');
        const target = document.querySelector<HTMLElement>('.skill-hud');
        if (!icon || !target) return;
        const from = icon.getBoundingClientRect();
        const to = target.getBoundingClientRect();
        if (!from.width || !to.width) return;
        const ghost = icon.cloneNode(true) as HTMLElement;
        ghost.className = 'skill-pickup-ghost';
        Object.assign(ghost.style, { left: `${from.left}px`, top: `${from.top}px` });
        document.body.appendChild(ghost);
        gsap.to(ghost, {
          x: to.left + Math.min(to.width, 120 * S) / 2 - from.left - from.width / 2,
          y: to.top + to.height / 2 - from.top - from.height / 2,
          scale: 0.55,
          duration: 0.55,
          ease: 'power2.in',
          onComplete: () => ghost.remove(),
        });
      };
      const updatePickups = (cx: number, forward: boolean) => {
        let changed = false;
        layout.skills.forEach((s, i) => {
          const has = s.x <= cx + 18 * S;
          if (has === got[i]) return;
          got[i] = has;
          changed = true;
          const el = pickupEls[i];
          el.classList.toggle('collected', has);
          if (has && forward) {
            sfxPickup();
            flyToHud(el);
          }
        });
        if (changed) {
          setCollected(new Set(layout.skills.filter((_, i) => got[i]).map((s) => s.id)));
        }
        const next = got.indexOf(false);
        if (next !== nextPickup) {
          pickupEls[nextPickup]?.classList.remove('is-next');
          pickupEls[next]?.classList.add('is-next');
          nextPickup = next;
        }
      };

      // Era theming: the chapter under the character sets the stage palette,
      // outfit and chapter chip; entering a new chapter shows its title card.
      let chapterNow = -1;
      const applyChapter = (i: number, announce: boolean) => {
        if (i === chapterNow) return;
        const forward = i > chapterNow;
        chapterNow = i;
        const { chapter } = layout.chapters[i];
        stage.setAttribute('data-theme', chapter.theme);
        characterRef.current?.setOutfit(CHAPTER_OUTFITS[chapter.id] ?? 'dev');
        setChapterIdx(i);
        if (announce && forward) setTitleCard((t) => ({ idx: i, n: (t?.n ?? 0) + 1 }));
      };
      const chapterAt = (cx: number) => {
        let idx = 0;
        layout.chapters.forEach((c, i) => {
          if (c.startX <= cx) idx = i;
        });
        return idx;
      };

      // Celebrate a card when it reaches its reading spot (scrolling forward).
      // The last card instead gets the finale beat at the end of the pin.
      const lastIdx = layout.milestones.length - 1;
      const celebrateAt = layout.milestones
        .map((m, i) => (m.celebrate && i !== lastIdx ? m.x - cardLead : null))
        .filter((x): x is number => x !== null);
      let prevCx = -Infinity;
      let finaleArmed = true;
      let started = false;

      const finale = () => {
        characterRef.current?.celebrate();
        sfxFinale();
        const s = stage.getBoundingClientRect();
        const r = cardEls[lastIdx]?.getBoundingClientRect();
        const onCard = !isMobile() && r && r.width > 0;
        const ox = onCard ? r.left + r.width / 2 - s.left : charCenter();
        const oy = onCard ? r.top - s.top + 12 * S : s.height * 0.55;
        confetti(stage, ox, oy, S);
      };

      // Everything that follows the world's actual (scrub-smoothed) position.
      const onWorld = (p: number) => {
        const sd = scrollDist();
        const shift = sd * p;
        const cx = shift + charCenter();
        parallaxEls.forEach((el) => {
          el.style.transform = `translate3d(${-shift * Number(el.dataset.speed)}px,0,0)`;
        });
        if (progressFillRef.current) {
          progressFillRef.current.style.transform = `scaleX(${p})`;
        }
        const forward = cx > prevCx;
        setActive(p > 0.985 ? lastIdx : activeAt(cx));
        updatePickups(cx, started && forward);
        applyChapter(chapterAt(cx), started);
        if (started && forward) {
          if (celebrateAt.some((x) => prevCx < x && x <= cx)) {
            characterRef.current?.celebrate();
            sfxCelebrate();
          }
          if (finaleArmed && p > 0.985) {
            finaleArmed = false;
            finale();
          }
        }
        if (p < 0.9) finaleArmed = true;
        prevCx = cx;
      };

      // Master timeline: scroll scrubs the world horizontally.
      const worldTween = gsap.to(world, {
        x: () => -scrollDist(),
        ease: 'none',
        onUpdate(this: gsap.core.Tween) {
          onWorld(this.progress());
        },
        scrollTrigger: {
          trigger: stage,
          start: 'top top',
          end: () => `+=${scrollDist()}`,
          scrub: 0.6,
          pin: true,
          invalidateOnRefresh: true,
          onUpdate(self) {
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
      // outro and lands on its [data-character-landing] platform (centred on
      // it, feet on its bottom edge), then waves goodbye. Scrubbed, so
      // scrolling back reverses it. Outro content is stacked above the
      // character layer (styles.css), so the arc passes behind the text.
      // NOTE: must be created AFTER the pinning trigger above, so its scroll
      // positions include the pin's added distance. ---
      const outroEl = document.querySelector<HTMLElement>('.outro');
      const landingEl =
        outroEl?.querySelector<HTMLElement>('[data-character-landing]') ??
        outroEl?.querySelector<HTMLElement>('.outro-actions');
      if (charLayer && outroEl && landingEl) {
        const isSlot = landingEl.hasAttribute('data-character-landing');

        // Where the layer box has to end up, relative to the outro's top.
        // Measured from the outro's real layout, not a fraction of the
        // viewport, since the content reflows on short and narrow windows.
        const landing = () => {
          const outroRect = outroEl.getBoundingClientRect();
          const r = landingEl.getBoundingClientRect();
          if (isSlot) {
            return {
              x: r.left + r.width / 2 - charW / 2,
              top: r.bottom - outroRect.top - charFeet,
            };
          }
          // Legacy fallback: centred in the pad under the contact row.
          const padTop = r.bottom - outroRect.top;
          const pad = outroRect.height - padTop;
          return {
            x: window.innerWidth * 0.5 - charW / 2,
            top: padTop + Math.max(12 * S, (pad - (charFeet - charHead)) / 2) - charHead,
          };
        };

        // The drop ends when the outro's top hits 25% of the viewport (see the
        // trigger below), so the landing is a known viewport position there.
        const dropY = () => window.innerHeight * 0.25 + landing().top - restTop();
        // The fixed layer paints above the outro (which is its own stacking
        // context), so the arc must avoid the copy rather than pass behind
        // it. Side by side (desktop): he crosses to the landing column first,
        // while only the outro's top padding is under him, then hops down
        // into it. Stacked (the landing sits below the copy): the copy has to
        // scroll past him, so he blinks out on the hop and is back, docked on
        // the platform, by the time it scrolls into view.
        const sideBySide = () => {
          const title = outroEl.querySelector<HTMLElement>('h2');
          if (!title) return true;
          const a = title.getBoundingClientRect();
          const b = landingEl.getBoundingClientRect();
          return b.left >= a.right - 1 || b.right <= a.left + 1;
        };
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
          // Starts a hair after 0 so that while this timeline sits at its
          // start (the whole time he is in the hero or stage) it renders
          // nothing, and never overrides the hero timeline's values.
          .fromTo(
            charLayer,
            { x: walkX },
            {
              x: () => landing().x,
              ease: 'power1.inOut',
              duration: 0.35,
              immediateRender: false,
            },
            0.001,
          )
          .fromTo(
            charLayer,
            { y: 0 },
            {
              y: () => Math.min(0, dropY()) - 80 * S,
              ease: 'power2.out',
              duration: 0.4,
              immediateRender: false,
            },
            0.001,
          )
          .to(charLayer, { y: dropY, ease: 'power2.in', duration: 0.6 }, 0.401)
          .fromTo(
            charLayer,
            { opacity: 1 },
            {
              opacity: () => (sideBySide() ? 1 : 0),
              ease: 'none',
              duration: 0.12,
              immediateRender: false,
            },
            0.1,
          )
          .to(charLayer, { opacity: 1, ease: 'none', duration: 0.05 }, 0.95);

        // Once he has landed, hand the layer off from position:fixed to a spot
        // anchored in the page — otherwise he stays glued to the viewport and
        // hovers over the tech stack below. Only the `bottom` anchor becomes a
        // document-space `top`; the drop timeline keeps owning the transform,
        // so the swap is jump-free. `at` is the trigger's own start, so a jump
        // straight into the outro docks him in the same spot as a slow scroll.
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
          // Only scrolling back UP undocks him: reaching the very bottom of
          // the page counts as leaving forward.
          onEnterBack: (self) => dock(self.start),
          onLeaveBack: undock,
          // A docked `top` is stale after a resize: undock so the resting
          // offset is re-measured, then re-dock.
          onRefreshInit: undock,
          onRefresh: (self) => {
            if (self.scroll() >= self.start) dock(self.start);
          },
        });
      }

      // Milestone cards rise in as the character approaches them. Opacity
      // and y only: visibility:hidden would make unseen cards unfocusable.
      cardEls.forEach((el) => {
        gsap.from(el, {
          opacity: 0,
          y: 60 * S,
          duration: 0.6,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el,
            containerAnimation: worldTween,
            start: 'left 92%',
            toggleActions: 'play none none reverse',
          },
        });
      });

      // Progress bar: years and chapter segments are placed by where the
      // character is when he reaches them, as a fraction of the scroll.
      const placeProgress = () => {
        const track = trackRef.current;
        if (!track) return;
        const sd = scrollDist();
        const c = charCenter();
        const frac = (x: number) => Math.max(0, Math.min(1, (x - c) / sd));
        track.querySelectorAll<HTMLElement>('.progress-seg').forEach((el, i) => {
          const ch = layout.chapters[i];
          const a = frac(ch.startX);
          const b = i === layout.chapters.length - 1 ? 1 : frac(ch.endX);
          el.style.left = `${a * 100}%`;
          el.style.width = `${(b - a) * 100}%`;
        });
        // Drop any year label within 44px (scaled) of the previous one shown.
        const w = track.offsetWidth;
        let lastShown = -Infinity;
        track.querySelectorAll<HTMLElement>('.progress-year').forEach((el) => {
          const f = frac(Number(el.dataset.x));
          el.style.left = `${f * 100}%`;
          const show = f * w - lastShown >= 44 * S;
          el.classList.toggle('is-dropped', !show);
          if (show) lastShown = f * w;
        });
      };

      const onRefresh = () => {
        measureCards();
        placeProgress();
      };
      ScrollTrigger.addEventListener('refresh', onRefresh);
      placeProgress();

      // ←/→ step between milestones while the stage is on screen.
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        const t = e.target;
        if (t instanceof Element && t.closest('input, textarea, select, [contenteditable="true"]')) return;
        if (!worldTween.scrollTrigger?.isActive) return;
        e.preventDefault();
        const nav = navRef.current;
        const cur = performance.now() - nav.at < 1200 ? nav.idx : activeRef.current;
        if (cur < 0) goToMilestone(0);
        else goToMilestone(cur + (e.key === 'ArrowRight' ? 1 : -1));
      };
      window.addEventListener('keydown', onKey);

      onWorld(worldTween.progress());
      started = true;

      return () => {
        ScrollTrigger.removeEventListener('refresh', onRefresh);
        window.removeEventListener('keydown', onKey);
        document.querySelectorAll('.skill-pickup-ghost, .confetti').forEach((n) => n.remove());
      };
    }, stage);

    return () => {
      ctx.revert();
      // ctx.revert() only unwinds GSAP-set styles; the dock's are ours.
      const layer = document.querySelector<HTMLElement>('.character-layer');
      if (layer) layer.style.cssText = '';
    };
    // The effect reads only stable values (layout, refs, module helpers).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  // React rewrites a card's className when it re-renders (e.g. opening it),
  // which drops the imperatively-set `active`; put it back.
  useLayoutEffect(() => {
    worldRef.current
      ?.querySelectorAll<HTMLElement>('.milestone')
      .forEach((el, k) => el.classList.toggle('active', k === activeRef.current));
  });

  const panelItems = mobile
    ? [panel.prev, panel.cur].filter((i, k, a) => i >= 0 && a.indexOf(i) === k)
    : [];

  return (
    <section className="stage" ref={stageRef} data-theme={layout.chapters[0].chapter.theme}>
      <ParallaxLayer layout={layout} speed={0.2} band="far" />
      <div className="stage-haze" aria-hidden="true" />
      <ParallaxLayer layout={layout} speed={0.45} band="mid" />
      <ParallaxLayer layout={layout} speed={0.75} band="near" />

      {/* Static wrapper so the edge fades stay put while the world moves. */}
      <div className="stage-viewport">
        <div
          className="world"
          ref={worldRef}
          style={{ width: `calc(${layout.worldWidth}px + 100vw)` }}
        >
          <div className="ground" />

          {layout.milestones.map((m, i) => (
            <MilestoneCard
              key={m.id}
              milestone={m}
              index={i}
              onFocus={() => goToMilestone(i)}
            />
          ))}

          {layout.skills.map((s) => (
            <div
              key={`${s.milestoneId}-${s.id}`}
              className="skill-pickup"
              style={{ left: s.x }}
              data-skill-id={s.id}
              title={s.label}
            >
              <span className="skill-pickup-icon">
                <SkillIcon icon={s.icon} size={20} tile />
              </span>
              <span className="skill-pickup-label">{s.label}</span>
            </div>
          ))}

          {layout.sideQuests.map((q) => (
            <div key={q.id} className="side-quest" style={{ left: q.x }}>
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
            </div>
          ))}
        </div>
      </div>

      <div className="progress" role="navigation" aria-label="Timeline">
        <ChapterChip chapter={layout.chapters[chapterIdx]} index={chapterIdx} />
        <div className="progress-bar">
          <div className="progress-track" ref={trackRef}>
            {layout.chapters.map(({ chapter: c }) => (
              <span key={c.id} className={`progress-seg era-${c.theme}`} />
            ))}
            <div className="progress-fill" ref={progressFillRef} />
            {layout.yearMarkers.map((m) => (
              <button
                type="button"
                key={m.year}
                className="progress-year"
                data-x={m.x}
                onClick={() => jumpTo(m.x)}
                aria-label={`Jump to ${m.year}`}
              >
                {m.year}
              </button>
            ))}
          </div>
        </div>
      </div>

      {titleCard && (
        <div
          key={titleCard.n}
          className="chapter-title-card"
          aria-hidden="true"
          onAnimationEnd={() => setTitleCard(null)}
        >
          <span>Chapter {String(titleCard.idx + 1).padStart(2, '0')}</span>
          <strong>{layout.chapters[titleCard.idx].chapter.label}</strong>
        </div>
      )}

      {mobile && (
        <div className="reading-panel" aria-live="polite">
          {panelItems.map((i) => (
            <div
              key={layout.milestones[i].id}
              className={`reading-panel-item${i === panel.cur ? '' : ' is-leaving'}`}
              aria-hidden={i === panel.cur ? undefined : true}
            >
              <MilestoneCard milestone={layout.milestones[i]} variant="flat" />
            </div>
          ))}
        </div>
      )}

      <SkillHUD collected={collected} />
      <SoundToggle />
    </section>
  );
}

/** Screen-space chapter chip: `CHAPTER 03 · 2022–2023` over `Label · Company`. */
function ChapterChip({ chapter, index }: { chapter: PlacedChapter; index: number }) {
  const { label, company } = chapter.chapter;
  const years =
    chapter.startYear === chapter.endYear
      ? `${chapter.startYear}`
      : `${chapter.startYear}–${chapter.endYear}`;
  return (
    <div className="chapter-chip" aria-live="polite">
      {/* Keyed so the slide-up replays on every chapter change. */}
      <span className="chapter-chip-inner" key={chapter.chapter.id}>
        <span className="chapter-chip-eyebrow">
          Chapter {String(index + 1).padStart(2, '0')} · {years}
        </span>
        <span className="chapter-chip-title">
          {label} <span className="chapter-chip-company">· {company}</span>
        </span>
      </span>
    </div>
  );
}

/** A small hand-rolled confetti burst in screen space (transform/opacity only). */
function confetti(host: HTMLElement, x: number, y: number, S = 1) {
  const layer = document.createElement('div');
  layer.className = 'confetti';
  host.appendChild(layer);
  const colors = ['#ffc933', '#ff7a59', '#7df9ff', '#8f9bff', '#ffffff', '#2c9c72'];
  for (let i = 0; i < 46; i++) {
    const p = document.createElement('i');
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.background = colors[i % colors.length];
    if (i % 3 === 0) p.style.borderRadius = '50%';
    layer.appendChild(p);
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.95;
    const speed = (160 + Math.random() * 220) * S;
    gsap
      .timeline()
      .to(p, {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed,
        rotation: (Math.random() - 0.5) * 540,
        duration: 0.55,
        ease: 'power3.out',
      })
      .to(p, {
        y: `+=${(260 + Math.random() * 160) * S}`,
        x: `+=${(Math.random() - 0.5) * 80 * S}`,
        rotation: `+=${(Math.random() - 0.5) * 360}`,
        opacity: 0,
        duration: 1.3 + Math.random() * 0.5,
        ease: 'power1.in',
      });
  }
  gsap.delayedCall(2.6, () => layer.remove());
}

function stageTop(stage: HTMLElement): number {
  // The stage's document offset — stable because pinning inserts a spacer
  // that keeps the trigger position fixed.
  const pinSpacer = stage.parentElement?.classList.contains('pin-spacer')
    ? stage.parentElement
    : stage;
  return pinSpacer.getBoundingClientRect().top + window.scrollY;
}
