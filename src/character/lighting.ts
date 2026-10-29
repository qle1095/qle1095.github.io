/**
 * Shared character lighting rig: used by the site (Character.tsx) and by the
 * review harness (preview-chibi.html?site=1) so look-dev matches production.
 *
 * Designer-vinyl studio setup: warm key from upper-front, soft frontal fill,
 * cool hemisphere bounce and a cool rim from behind so the silhouette (dark
 * hair, navy suit, black techwear) separates from both the light dawn skies
 * and the dark frontier sky.
 */
import * as THREE from 'three';

export const CHARACTER_TONE = {
  toneMapping: THREE.ACESFilmicToneMapping,
  exposure: 1.25,
  envIntensity: 0.5,
} as const;

export function addCharacterLights(scene: THREE.Scene): THREE.Light[] {
  // Warm sky / cool ground bounce, a little lower than before so skin keeps
  // its warmth instead of blowing out to white under ACES.
  const hemi = new THREE.HemisphereLight(0xfff0de, 0x8d95b0, 0.95);
  // Warm key, upper front (lights the face on the walk-facing 3/4 turn).
  const key = new THREE.DirectionalLight(0xffe9cf, 2.25);
  key.position.set(1.2, 2.4, 2.2);
  // Soft fill from the other side of the camera so the near cheek never
  // goes muddy.
  const fill = new THREE.DirectionalLight(0xfff7f0, 0.5);
  fill.position.set(-1.4, 0.8, 3);
  // Cool rim from behind: separates dark hair / navy / techwear from the dark
  // frontier sky.
  const rim = new THREE.DirectionalLight(0xc4dcff, 1.25);
  rim.position.set(-1.6, 1.8, -2);
  const lights = [hemi, key, fill, rim];
  lights.forEach((l) => scene.add(l));
  return lights;
}
