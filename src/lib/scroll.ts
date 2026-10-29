import type Lenis from 'lenis';

// Programmatic smooth scrolling that cooperates with Lenis. A native
// `scrollTo({ behavior: 'smooth' })` races Lenis' own interpolation, so when
// Lenis is running (App.tsx registers it) we ask it to do the scrolling.

let lenis: Lenis | null = null;

export function setScroller(instance: Lenis | null): void {
  lenis = instance;
}

export function smoothScrollTo(top: number): void {
  if (lenis) lenis.scrollTo(top, { duration: 1.1 });
  else window.scrollTo({ top, behavior: 'smooth' });
}
