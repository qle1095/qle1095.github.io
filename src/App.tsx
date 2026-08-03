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

export default function App() {
  const reducedMotion = usePrefersReducedMotion();
  const characterRef = useRef<CharacterHandle>(null);

  useEffect(() => {
    if (reducedMotion) return;
    const lenis = new Lenis();
    lenis.on('scroll', ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
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
        <Character ref={characterRef} />
      </div>
      <JourneyStage characterRef={characterRef} />
      <Outro />
      <TechStack />
    </>
  );
}
