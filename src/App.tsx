import { useEffect, useMemo, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import Hero from './components/Hero';
import JourneyStage from './components/JourneyStage';
import Outro from './components/Outro';
import StaticTimeline from './components/StaticTimeline';

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

  const lenis = useMemo(() => {
    if (reducedMotion) return null;
    return new Lenis();
  }, [reducedMotion]);

  useEffect(() => {
    if (!lenis) return;
    lenis.on('scroll', ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, [lenis]);

  if (reducedMotion) {
    return (
      <>
        <Hero staticMode />
        <StaticTimeline />
        <Outro />
      </>
    );
  }

  return (
    <>
      <Hero />
      <JourneyStage />
      <Outro />
    </>
  );
}
