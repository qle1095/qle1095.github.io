/**
 * Era outfits for the chibi. Applied on top of createLeviChibiModel by mesh
 * name: body parts are re-materialed, tuxedo-specific parts toggled, and
 * procedural accessories attached to the correct rig nodes (so headphones
 * follow the head, boot glows follow the legs).
 *
 *   dev      — hoodie + headphones + jeans + sneakers   (Foundations)
 *   suit     — navy banker suit + red tie               (JPMorgan)
 *   tactical — olive field shirt + vest + boots         (Raft)
 *   cyber    — dark jacket + neon piping + visor        (AI era)
 */
import * as THREE from 'three';
import type { LeviChibiRuntime } from './createLeviChibiModel';

export type Outfit = 'dev' | 'suit' | 'tactical' | 'cyber';

type OutfitResources = {
  mats: THREE.Material[];
  geos: THREE.BufferGeometry[];
  extras: THREE.Object3D[];
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
  const res: OutfitResources = { mats: [], geos: [], extras: [] };
  model.userData.__outfitResources = res;
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
  }

  if (outfit === 'cyber') {
    showTux(false);
    const jacket = std(0x161824, 0.45, { metalness: 0.3 });
    const trouser = std(0x12141d, 0.55);
    const shoe = std(0x101018, 0.35);
    const cyan = glow(0x66f2ff, 1.6);
    const magenta = glow(0xff4fd8, 1.3);
    setMat('torso-jacket', jacket);
    setMat('arm-l', jacket);
    setMat('arm-r', jacket);
    setMat('pelvis', trouser);
    setMat('leg-l', trouser);
    setMat('leg-r', trouser);
    setMat('shoe-l', shoe);
    setMat('shoe-r', shoe);
    // Glowing collar ring around the neck.
    addExtra(torso, new THREE.TorusGeometry(0.064, 0.009, 8, 28), cyan, [0, 0.618, 0.012], {
      rot: [Math.PI / 2, 0, 0],
    });
    // Circuit piping on the chest.
    addExtra(torso, new THREE.BoxGeometry(0.007, 0.13, 0.007), cyan, [0.028, 0.5, 0.106], {
      rot: [-0.15, 0, 0.12],
    });
    addExtra(torso, new THREE.BoxGeometry(0.007, 0.09, 0.007), magenta, [-0.048, 0.475, 0.103], {
      rot: [-0.15, 0, -0.1],
    });
    addExtra(torso, new THREE.BoxGeometry(0.05, 0.007, 0.007), cyan, [-0.01, 0.44, 0.112], {
      rot: [-0.3, 0, 0],
    });
    // Forehead AR visor band (below the quiff, above the brows).
    const visorMat = std(0x66f2ff, 0.2, {
      emissive: 0x66f2ff,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.55,
    });
    addExtra(head, new THREE.BoxGeometry(0.27, 0.034, 0.02), visorMat, [0, W(0.848), 0.142], {
      rot: [-0.12, 0, 0],
    });
    // Neon shoe soles (attached to the leg pivots so they walk with the feet).
    for (const side of ['l', 'r'] as const) {
      addExtra(nodes[`pivot-hip-${side}`], new THREE.BoxGeometry(0.095, 0.014, 0.175), cyan, [0, -0.298, 0.028]);
    }
  }
}
