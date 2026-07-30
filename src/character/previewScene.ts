/**
 * Standalone review harness for the img2threejs pipeline (preview-chibi.html).
 * Renders createLeviChibiModel on a neutral background with the spec's lighting.
 *
 * URL params:
 *   ?view=front|three-quarter|side|back   camera preset (default front)
 *   ?stage=blockout|full                  factory stage (default full)
 *   ?clay=1                               neutral clay material
 *   ?ortho=1                              orthographic diagnostic frame
 *                                         (x in [-0.55,0.55], y in [-0.05,1.05])
 *   ?shadow=1                             ground contact shadow (off for
 *                                         silhouette diagnostics)
 *   ?pose=walk|wave                       rotates the named pivots to verify the
 *                                         animation contract (interaction pass)
 *   ?outfit=dev|suit|tactical|cyber       apply an era outfit (site costumes)
 */
import * as THREE from 'three';
import { createLeviChibiModel, type LeviChibiStage } from './createLeviChibiModel.ts';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { applyOutfit, type Outfit } from './outfits.ts';
import { applyLumiOutfit, createLumiModel, type LumiOutfit } from './lumi.ts';

const BACKGROUND = 0xd4d7da; // light neutral: distinct from skin, shirt, and blacks

export function mountPreview(container: HTMLElement, params: URLSearchParams): void {
  const view = params.get('view') ?? 'front';
  const stage = (params.get('stage') ?? 'full') as LeviChibiStage;
  const clay = params.get('clay') === '1';
  const ortho = params.get('ortho') === '1';
  const shadow = params.get('shadow') === '1';
  const pose = params.get('pose');

  const size = Math.min(900, Math.min(window.innerWidth, window.innerHeight));
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(size, size);
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = shadow;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // Match the site's environment so metals read the same here as in the app.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();
  scene.background = new THREE.Color(BACKGROUND);

  const flat = params.get('flat') === '1';
  if (flat) {
    // De-lit diagnostic mode: uniform ambient only, linear tone mapping.
    // Materials render at (approximately) their albedo so the Tier-1 per-part
    // color delta measures albedo agreement, not baked lighting — the same
    // de-lighting doctrine the pipeline applies to reference photos.
    renderer.toneMapping = THREE.NoToneMapping;
    scene.add(new THREE.AmbientLight(0xffffff, 3.1));
  } else {
    // Lighting per spec lightingFromPhoto: warm key upper front character-left,
    // cool hemisphere fill with faint foliage tint, cool rim from upper rear.
    const key = new THREE.DirectionalLight(0xfff2e0, 2.6);
    key.position.set(0.6, 1.0, 0.8).multiplyScalar(3);
    if (shadow) {
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.left = -1;
      key.shadow.camera.right = 1;
      key.shadow.camera.top = 2;
      key.shadow.camera.bottom = -0.5;
      key.shadow.bias = -0.0005;
    }
    scene.add(key);
    const fill = new THREE.HemisphereLight(0xdfe8de, 0x6b6f75, 1.25);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xdce8ff, 1.4);
    rim.position.set(-0.4, 0.8, -1.0).multiplyScalar(3);
    scene.add(rim);
  }

  // ?lumi=1 reviews the cat companion alone, scaled up to fill the frame.
  if (params.get('lumi') === '1') {
    const cat = createLumiModel();
    const lumiFit = params.get('outfit');
    if (lumiFit) applyLumiOutfit(cat, lumiFit as LumiOutfit);
    if (params.get('pose') === 'wave') {
      // Same numbers the site's render loop uses at full wave amplitude.
      const core = cat.getObjectByName('lumi-core');
      if (core) core.rotation.x = -0.1;
      const set = (n: string, x: number) => {
        const o = cat.getObjectByName(n);
        if (o) o.rotation.x = x;
      };
      set('lumi-leg-fl', -2.1);
      const fl = cat.getObjectByName('lumi-leg-fl');
      if (fl) fl.rotation.z = 0.45;
      set('lumi-leg-fr', 0.1);
      set('lumi-leg-bl', 0);
      set('lumi-leg-br', 0);
      set('lumi-head', 0.22);
    }
    cat.scale.setScalar(2.6);
    scene.add(cat);
    (window as unknown as { __previewReady: boolean }).__previewReady = true;
    const camL = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const v = params.get('view') ?? 'front';
    if (v === 'front') camL.position.set(0, 0.75, 2.6);
    else if (v === 'three-quarter') camL.position.set(1.5, 0.85, 2.0);
    else if (v === 'side') camL.position.set(2.6, 0.7, 0);
    else camL.position.set(0, 0.8, -2.6);
    camL.lookAt(0, 0.42, 0);
    renderer.setAnimationLoop(() => renderer.render(scene, camL));
    return;
  }

  const model = createLeviChibiModel({ stage, clay, castShadow: shadow });
  const outfit = params.get('outfit');
  if (outfit && !clay) applyOutfit(model, outfit as Outfit);
  scene.add(model);

  if (shadow) {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(0.7, 48),
      new THREE.ShadowMaterial({ opacity: 0.22 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);
  }

  if (pose) {
    const runtime = model.userData.sculptRuntime as {
      nodes: Record<string, THREE.Object3D>;
    };
    const n = runtime.nodes;
    if (pose === 'walk') {
      n['pivot-shoulder-l'].rotation.x = 0.6;
      n['pivot-shoulder-r'].rotation.x = -0.6;
      n['pivot-hip-l'].rotation.x = -0.55;
      n['pivot-hip-r'].rotation.x = 0.55;
      n['pivot-neck'].rotation.x = 0.08;
    } else if (pose === 'wave') {
      n['pivot-shoulder-l'].rotation.z = -2.4;
      n['pivot-shoulder-r'].rotation.x = 0.25;
      n['pivot-neck'].rotation.z = 0.15;
      n['pivot-hip-l'].rotation.x = -0.15;
      n['pivot-hip-r'].rotation.x = 0.15;
    }
  }

  let camera: THREE.Camera;
  const target = new THREE.Vector3(0, 0.5, 0);
  if (ortho) {
    // Diagnostic frame is exact and matches the spec-derived silhouette card:
    // full body [-0.55,0.55]x[-0.05,1.05]; bust (material look-dev close-up)
    // [-0.35,0.35]x[0.35,1.05].
    const frame = params.get('frame');
    const cam =
      frame === 'bust'
        ? new THREE.OrthographicCamera(-0.35, 0.35, 1.05, 0.35, 0.01, 10)
        : frame === 'face'
          ? new THREE.OrthographicCamera(-0.25, 0.25, 1.05, 0.55, 0.01, 10)
          : frame === 'collar'
            ? new THREE.OrthographicCamera(-0.13, 0.13, 0.74, 0.48, 0.01, 10)
            : new THREE.OrthographicCamera(-0.55, 0.55, 1.05, -0.05, 0.01, 10);
    if (view === 'side') {
      cam.position.set(3, 0, 0);
    } else {
      cam.position.set(0, 0, 3);
    }
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    camera = cam;
  } else {
    const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
    if (view === 'front') cam.position.set(0, 0.52, 2.4);
    else if (view === 'three-quarter') cam.position.set(1.35, 0.78, 1.95);
    else if (view === 'side') cam.position.set(2.4, 0.52, 0);
    else if (view === 'back') cam.position.set(0, 0.6, -2.4);
    cam.lookAt(target);
    camera = cam;
  }

  renderer.render(scene, camera);
  // Flag for the screenshot harness.
  (window as unknown as { __previewReady: boolean }).__previewReady = true;
}
