/**
 * createLumiModel — Levi's cat Lumi as a procedural chibi companion.
 *
 * Built from her photo (assets-src/lumi-ref.jpg): a black-and-white tuxedo cat
 * with a white face and chest, a black cap over the skull that points down the
 * forehead between the eyes, ONE black ear (her left) and one white ear with a
 * pink inner, black patches over the shoulder and hip, green eyes, pink nose.
 * Her tail is not visible in the reference; black is inferred from her patches.
 *
 * Frame matches the character: faces +Z, ground contact at y=0, her left = +X.
 * Total height ~0.30 units against the character's 1.0.
 *
 * SCALE CONVENTION (the trap): the shared sphere geometry has radius 0.5, so a
 * mesh `scale` of S produces a semi-axis of S/2 — i.e. scale is the FULL
 * diameter. Feature placement must use S/2 when solving for a surface, or
 * everything lands at double the intended offset.
 *
 * Named nodes for the render loop:
 *   'lumi-leg-fl' | 'lumi-leg-fr' | 'lumi-leg-bl' | 'lumi-leg-br'
 *   'lumi-core' (hip pivot: rocks back for the sitting wave)
 *   'lumi-tail' | 'lumi-head' | 'lumi-ear-l' | 'lumi-ear-r'
 *
 * Deterministic: no randomness.
 */
import * as THREE from 'three';

export interface LumiRuntime {
  nodes: Record<string, THREE.Object3D>;
}

const FUR_WHITE = 0xf6f3ef;
const FUR_BLACK = 0x232025;
const PINK = 0xeda6ac;
const EYE_GREEN = 0xa8c65e;

/** Head: centre and full diameters. */
const HEAD = { y: 0.205, z: 0.152, dx: 0.145, dy: 0.137, dz: 0.137 };
/** Body: centre and full diameters. */
const BODY = { y: 0.135, z: -0.02, dx: 0.165, dy: 0.15, dz: 0.3 };
/** Hip pivot: everything forward of it rocks back when she sits up to wave. */
const CORE = { y: 0.105, z: -0.1 };

/** Partial sphere shell for fur patches that hug a body without bulging.
 *  phi: π/2 = front (+Z), π = her left (+X). theta: 0 = top. */
function shell(
  phiStart: number,
  phiLength: number,
  thetaStart: number,
  thetaLength: number,
): THREE.BufferGeometry {
  return new THREE.SphereGeometry(0.5, 32, 20, phiStart, phiLength, thetaStart, thetaLength);
}

export function createLumiModel(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'lumi';
  const nodes: Record<string, THREE.Object3D> = { root };

  const fur = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0, ...extra });

  const white = fur(FUR_WHITE);
  const black = fur(FUR_BLACK);
  const patch = fur(FUR_BLACK, { side: THREE.DoubleSide });
  const pink = fur(PINK, { roughness: 0.7 });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: EYE_GREEN,
    roughness: 0.25,
    metalness: 0,
    emissive: EYE_GREEN,
    emissiveIntensity: 0.12,
  });
  const pupil = fur(0x16150f, { roughness: 0.2 });

  const sphereHi = new THREE.SphereGeometry(0.5, 32, 22);
  const sphereLo = new THREE.SphereGeometry(0.5, 18, 14);

  const add = (
    name: string,
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    pos: [number, number, number],
    opts: { rot?: [number, number, number]; scale?: [number, number, number] } = {},
  ): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.position.set(...pos);
    if (opts.rot) m.rotation.set(...opts.rot);
    if (opts.scale) m.scale.set(...opts.scale);
    m.castShadow = true;
    parent.add(m);
    nodes[name] = m;
    return m;
  };

  /* ------------------------------- body ------------------------------- */
  // Everything forward of the hips hangs off a core group, so she can rock
  // back onto her haunches for the maneki-neko wave. Core sits at the hip.
  const core = new THREE.Group();
  core.name = 'lumi-core';
  core.position.set(0, CORE.y, CORE.z);
  root.add(core);
  nodes['lumi-core'] = core;
  const C = (x: number, y: number, z: number): [number, number, number] => [x, y - CORE.y, z - CORE.z];

  // Squat and long: a leggy build reads as a rabbit, not a cat.
  add('lumi-body', core, sphereHi, white, C(0, BODY.y, BODY.z), {
    scale: [BODY.dx, BODY.dy, BODY.dz],
  });
  add('lumi-haunch', core, sphereLo, white, C(0, 0.125, -0.135), {
    scale: [0.16, 0.145, 0.14],
  });
  // Black patches over the shoulder and the hip, hugging the body surface.
  add('lumi-patch-shoulder', core, shell(0.95, 3.4, 0.0, 1.1), patch, C(0, BODY.y, BODY.z), {
    scale: [BODY.dx + 0.008, BODY.dy + 0.008, BODY.dz + 0.008],
    rot: [-0.42, 0, 0],
  });
  add('lumi-patch-hip', core, shell(0.65, 4.0, 0.0, 1.45), patch, C(0, 0.125, -0.135), {
    scale: [0.168, 0.153, 0.148],
    rot: [0.55, 0, 0],
  });

  /* ------------------------------- legs ------------------------------- */
  // Diagonal pairs trot together (fl+br, fr+bl). Short — cat, not dog.
  const legs: [string, number, number][] = [
    ['lumi-leg-fl', 0.055, 0.072],
    ['lumi-leg-fr', -0.055, 0.072],
    ['lumi-leg-bl', 0.058, -0.115],
    ['lumi-leg-br', -0.058, -0.115],
  ];
  for (const [name, x, z] of legs) {
    const pivot = new THREE.Group();
    pivot.name = name;
    // Front legs ride the core (they lift when she sits up); rear legs stay
    // planted on the root and tuck under her.
    const front = name.startsWith('lumi-leg-f');
    const parent = front ? core : root;
    const p = front ? C(x, 0.09, z) : ([x, 0.09, z] as [number, number, number]);
    pivot.position.set(...p);
    parent.add(pivot);
    nodes[name] = pivot;
    add(`${name}-limb`, pivot, new THREE.CapsuleGeometry(0.022, 0.05, 4, 10), white, [0, -0.035, 0]);
    add(`${name}-paw`, pivot, sphereLo, white, [0, -0.072, 0.01], {
      scale: [0.05, 0.034, 0.058],
    });
  }

  /* ------------------------------- tail ------------------------------- */
  // Arcs back and up, clear of the head — a near-vertical tail reads as a
  // periscope from the side.
  const tailPivot = new THREE.Group();
  tailPivot.name = 'lumi-tail';
  tailPivot.position.set(...C(0, 0.15, -0.185));
  core.add(tailPivot);
  nodes['lumi-tail'] = tailPivot;
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.006, 0.03, -0.048),
    new THREE.Vector3(0.014, 0.072, -0.058),
    new THREE.Vector3(0.02, 0.105, -0.03),
    new THREE.Vector3(0.022, 0.118, 0.002),
  ]);
  add('lumi-tail-mesh', tailPivot, new THREE.TubeGeometry(tailCurve, 22, 0.02, 10, false), black, [0, 0, 0]);
  add('lumi-tail-tip', tailPivot, sphereLo, black, [0.022, 0.12, 0.005], {
    scale: [0.04, 0.04, 0.04],
  });

  /* ------------------------------- head ------------------------------- */
  const headPivot = new THREE.Group();
  headPivot.name = 'lumi-head';
  headPivot.position.set(...C(0, HEAD.y, HEAD.z));
  core.add(headPivot);
  nodes['lumi-head'] = headPivot;

  const RX = HEAD.dx / 2; // 0.0775
  const RY = HEAD.dy / 2; // 0.0725
  const RZ = HEAD.dz / 2; // 0.0725

  add('lumi-skull', headPivot, sphereHi, white, [0, 0, 0], {
    scale: [HEAD.dx, HEAD.dy, HEAD.dz],
  });
  // Black cap wrapping well down the skull, tilted forward so the black shows
  // on the forehead from the front.
  add('lumi-cap', headPivot, shell(0, Math.PI * 2, 0, 1.45), patch, [0, 0.003, -0.006], {
    scale: [HEAD.dx + 0.007, HEAD.dy + 0.007, HEAD.dz + 0.007],
    rot: [-0.36, 0, 0],
  });
  // Forehead point running down between her eyes (flattened onto the brow).
  add('lumi-cap-point', headPivot, new THREE.ConeGeometry(0.019, 0.052, 5), patch, [0, 0.024, 0.055], {
    rot: [Math.PI - 0.32, 0, 0],
    scale: [1, 1, 0.4],
  });

  // Ears: her LEFT (+X) is black, her right is white with a pink inner. Bases
  // sit inside the skull so they grow out of the head.
  for (const side of ['l', 'r'] as const) {
    const sx = side === 'l' ? 1 : -1;
    const ear = new THREE.Group();
    ear.name = `lumi-ear-${side}`;
    ear.position.set(sx * 0.042, 0.042, -0.012);
    ear.rotation.set(-0.05, 0, sx * 0.16);
    headPivot.add(ear);
    nodes[`lumi-ear-${side}`] = ear;
    add(`lumi-ear-${side}-shell`, ear, new THREE.ConeGeometry(0.032, 0.06, 6), side === 'l' ? black : white, [0, 0.022, 0], {
      rot: [0, Math.PI / 6, 0],
      scale: [1, 1, 0.7],
    });
    add(`lumi-ear-${side}-inner`, ear, new THREE.ConeGeometry(0.019, 0.036, 6), pink, [0, 0.019, 0.009], {
      rot: [0.14, Math.PI / 6, 0],
      scale: [1, 1, 0.55],
    });
  }

  // Muzzle and nose, seated on the face rather than floating off it.
  add('lumi-muzzle', headPivot, sphereLo, white, [0, -0.019, 0.047], {
    scale: [0.074, 0.052, 0.055],
  });
  add('lumi-nose', headPivot, new THREE.ConeGeometry(0.014, 0.015, 4), pink, [0, -0.011, 0.075], {
    rot: [Math.PI + 0.35, Math.PI / 4, 0],
  });

  // Eyes: solved onto the skull surface for x=±0.038, y=+0.012.
  const eyeZ = RZ * Math.sqrt(1 - (0.038 / RX) ** 2 - (0.012 / RY) ** 2) - 0.006;
  for (const sx of [1, -1]) {
    const tag = sx > 0 ? 'l' : 'r';
    add(`lumi-eye-${tag}`, headPivot, sphereLo, eyeMat, [sx * 0.038, 0.012, eyeZ], {
      scale: [0.034, 0.038, 0.022],
    });
    add(`lumi-pupil-${tag}`, headPivot, sphereLo, pupil, [sx * 0.038, 0.012, eyeZ + 0.009], {
      scale: [0.011, 0.028, 0.012],
    });
  }

  const runtime: LumiRuntime = { nodes };
  root.userData.lumiRuntime = runtime;
  return root;
}

/* ------------------------------------------------------------------ outfits */
/**
 * applyLumiOutfit — Lumi wears kit matching whatever Levi is wearing.
 * Accessories attach to her rig nodes so they follow the head / body as she
 * trots, sits and waves. Resources are disposed on every swap.
 *
 * Remember the scale convention: sphere geometry has radius 0.5, so surface
 * solving uses half of the HEAD/BODY diameters above.
 */
export type LumiOutfit = 'dev' | 'suit' | 'tactical' | 'cyber';

type LumiResources = {
  mats: THREE.Material[];
  geos: THREE.BufferGeometry[];
  extras: THREE.Object3D[];
};

export function applyLumiOutfit(model: THREE.Group, outfit: LumiOutfit): void {
  const runtime = model.userData.lumiRuntime as LumiRuntime | undefined;
  if (!runtime) return;
  const { nodes } = runtime;

  const prev = model.userData.__lumiOutfit as LumiResources | undefined;
  if (prev) {
    prev.extras.forEach((o) => o.parent?.remove(o));
    prev.geos.forEach((g) => g.dispose());
    prev.mats.forEach((m) => m.dispose());
  }
  const res: LumiResources = { mats: [], geos: [], extras: [] };
  model.userData.__lumiOutfit = res;
  model.userData.lumiOutfit = outfit;

  const mat = (color: number, roughness: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
    res.mats.push(m);
    return m;
  };
  const glow = (color: number, intensity = 1.2) =>
    mat(color, 0.4, { emissive: color, emissiveIntensity: intensity });

  const put = (
    parent: THREE.Object3D | undefined,
    geo: THREE.BufferGeometry,
    material: THREE.Material,
    pos: [number, number, number],
    opts: { rot?: [number, number, number]; scale?: [number, number, number] } = {},
  ) => {
    if (!parent) return;
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(...pos);
    if (opts.rot) mesh.rotation.set(...opts.rot);
    if (opts.scale) mesh.scale.set(...opts.scale);
    mesh.castShadow = true;
    parent.add(mesh);
    res.geos.push(geo);
    res.extras.push(mesh);
  };

  const head = nodes['lumi-head'];
  const core = nodes['lumi-core'];
  // Neck junction in core-local space. Head and body interpenetrate here, so
  // collar rings are sized to enclose BOTH cross-sections; a snug ring just
  // disappears inside her.
  const NECK: [number, number, number] = [0, 0.176 - CORE.y, 0.118 - CORE.z];

  if (outfit === 'dev') {
    // Tiny headphones to match his: band arcs over the skull, cups at the ears.
    const cans = mat(0x23252d, 0.5);
    const cansSoft = mat(0x30333e, 0.8);
    put(head, new THREE.TorusGeometry(0.079, 0.008, 8, 24, Math.PI), cans, [0, 0.004, -0.008]);
    for (const sx of [1, -1]) {
      put(head, new THREE.CylinderGeometry(0.026, 0.026, 0.016, 16), cans, [sx * 0.076, 0.004, -0.008], {
        rot: [0, 0, Math.PI / 2],
      });
      put(head, new THREE.CylinderGeometry(0.019, 0.019, 0.007, 16), cansSoft, [sx * 0.086, 0.004, -0.008], {
        rot: [0, 0, Math.PI / 2],
      });
    }
  }

  if (outfit === 'suit') {
    // Little formal bow tie at the throat.
    const satin = mat(0x22242c, 0.35);
    const bowZ = NECK[2] + 0.03;
    put(core, new THREE.BoxGeometry(0.018, 0.018, 0.013), satin, [NECK[0], NECK[1] - 0.012, bowZ]);
    for (const sx of [1, -1]) {
      put(core, new THREE.ConeGeometry(0.02, 0.028, 4), satin, [
        NECK[0] + sx * 0.025,
        NECK[1] - 0.012,
        bowZ,
      ], { rot: [0, 0, sx * (Math.PI / 2)], scale: [1, 1, 0.6] });
    }
  }

  if (outfit === 'tactical') {
    // Scaled-down plate carrier: girth strap, back plate, pouch, IFF strobe.
    const vest = mat(0x394030, 0.95);
    const pouch = mat(0x8a7350, 0.92);
    const amber = glow(0xffab3d, 0.9);
    put(core, new THREE.TorusGeometry(0.078, 0.013, 10, 24), vest, [0, 0.135 - CORE.y, 0.01 - CORE.z], {
      scale: [1, 1, 0.55],
    });
    put(core, new THREE.BoxGeometry(0.1, 0.05, 0.075), vest, [0, 0.196 - CORE.y, 0.005 - CORE.z], {
      rot: [0.12, 0, 0],
    });
    put(core, new THREE.BoxGeometry(0.032, 0.026, 0.02), pouch, [0.042, 0.19 - CORE.y, 0.01 - CORE.z], {
      rot: [0.12, 0, 0],
    });
    put(core, new THREE.SphereGeometry(0.007, 10, 8), amber, [-0.04, 0.207 - CORE.y, 0.01 - CORE.z]);
  }

  if (outfit === 'cyber') {
    // Glowing collar plus her own little neural halo, matching his.
    const cyan = glow(0x2fd8f5, 1.2);
    const magenta = glow(0xe23fc4, 1.1);
    put(core, new THREE.TorusGeometry(0.079, 0.008, 10, 26), cyan, NECK, { rot: [0.5, 0, 0] });
    put(core, new THREE.SphereGeometry(0.011, 12, 10), magenta, [NECK[0], NECK[1] - 0.052, NECK[2] + 0.022]);
    put(head, new THREE.TorusGeometry(0.058, 0.006, 10, 30), cyan, [0, 0.125, -0.022], {
      rot: [Math.PI / 2 - 0.16, 0, 0],
    });
  }
}
