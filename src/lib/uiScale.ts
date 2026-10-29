// The global UI scale, S. CSS owns it: the root font-size in styles.css is
// clamp(16px, min(1.25vw, 2.2222vh), 24px), snapped to 0.025 steps, and every
// length in the stylesheet is in rem. JS reads that computed value back so
// pixel constants (world layout, character box, canvas size, offsets) are
// multiplied by exactly the same factor the stylesheet uses.

const BASE_FONT_PX = 16;

/** Current UI scale: computed root font-size / 16 (1 at <= 1280x720, up to 1.5). */
export function uiScale(): number {
  const px = parseFloat(getComputedStyle(document.documentElement).fontSize);
  if (!Number.isFinite(px) || px <= 0) return 1;
  // Snap away float noise (e.g. 23.9998px) so equal scales compare equal.
  return Math.round((px / BASE_FONT_PX) * 1000) / 1000;
}

/** A px length at S = 1, as a rem string that scales with the stylesheet. */
export const rem = (px: number): string => `${px / BASE_FONT_PX}rem`;

/**
 * Props for an inline icon (Lucide component or raw <svg>) whose design size
 * is `px` at scale 1: the attributes stay as the fallback, the inline style
 * sizes it in rem so it scales with the text around it.
 */
export const iconSize = (px: number) => ({
  size: px,
  style: { width: rem(px), height: rem(px) },
});
