import { forwardRef, useImperativeHandle, useRef } from 'react';
import gsap from 'gsap';

// The character contract. Phase 4 swaps the placeholder body below for the
// img2threejs chibi mounted in a transparent R3F canvas — same interface,
// nothing else in the site changes.
export type CharacterHandle = {
  setWalking: (walking: boolean, direction: 1 | -1) => void;
  celebrate: () => void;
};

const Character = forwardRef<CharacterHandle>(function Character(_, ref) {
  const rootRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    setWalking(walking, direction) {
      const el = rootRef.current;
      if (!el) return;
      el.classList.toggle('walking', walking);
      el.style.setProperty('--facing', String(direction));
    },
    celebrate() {
      const el = rootRef.current;
      if (!el) return;
      gsap.fromTo(
        el,
        { y: 0 },
        {
          y: -46,
          duration: 0.28,
          ease: 'power2.out',
          yoyo: true,
          repeat: 3,
          onComplete: () => gsap.set(el, { y: 0 }),
        },
      );
    },
  }));

  // Placeholder chibi: pure CSS, animatable. Swapped for the 3D model later.
  return (
    <div className="character" ref={rootRef} aria-hidden="true">
      <div className="chibi">
        <div className="chibi-head">
          <div className="chibi-hair" />
          <div className="chibi-face">
            <span className="chibi-eye" />
            <span className="chibi-eye" />
            <span className="chibi-mouth" />
          </div>
        </div>
        <div className="chibi-body">
          <div className="chibi-arm arm-l" />
          <div className="chibi-arm arm-r" />
        </div>
        <div className="chibi-legs">
          <div className="chibi-leg leg-l" />
          <div className="chibi-leg leg-r" />
        </div>
        <div className="chibi-shadow" />
      </div>
    </div>
  );
});

export default Character;
