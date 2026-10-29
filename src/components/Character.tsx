import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import gsap from 'gsap';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createLeviChibiModel, disposeLeviChibiModel } from '../character/createLeviChibiModel';
import { CHARACTER_TONE, addCharacterLights } from '../character/lighting';
import { animateLumi, applyLumiOutfit, createLumiModel, disposeLumiModel } from '../character/lumi';
import { applyOutfit, type Outfit } from '../character/outfits';

// The character contract used by JourneyStage. The 3D chibi (img2threejs
// pipeline output) implements it; a CSS chibi remains as the no-WebGL fallback.
export type CharacterHandle = {
  setWalking: (walking: boolean, direction: 1 | -1) => void;
  setWaving: (waving: boolean) => void;
  setOutfit: (outfit: Outfit) => void;
  celebrate: () => void;
};

// The canvas is wider than the character's own 210px box so Lumi has room to
// trot alongside him. Extra width is symmetric and the camera FOV is vertical,
// so the character's on-screen size and position are unchanged.
const CANVAS_W = 340;
const CANVAS_H = 260;
// Angled toward the walk direction but turned enough that the face stays lit
// and readable at ~170px tall.
const FACING = Math.PI * 0.27;

type Rig = {
  model: THREE.Group;
  hipL: THREE.Object3D | null;
  hipR: THREE.Object3D | null;
  shoulderL: THREE.Object3D | null;
  shoulderR: THREE.Object3D | null;
  // Lumi's named nodes live in her runtime; animateLumi drives them.
  lumi: THREE.Group;
};

const Character = forwardRef<CharacterHandle>(function Character(_, ref) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const rigRef = useRef<Rig | null>(null);
  const stateRef = useRef({
    walking: false,
    dir: 1 as 1 | -1,
    amp: 0,
    phase: 0,
    waving: false,
    waveAmp: 0,
  });
  const outfitRef = useRef<Outfit>('dev');
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      setWebglFailed(true);
      return;
    }
    renderer.setSize(CANVAS_W, CANVAS_H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = CHARACTER_TONE.toneMapping;
    renderer.toneMappingExposure = CHARACTER_TONE.exposure;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // Metals need something to reflect: a generated room gives the cyborg's
    // alloy plating real specular response instead of rendering near-black.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = CHARACTER_TONE.envIntensity;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(30, CANVAS_W / CANVAS_H, 0.1, 10);
    camera.position.set(0, 0.6, 2.9);
    camera.lookAt(0, 0.47, 0);

    // Key / fill / rim rig shared with the review harness (lighting.ts).
    addCharacterLights(scene);

    const model = createLeviChibiModel();
    model.rotation.y = FACING;
    applyOutfit(model, outfitRef.current);
    scene.add(model);

    // Lumi trots behind him (screen-left, since he walks right).
    const lumi = createLumiModel();
    lumi.position.set(-0.46, 0, 0.12);
    lumi.rotation.y = FACING;
    applyLumiOutfit(lumi, outfitRef.current);
    scene.add(lumi);

    rigRef.current = {
      model,
      hipL: model.getObjectByName('pivot-hip-l') ?? null,
      hipR: model.getObjectByName('pivot-hip-r') ?? null,
      shoulderL: model.getObjectByName('pivot-shoulder-l') ?? null,
      shoulderR: model.getObjectByName('pivot-shoulder-r') ?? null,
      lumi,
    };

    // Timer (not the deprecated Clock); connect() pauses it while the tab is
    // hidden so he doesn't take one giant step on return.
    const timer = new THREE.Timer();
    timer.connect(document);
    let raf = 0;
    const tick = (time?: number) => {
      timer.update(time);
      const dt = Math.min(timer.getDelta(), 0.05);
      const t = timer.getElapsed();
      const s = stateRef.current;
      const rig = rigRef.current!;

      // Ease the stride and the wave in/out instead of snapping.
      s.amp += ((s.walking ? 1 : 0) - s.amp) * Math.min(1, dt * 8);
      s.waveAmp += ((s.waving ? 1 : 0) - s.waveAmp) * Math.min(1, dt * 6);
      if (s.walking) s.phase += dt * 9;
      const swing = Math.sin(s.phase) * s.amp;
      if (rig.hipL && rig.hipR) {
        rig.hipL.rotation.x = swing * 0.55;
        rig.hipR.rotation.x = -swing * 0.55;
      }
      if (rig.shoulderL && rig.shoulderR) {
        rig.shoulderL.rotation.x = -swing * 0.45;
        rig.shoulderR.rotation.x = swing * 0.45;
        // Raised waving arm blends over whatever the walk pose says.
        rig.shoulderR.rotation.z =
          (-1.95 + Math.sin(t * 6.5) * 0.4) * s.waveAmp;
      }

      // Step bounce while walking, gentle breath while idle.
      rig.model.position.y =
        s.amp * Math.abs(Math.cos(s.phase)) * 0.028 +
        (1 - s.amp) * Math.sin(t * 2) * 0.007;

      // Cyborg circuitry breathes: slow pulse plus a faint faster flicker.
      const pulseMats = rig.model.userData.__pulseMats as
        | (THREE.MeshStandardMaterial & { userData: { baseEmissive?: number } })[]
        | undefined;
      if (pulseMats?.length) {
        const k = 0.78 + Math.sin(t * 2.1) * 0.22 + Math.sin(t * 7.3) * 0.04;
        for (const m of pulseMats) {
          m.emissiveIntensity = (m.userData.baseEmissive ?? 1) * k;
        }
      }

      // Face nearly front while waving hello, walk direction otherwise.
      const walkTarget = s.dir === 1 ? FACING : Math.PI - FACING;
      const targetY = walkTarget * (1 - s.waveAmp) + 0.12 * s.waveAmp;
      rig.model.rotation.y += (targetY - rig.model.rotation.y) * Math.min(1, dt * 9);

      /* ---- Lumi: trot, tail, look-around, ear flicks, blinks, wave ---- */
      // Shared with the review harness (preview-lumi.html) so both agree.
      animateLumi(rig.lumi, { amp: s.amp, waveAmp: s.waveAmp, phase: s.phase, t });
      rig.lumi.rotation.y += (targetY - rig.lumi.rotation.y) * Math.min(1, dt * 7);
      // Trail on the far side when he turns around, so she stays behind him.
      const lumiX = s.dir === 1 ? -0.46 : 0.46;
      rig.lumi.position.x += (lumiX - rig.lumi.position.x) * Math.min(1, dt * 3);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      timer.dispose();
      disposeLumiModel(lumi);
      disposeLeviChibiModel(model);
      envRT.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  useImperativeHandle(ref, () => ({
    setWalking(walking, direction) {
      const s = stateRef.current;
      s.walking = walking;
      s.dir = direction;
      // Also drive the CSS fallback if it is what's rendered.
      const el = rootRef.current;
      if (el) {
        el.classList.toggle('walking', walking);
        el.style.setProperty('--facing', String(direction));
      }
    },
    setWaving(waving) {
      stateRef.current.waving = waving;
    },
    setOutfit(outfit) {
      if (outfitRef.current === outfit) return;
      outfitRef.current = outfit;
      const rig = rigRef.current;
      if (!rig) return; // applied on mount instead
      // Squash-pop costume change: shrink, swap at the low point, spring back.
      const swap = () => {
        applyOutfit(rig.model, outfitRef.current);
        applyLumiOutfit(rig.lumi, outfitRef.current);
      };
      gsap
        .timeline()
        .to([rig.model.scale, rig.lumi.scale], {
          x: 1.18,
          y: 0.62,
          z: 1.18,
          duration: 0.14,
          ease: 'power2.in',
          onComplete: swap,
        })
        .to([rig.model.scale, rig.lumi.scale], {
          x: 1,
          y: 1,
          z: 1,
          duration: 0.5,
          ease: 'elastic.out(1.1, 0.45)',
        });
    },
    celebrate() {
      const el = rootRef.current;
      if (el) {
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
      }
      // Lumi hops along with him.
      const lumi = rigRef.current?.lumi;
      if (lumi) {
        gsap.fromTo(
          lumi.position,
          { y: 0 },
          {
            y: 0.16,
            duration: 0.26,
            ease: 'power2.out',
            yoyo: true,
            repeat: 3,
            onComplete: () => {
              lumi.position.y = 0;
            },
          },
        );
      }
      const arm = rigRef.current?.shoulderR;
      if (arm) {
        gsap.fromTo(
          arm.rotation,
          { z: 0 },
          {
            z: -2.2,
            duration: 0.35,
            ease: 'power2.out',
            yoyo: true,
            repeat: 3,
            onComplete: () => {
              arm.rotation.z = 0;
            },
          },
        );
      }
    },
  }));

  return (
    <div className="character" ref={rootRef} aria-hidden="true">
      {webglFailed ? (
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
        </div>
      ) : (
        <div className="chibi-3d" ref={mountRef} />
      )}
      <div className="chibi-shadow" />
    </div>
  );
});

export default Character;
