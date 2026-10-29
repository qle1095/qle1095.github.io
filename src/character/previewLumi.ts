/**
 * Lumi-only review harness (preview-lumi.html). Renders createLumiModel close
 * up, or at the exact on-site framing and pixel size, for likeness review.
 *
 * URL params:
 *   ?view=front|three-quarter|site-angle|side|left|back|top|face|face34
 *   ?pose=idle|trot|sit-wave        static pose via the site's animateLumi
 *   ?phase=<radians>                trot phase (default 0.9)
 *   ?outfit=dev|suit|tactical|cyber era accessories
 *   ?bg=neutral|light|dark|<hex>    background (dark = AI-era night sky)
 *   ?site=1                         site framing: the site's 340x260 camera
 *                                   and Lumi placement, cropped to her exact
 *                                   on-site pixels and CSS-upscaled ?zoom=N
 *                                   times (default 4), pixelated. ?dir=-1
 *                                   mirrors the walk direction, ?dpr=2 hi-dpi
 *   ?ref=1                          show the reference photo alongside
 *   ?anim=1                         run the live animation loop
 *   ?size=N                         canvas size for close-ups (default 720)
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CHARACTER_TONE, addCharacterLights } from './lighting.ts';
import { animateLumi, applyLumiOutfit, createLumiModel, type LumiOutfit } from './lumi.ts';

const FACING = Math.PI * 0.27; // same as Character.tsx

const BGS: Record<string, number> = {
  neutral: 0xd4d7da,
  light: 0xf3ead9, // hero / early-stage sky
  mid: 0x9fc3e0,
  dark: 0x0d1226, // AI-era night
};

export function mountLumiPreview(container: HTMLElement, params: URLSearchParams): void {
  const view = params.get('view') ?? 'three-quarter';
  const pose = params.get('pose') ?? 'idle';
  const site = params.get('site') === '1';
  const anim = params.get('anim') === '1';
  const bgKey = params.get('bg') ?? 'neutral';
  const bg = BGS[bgKey] ?? parseInt(bgKey.replace('#', ''), 16);
  document.body.style.background = `#${bg.toString(16).padStart(6, '0')}`;

  const W = site ? 340 : Number(params.get('size') ?? 720);
  const H = site ? 260 : W;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: site });
  renderer.setSize(W, H);
  renderer.setPixelRatio(site ? Number(params.get('dpr') ?? 1) : 1);
  // The site's renderer settings (shared with Character.tsx).
  renderer.toneMapping = CHARACTER_TONE.toneMapping;
  renderer.toneMappingExposure = CHARACTER_TONE.exposure;
  container.appendChild(renderer.domElement);
  if (site) {
    container.style.justifyContent = 'flex-start';
    container.style.padding = '0';
    renderer.domElement.style.imageRendering = 'pixelated';
  }

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = CHARACTER_TONE.envIntensity;
  pmrem.dispose();
  scene.background = new THREE.Color(bg);

  // The site's light rig (lighting.ts, shared with Character.tsx).
  addCharacterLights(scene);

  const cat = createLumiModel();
  const outfit = params.get('outfit');
  if (outfit) applyLumiOutfit(cat, outfit as LumiOutfit);
  scene.add(cat);

  const state = {
    amp: pose === 'trot' ? 1 : 0,
    waveAmp: pose === 'sit-wave' ? 1 : 0,
    phase: Number(params.get('phase') ?? 0.9),
    t: Number(params.get('t') ?? 1.3),
  };

  let camera: THREE.PerspectiveCamera;
  if (site) {
    camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 10);
    camera.position.set(0, 0.6, 2.9);
    camera.lookAt(0, 0.47, 0);
    cat.position.set(-0.46, 0, 0.12);
    cat.rotation.y = params.get('dir') === '-1' ? Math.PI - FACING : FACING;
    if (state.waveAmp) cat.rotation.y = 0.12;
    // Crop to exactly Lumi's pixels (same projection, same pixel size).
    camera.updateMatrixWorld();
    const c = new THREE.Vector3(cat.position.x, 0.15, cat.position.z).project(camera);
    const cw = 120;
    const ch = 100;
    const cx = Math.round(((c.x + 1) / 2) * W - cw / 2);
    const cy = Math.round(((1 - c.y) / 2) * H - ch / 2);
    camera.setViewOffset(W, H, cx, cy, cw, ch);
    renderer.setSize(cw, ch);
    const zoom = Number(params.get('zoom') ?? 4);
    renderer.domElement.style.width = `${cw * zoom}px`;
    renderer.domElement.style.height = `${ch * zoom}px`;
  } else {
    camera = new THREE.PerspectiveCamera(30, 1, 0.02, 20);
    // [azimuth from +Z toward +X, elevation, distance, targetY, targetZ]
    const presets: Record<string, [number, number, number, number, number?]> = {
      front: [0, 0.12, 1.15, 0.15],
      'three-quarter': [0.75, 0.22, 1.2, 0.15],
      // Same relative angle as the site camera (model turned by FACING).
      'site-angle': [-FACING, 0.13, 1.2, 0.15],
      side: [-Math.PI / 2, 0.08, 1.2, 0.14],
      left: [Math.PI / 2, 0.08, 1.2, 0.14],
      back: [Math.PI, 0.3, 1.2, 0.15],
      top: [0.4, 1.2, 1.2, 0.12],
      face: [0, 0.08, 0.55, 0.19, 0.16],
      face34: [-0.6, 0.1, 0.55, 0.19, 0.14],
    };
    const [az, el, dist, ty, tz = 0] = presets[view] ?? presets['three-quarter'];
    camera.position.set(
      Math.sin(az) * Math.cos(el) * dist,
      ty + Math.sin(el) * dist,
      tz + Math.cos(az) * Math.cos(el) * dist,
    );
    camera.lookAt(0, ty, tz);
  }

  if (params.get('ref') === '1') {
    const img = document.createElement('img');
    img.src = '/assets-src/lumi-ref-small.jpg';
    img.className = 'ref';
    container.appendChild(img);
  }

  const info = document.getElementById('info');
  const timer = new THREE.Timer();
  const frame = () => {
    if (anim) {
      timer.update();
      const dt = Math.min(timer.getDelta(), 0.05);
      state.t = timer.getElapsed();
      if (state.amp > 0) state.phase += dt * 9;
    }
    animateLumi(cat, state);
    renderer.render(scene, camera);
    let meshes = 0;
    cat.traverse((o) => {
      if ((o as THREE.Mesh).isMesh || (o as THREE.LineSegments).isLineSegments) meshes++;
    });
    const r = renderer.info.render;
    const summary = { meshes, calls: r.calls, triangles: r.triangles, lines: r.lines };
    (window as unknown as { __lumiInfo: unknown }).__lumiInfo = summary;
    if (info) info.textContent = JSON.stringify(summary);
  };
  if (anim) renderer.setAnimationLoop(frame);
  else frame();
  (window as unknown as { __previewReady: boolean }).__previewReady = true;
}
