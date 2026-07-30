/**
 * Era outfits for the chibi. Applied on top of createLeviChibiModel by mesh
 * name: body parts are re-materialed, tuxedo-specific parts toggled, and
 * procedural accessories attached to the correct rig nodes (so headphones
 * follow the head, boot glows follow the legs).
 *
 *   dev      — hoodie + headphones + jeans + sneakers   (Foundations)
 *   suit     — navy banker suit + red tie               (JPMorgan)
 *   tactical — olive field shirt + vest + boots         (Raft)
 *   cyber    — half-humanoid cyborg augmentation        (AI era)
 *
 * The cyborg build augments the character's LEFT side (+X) because the model
 * is rotated toward the camera about +Y, which turns that side into view.
 */
import * as THREE from 'three';
import type { LeviChibiRuntime } from './createLeviChibiModel';

export type Outfit = 'dev' | 'suit' | 'tactical' | 'cyber';

type PulseMaterial = THREE.MeshStandardMaterial & {
  userData: { baseEmissive?: number };
};

type OutfitResources = {
  mats: THREE.Material[];
  geos: THREE.BufferGeometry[];
  extras: THREE.Object3D[];
  /** Emissive materials the render loop breathes in and out. */
  pulse: PulseMaterial[];
};

const TUX_PARTS = ['lapel-l', 'lapel-r', 'shirt-triangle', 'bow-tie', 'button-l', 'button-r'];

export function applyOutfit(model: THREE.Group, outfit: Outfit): void {
  const runtime = model.userData.sculptRuntime as LeviChibiRuntime | undefined;
  if (!runtime) return;
  const { meshes, nodes } = runtime;

  // Tear down whatever the previous outfit added.
  const prev = model.userData.__outfitResources as OutfitResources | undefined;
  if (prev) {
    prev.extras.forEach((o) => o.parent?.remove(o));
    prev.geos.forEach((g) => g.dispose());
    prev.mats.forEach((m) => m.dispose());
  }
  const res: OutfitResources = { mats: [], geos: [], extras: [], pulse: [] };
  model.userData.__outfitResources = res;
  model.userData.__pulseMats = res.pulse;
  model.userData.outfit = outfit;

  const std = (
    color: number,
    roughness: number,
    extra: Partial<THREE.MeshStandardMaterialParameters> = {},
  ) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
    res.mats.push(m);
    return m;
  };
  const glow = (color: number, intensity = 1.5) =>
    std(color, 0.4, { emissive: color, emissiveIntensity: intensity });
  /** Emissive material that slowly breathes (driven by the render loop). */
  const livingGlow = (color: number, intensity = 1.5) => {
    const m = glow(color, intensity) as PulseMaterial;
    m.userData.baseEmissive = intensity;
    res.pulse.push(m);
    return m;
  };
  /** Curved plate hugging an ellipsoid body part (open shell, so double-sided).
   *  phi: 0=+X side... π/2 = front (+Z), π = character-left (+X). */
  const shell = (
    phiStart: number,
    phiLength: number,
    thetaStart: number,
    thetaLength: number,
  ) => {
    const g = new THREE.SphereGeometry(0.5, 40, 24, phiStart, phiLength, thetaStart, thetaLength);
    return g;
  };
  /** Open half-cylinder shell for plating a limb that runs along Y. */
  const limbShell = (radius: number, height: number, thetaStart: number, thetaLength: number) =>
    new THREE.CylinderGeometry(radius, radius, height, 20, 1, true, thetaStart, thetaLength);

  const setMat = (id: string, mat: THREE.Material) => {
    const mesh = meshes[id];
    if (mesh) mesh.material = mat;
  };
  const setVisible = (id: string, visible: boolean) => {
    const obj = nodes[id] ?? meshes[id];
    if (obj) obj.visible = visible;
  };
  const addExtra = (
    parent: THREE.Object3D | undefined,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    pos: [number, number, number],
    opts: { rot?: [number, number, number]; scale?: [number, number, number] } = {},
  ) => {
    if (!parent) return;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    if (opts.rot) mesh.rotation.set(...opts.rot);
    if (opts.scale) mesh.scale.set(...opts.scale);
    mesh.castShadow = true;
    parent.add(mesh);
    res.geos.push(geo);
    res.extras.push(mesh);
  };

  const torso = nodes['torso'];
  const head = nodes['head-group'];
  const W = (y: number) => y - 0.645; // world-y -> neck-local-y (see factory)

  const showTux = (on: boolean) => TUX_PARTS.forEach((id) => setVisible(id, on));

  // The tactical helmet replaces the quiff (it would clip through the shell);
  // every other outfit keeps the signature hair.
  setVisible('hair-quiff', outfit !== 'tactical');
  // Cybernetics take over the character-left eye and ear in the AI era.
  const cyborg = outfit === 'cyber';
  setVisible('eye-l', !cyborg);
  setVisible('catchlight-l', !cyborg);
  setVisible('ear-l', !cyborg);
  setVisible('brow-l', !cyborg);

  if (outfit === 'dev') {
    showTux(false);
    const hoodie = std(0x4b5566, 0.92);
    const hoodieDark = std(0x40495a, 0.92);
    const jeans = std(0x3f5f8a, 0.85);
    const sneaker = std(0xf0efe9, 0.55);
    setMat('torso-jacket', hoodie);
    setMat('arm-l', hoodie);
    setMat('arm-r', hoodie);
    setMat('pelvis', jeans);
    setMat('leg-l', jeans);
    setMat('leg-r', jeans);
    setMat('shoe-l', sneaker);
    setMat('shoe-r', sneaker);
    // Bunched hood behind the neck.
    addExtra(torso, new THREE.SphereGeometry(0.5, 20, 14), hoodieDark, [0, 0.605, -0.105], {
      scale: [0.3, 0.17, 0.19],
    });
    // Kangaroo pocket + drawstrings.
    addExtra(torso, new THREE.BoxGeometry(0.14, 0.06, 0.02), hoodieDark, [0, 0.4, 0.096], {
      rot: [-0.5, 0, 0],
    });
    const stringMat = std(0xe8e8e8, 0.7);
    for (const sx of [1, -1]) {
      addExtra(torso, new THREE.CylinderGeometry(0.005, 0.005, 0.06, 8), stringMat, [sx * 0.032, 0.545, 0.104], {
        rot: [-0.3, 0, sx * 0.12],
      });
    }
    // Headphones: band over the hair + cups on the ears (follow the head).
    const cans = std(0x23252d, 0.5);
    const cansSoft = std(0x30333e, 0.8);
    addExtra(head, new THREE.TorusGeometry(0.195, 0.016, 10, 32, Math.PI), cans, [0, W(0.8), 0.0]);
    for (const sx of [1, -1]) {
      addExtra(head, new THREE.CylinderGeometry(0.052, 0.052, 0.03, 20), cans, [sx * 0.19, W(0.78), 0.005], {
        rot: [0, 0, Math.PI / 2],
      });
      addExtra(head, new THREE.CylinderGeometry(0.038, 0.038, 0.012, 20), cansSoft, [sx * 0.208, W(0.78), 0.005], {
        rot: [0, 0, Math.PI / 2],
      });
    }
  }

  if (outfit === 'suit') {
    showTux(true);
    setVisible('bow-tie', false); // long tie instead
    const navy = std(0x22304f, 0.8);
    const navyLapel = std(0x2a3a5f, 0.45);
    const navyTrouser = std(0x1d2941, 0.82);
    const shirt = std(0xffffff, 0.65);
    const tie = std(0xa32636, 0.55);
    const brogue = std(0x2f2118, 0.4);
    setMat('torso-jacket', navy);
    setMat('arm-l', navy);
    setMat('arm-r', navy);
    setMat('lapel-l', navyLapel);
    setMat('lapel-r', navyLapel);
    setMat('shirt-triangle', shirt);
    setMat('pelvis', navyTrouser);
    setMat('leg-l', navyTrouser);
    setMat('leg-r', navyTrouser);
    setMat('shoe-l', brogue);
    setMat('shoe-r', brogue);
    // Power tie: knot + blade down the shirt line.
    addExtra(torso, new THREE.BoxGeometry(0.034, 0.026, 0.016), tie, [0, 0.6, 0.084], {
      rot: [-0.2, 0, 0],
    });
    addExtra(torso, new THREE.BoxGeometry(0.046, 0.12, 0.012), tie, [0, 0.527, 0.102], {
      rot: [-0.33, 0, 0],
    });
    addExtra(torso, new THREE.BoxGeometry(0.0325, 0.0325, 0.012), tie, [0, 0.462, 0.118], {
      rot: [-0.38, 0, Math.PI / 4],
    });
  }

  if (outfit === 'tactical') {
    showTux(false);
    const field = std(0x5c6247, 0.92);
    const cargo = std(0x4d4f3d, 0.9);
    const boot = std(0x1c1c1e, 0.6);
    const vest = std(0x394030, 0.95);
    const pouch = std(0x2f3527, 0.95);
    const belt = std(0x26291f, 0.85);
    setMat('torso-jacket', field);
    setMat('arm-l', field);
    setMat('arm-r', field);
    setMat('pelvis', cargo);
    setMat('leg-l', cargo);
    setMat('leg-r', cargo);
    setMat('shoe-l', boot);
    setMat('shoe-r', boot);
    // Plate carrier vest + pouches + belt.
    addExtra(torso, new THREE.BoxGeometry(0.2, 0.185, 0.04), vest, [0, 0.505, 0.093], {
      rot: [-0.18, 0, 0],
    });
    addExtra(torso, new THREE.BoxGeometry(0.2, 0.15, 0.035), vest, [0, 0.51, -0.09], {
      rot: [0.15, 0, 0],
    });
    for (const sx of [1, -1]) {
      addExtra(torso, new THREE.BoxGeometry(0.052, 0.05, 0.032), pouch, [sx * 0.058, 0.42, 0.108], {
        rot: [-0.3, 0, 0],
      });
      // Shoulder straps joining front and back plates.
      addExtra(torso, new THREE.BoxGeometry(0.045, 0.02, 0.16), vest, [sx * 0.075, 0.6, 0.0]);
    }
    const beltGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.032, 24);
    addExtra(torso, beltGeo, belt, [0, 0.378, 0], { scale: [1, 1, 0.72] });
    addExtra(torso, new THREE.BoxGeometry(0.04, 0.026, 0.014), std(0x8a8f77, 0.5), [0, 0.378, 0.104]);
    // Tactical helmet: shell over the crown, NVG mount, chin straps.
    const helmet = std(0x4a5138, 0.85);
    const helmetDark = std(0x33382a, 0.8);
    addExtra(head, new THREE.SphereGeometry(0.5, 28, 20), helmet, [0, W(0.883), -0.008], {
      scale: [0.41, 0.3, 0.4],
    });
    addExtra(head, new THREE.BoxGeometry(0.046, 0.038, 0.03), helmetDark, [0, W(0.9), 0.182], {
      rot: [-0.25, 0, 0],
    });
    for (const sx of [1, -1]) {
      addExtra(head, new THREE.BoxGeometry(0.012, 0.095, 0.014), helmetDark, [sx * 0.162, W(0.76), 0.045], {
        rot: [0.1, 0, sx * 0.22],
      });
    }
  }

  if (outfit === 'cyber') {
    showTux(false);
    /* ---- palette: matte techwear on the human half, brushed alloy on the
       machine half, cyan primary / magenta secondary for the live circuitry. */
    const jacket = std(0x14161f, 0.5, { metalness: 0.25 });
    const trouser = std(0x11131b, 0.6);
    const shoe = std(0x0e0e15, 0.35);
    const alloy = std(0xccd6e6, 0.28, { metalness: 0.85 });
    const alloyDark = std(0x6b7590, 0.38, { metalness: 0.8 });
    const jointBlack = std(0x222634, 0.45, { metalness: 0.7 });
    const plate = std(0xd6dfec, 0.24, { metalness: 0.85, side: THREE.DoubleSide });
    // Saturated at moderate intensity: ACES tone mapping washes hot emissives
    // out to white, which kills the cyan/magenta read.
    const cyan = glow(0x2fd8f5, 1.15);
    const cyanLive = livingGlow(0x2fd8f5, 1.3);
    const coreLive = livingGlow(0x35e0ff, 1.5);
    const magenta = glow(0xe23fc4, 1.1);
    const magentaLive = livingGlow(0xe23fc4, 1.3);

    setMat('torso-jacket', jacket);
    setMat('arm-r', jacket); // human arm stays sleeved
    setMat('arm-l', alloy); // exposed prosthetic
    setMat('hand-l', alloy);
    setMat('pelvis', trouser);
    setMat('leg-r', trouser);
    setMat('leg-l', jointBlack); // actuator housing under the plating
    setMat('shoe-l', alloyDark);
    setMat('shoe-r', shoe);

    /* ---------------- head: augmented left hemisphere ---------------- */
    // Cheek-to-temple faceplate, curved to the skull (front→character-left).
    addExtra(head, shell(1.63, 1.36, 0.78, 1.28), plate, [0, W(0.8), 0.005], {
      scale: [0.364, 0.344, 0.334],
    });
    // Seam lighting along the join where plating meets skin (kept short so it
    // reads as a lit edge, not a tear streak down the cheek).
    addExtra(head, new THREE.BoxGeometry(0.0045, 0.085, 0.0045), cyanLive, [0.033, W(0.815), 0.157], {
      rot: [0, 0, 0.06],
    });
    // Optic replacing the left eye: housing ring, lens, hot pupil. Sized just
    // under the organic eye so it reads as precision hardware, not a googly.
    addExtra(head, new THREE.TorusGeometry(0.034, 0.008, 10, 26), alloyDark, [0.066, W(0.775), 0.15]);
    addExtra(head, new THREE.SphereGeometry(0.5, 20, 14), livingGlow(0x35e0ff, 1.5), [0.066, W(0.775), 0.15], {
      scale: [0.05, 0.05, 0.026],
    });
    addExtra(head, new THREE.SphereGeometry(0.0085, 12, 10), magenta, [0.066, W(0.775), 0.164]);
    // Brow guard above the optic (replaces the organic brow on that side).
    addExtra(head, new THREE.BoxGeometry(0.072, 0.014, 0.016), alloyDark, [0.067, W(0.827), 0.155], {
      rot: [0, 0, 0.12],
    });
    // Audio/sensor module where the left ear was, with three status LEDs.
    addExtra(head, new THREE.BoxGeometry(0.03, 0.072, 0.05), alloyDark, [0.182, W(0.78), 0.005]);
    for (let i = 0; i < 3; i += 1) {
      addExtra(head, new THREE.SphereGeometry(0.006, 8, 6), i === 1 ? magenta : cyan, [
        0.198,
        W(0.8) - i * 0.019,
        0.005,
      ]);
    }
    // Swept sensor antenna off the temple.
    addExtra(head, new THREE.CylinderGeometry(0.005, 0.003, 0.125, 8), alloyDark, [0.145, W(0.935), -0.045], {
      rot: [0.35, 0, -0.3],
    });
    addExtra(head, new THREE.SphereGeometry(0.0105, 10, 8), magentaLive, [0.165, W(0.988), -0.065]);
    // Skull plating segments tracking back over the hairline.
    for (let i = 0; i < 3; i += 1) {
      addExtra(head, new THREE.BoxGeometry(0.052, 0.012, 0.03), alloy, [
        0.115 - i * 0.012,
        W(0.895) - i * 0.006,
        -0.03 - i * 0.038,
      ], { rot: [0.25 + i * 0.12, 0, -0.25] });
    }

    /* ---------------- neck + torso: reactor core and plating ---------------- */
    addExtra(torso, new THREE.TorusGeometry(0.064, 0.009, 8, 28), cyan, [0, 0.618, 0.012], {
      rot: [Math.PI / 2, 0, 0],
    });
    // Cable running from the collar down to the prosthetic shoulder — laid
    // along the trapezius so it never pokes above the shoulder line.
    addExtra(torso, new THREE.CylinderGeometry(0.0075, 0.0075, 0.088, 10), alloyDark, [0.076, 0.583, -0.035], {
      rot: [0.2, 0, -1.12],
    });
    // Upper-left chest plate, curved to the torso ellipsoid.
    addExtra(torso, shell(1.66, 1.28, 0.72, 1.02), plate, [0, 0.455, 0], {
      scale: [0.324, 0.382, 0.234],
    });
    // Heat-vent slats cut into the chest plate.
    for (let i = 0; i < 3; i += 1) {
      addExtra(torso, new THREE.BoxGeometry(0.052, 0.007, 0.012), jointBlack, [
        0.082,
        0.556 - i * 0.019,
        0.079,
      ], { rot: [-0.25, -0.5, 0.1] });
    }
    // Sternum reactor: housing ring, breathing lens, hot centre, four bolts.
    addExtra(torso, new THREE.TorusGeometry(0.041, 0.01, 10, 30), alloy, [0, 0.5, 0.1], {
      rot: [-0.1, 0, 0],
    });
    addExtra(torso, new THREE.SphereGeometry(0.5, 22, 16), coreLive, [0, 0.5, 0.099], {
      scale: [0.068, 0.068, 0.032],
    });
    addExtra(torso, new THREE.SphereGeometry(0.015, 12, 10), magentaLive, [0, 0.5, 0.111]);
    for (const a of [0.79, 2.36, 3.93, 5.5]) {
      addExtra(torso, new THREE.CylinderGeometry(0.005, 0.005, 0.008, 8), alloyDark, [
        Math.cos(a) * 0.056,
        0.5 + Math.sin(a) * 0.056,
        0.096,
      ], { rot: [Math.PI / 2, 0, 0] });
    }
    // Circuit piping on the human (right) side of the jacket.
    addExtra(torso, new THREE.BoxGeometry(0.006, 0.1, 0.006), cyan, [-0.055, 0.48, 0.094], {
      rot: [-0.15, 0, -0.12],
    });
    addExtra(torso, new THREE.BoxGeometry(0.045, 0.006, 0.006), magenta, [-0.04, 0.428, 0.1], {
      rot: [-0.3, 0, 0.1],
    });

    /* ---------------- prosthetic arm (character-left) ---------------- */
    const armPivot = nodes['pivot-shoulder-l'];
    // Pauldron: a domed guard capping the shoulder, not a full ball.
    addExtra(armPivot, shell(0, Math.PI * 2, 0, 1.15), plate, [0.012, -0.03, 0], {
      scale: [0.128, 0.108, 0.122],
    });
    addExtra(armPivot, new THREE.TorusGeometry(0.048, 0.009, 10, 26), alloyDark, [0.016, -0.058, 0], {
      rot: [Math.PI / 2, 0, 0],
    });
    // Bicep actuator seam.
    addExtra(armPivot, new THREE.BoxGeometry(0.005, 0.055, 0.005), cyanLive, [0.03, -0.098, 0.041]);
    // Elbow servo ring + hot joint.
    addExtra(armPivot, new THREE.TorusGeometry(0.044, 0.009, 10, 26), alloyDark, [0.032, -0.118, 0], {
      rot: [Math.PI / 2, 0, 0],
    });
    addExtra(armPivot, new THREE.SphereGeometry(0.011, 10, 8), magentaLive, [0.032, -0.118, 0.045]);
    // Forearm plating over the alloy limb.
    addExtra(armPivot, limbShell(0.047, 0.085, -1.25, 2.5), plate, [0.038, -0.162, 0], {
      rot: [0, 0, -0.1],
    });
    // Wrist coupling.
    addExtra(armPivot, new THREE.TorusGeometry(0.04, 0.008, 8, 22), alloyDark, [0.041, -0.194, 0.002], {
      rot: [Math.PI / 2, 0, 0],
    });
    // Palm emitter.
    addExtra(armPivot, new THREE.SphereGeometry(0.013, 12, 10), cyanLive, [0.045, -0.226, 0.038]);

    /* ---------------- augmented leg (character-left) ---------------- */
    const legPivot = nodes['pivot-hip-l'];
    addExtra(legPivot, limbShell(0.054, 0.1, -1.2, 2.4), plate, [0, -0.09, 0]);
    // Knee hinge bolt on the outer face of the knee (must clear the 0.048
    // leg radius or it hides inside the limb).
    addExtra(legPivot, new THREE.CylinderGeometry(0.03, 0.03, 0.018, 20), alloyDark, [0.048, -0.158, 0.008], {
      rot: [0, 0, Math.PI / 2],
    });
    addExtra(legPivot, new THREE.SphereGeometry(0.0105, 10, 8), cyanLive, [0.059, -0.158, 0.008]);
    addExtra(legPivot, limbShell(0.052, 0.075, -1.2, 2.4), plate, [0, -0.213, 0]);
    addExtra(legPivot, new THREE.TorusGeometry(0.044, 0.008, 8, 22), alloyDark, [0, -0.245, 0], {
      rot: [Math.PI / 2, 0, 0],
    });

    /* ---------------- ground FX + halo ---------------- */
    // Sole strips: dim and inset, or at chibi scale the two of them merge into
    // one bright slab that reads as a pedestal.
    const sole = glow(0x2fd8f5, 0.75);
    for (const side of ['l', 'r'] as const) {
      addExtra(nodes[`pivot-hip-${side}`], new THREE.BoxGeometry(0.078, 0.009, 0.15), sole, [0, -0.3, 0.028]);
    }
    // Neural halo with three orbiting data nodes (cyan ring, one magenta node
    // so the accent stays rare instead of reading as candy).
    addExtra(head, new THREE.TorusGeometry(0.125, 0.013, 10, 40), livingGlow(0x2fd8f5, 1.6), [0, W(1.055), 0], {
      rot: [Math.PI / 2 - 0.1, 0, 0],
    });
    [0, 2.1, 4.2].forEach((a, i) => {
      addExtra(
        head,
        new THREE.SphereGeometry(0.013, 10, 8),
        i === 1 ? magentaLive : cyan,
        [Math.cos(a) * 0.125, W(1.055) + Math.sin(-0.1) * Math.sin(a) * 0.125, Math.sin(a) * 0.125 * Math.cos(0.1)],
      );
    });
  }
}
