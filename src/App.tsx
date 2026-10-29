import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import Character, { type CharacterHandle } from './components/Character';
import Hero from './components/Hero';
import JourneyStage from './components/JourneyStage';
import Outro from './components/Outro';
import StaticTimeline from './components/StaticTimeline';
import TechStack from './components/TechStack';
import { jumpScroll, setScroller } from './lib/scroll';
import { uiScale } from './lib/uiScale';

gsap.registerPlugin(ScrollTrigger);

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** Where the reader is: a share of the pinned journey, or of the whole page. */
type ReadingSpot = { stage: true; p: number } | { stage: false; f: number };

const pinTrigger = () => ScrollTrigger.getAll().find((t) => t.pin);

function readingSpot(): ReadingSpot {
  const y = window.scrollY;
  const pin = pinTrigger();
  if (pin && y >= pin.start && y <= pin.end) {
    return { stage: true, p: (y - pin.start) / Math.max(1, pin.end - pin.start) };
  }
  return { stage: false, f: y / Math.max(1, ScrollTrigger.maxScroll(window)) };
}

function spotToScroll(spot: ReadingSpot): number {
  const pin = pinTrigger();
  if (spot.stage && pin) return pin.start + spot.p * (pin.end - pin.start);
  return (spot.stage ? 0 : spot.f) * ScrollTrigger.maxScroll(window);
}

/**
 * The UI scale (lib/uiScale.ts), re-read after resizes settle. CSS snaps it to
 * 0.025 steps and resizes are debounced, so the stage rebuilds once per real
 * change of the stylesheet's rem, not on every resize event. Just before a
 * change it notes where the reader is, so the rebuilt (longer or shorter)
 * journey can put them back at the same point in the story.
 */
function useUiScale() {
  const [scale, setScale] = useState(uiScale);
  const scaleRef = useRef(scale);
  const spotRef = useRef<ReadingSpot | null>(null);
  useEffect(() => {
    let t = 0;
    const onResize = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const next = uiScale();
        if (next === scaleRef.current) return;
        scaleRef.current = next;
        spotRef.current = readingSpot();
        setScale(next);
      }, 120);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', onResize);
    };
  }, []);
  return [scale, spotRef] as const;
}

export default function App() {
  const reducedMotion = usePrefersReducedMotion();
  const characterRef = useRef<CharacterHandle>(null);
  const [scale, spotRef] = useUiScale();

  // A new scale remounts the stage and the character (keys below), which
  // tears down their GSAP context / WebGL renderer and builds fresh ones.
  // Once the remount has settled, re-measure every trigger together, then
  // return the reader to the same point in the journey (unpinning the old
  // stage briefly shortens the page, so the browser clamps the scroll). A
  // task later, not in this effect: dev StrictMode re-runs the new stage's
  // effects right after this one, which would undo the jump.
  const mountedScale = useRef(scale);
  useEffect(() => {
    if (mountedScale.current === scale) return;
    mountedScale.current = scale;
    const id = window.setTimeout(() => {
      ScrollTrigger.refresh();
      const spot = spotRef.current;
      spotRef.current = null;
      if (spot) jumpScroll(spotToScroll(spot));
    }, 0);
    return () => window.clearTimeout(id);
  }, [scale, spotRef]);

  useEffect(() => {
    if (reducedMotion) return;
    const lenis = new Lenis();
    lenis.on('scroll', ScrollTrigger.update);
    setScroller(lenis);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      setScroller(null);
      lenis.destroy();
    };
  }, [reducedMotion]);

  if (reducedMotion) {
    return (
      <>
        <Hero staticMode />
        <StaticTimeline />
        <Outro staticMode />
        <TechStack />
      </>
    );
  }

  return (
    <>
      <Hero />
      {/* Fixed overlay: one character lives across the hero and the stage.
          It must NOT sit inside the pinned (transformed) stage, or
          position:fixed would break. */}
      <div className="character-layer">
        <Character key={scale} ref={characterRef} scale={scale} />
      </div>
      <JourneyStage key={scale} characterRef={characterRef} scale={scale} />
      <Outro />
      <TechStack />
    </>
  );
}
