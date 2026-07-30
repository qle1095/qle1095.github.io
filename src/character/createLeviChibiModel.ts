/**
 * createLeviChibiModel — procedural full-body chibi character (img2threejs pipeline).
 *
 * Spec: assets-src/chibi/levi-chibi-spec.json (2.75 head-units, total height ~1.0,
 * ground contact at y=0, character faces +Z; character-left = +X).
 *
 * Animation contract (names are load-bearing for the website):
 *   'pivot-shoulder-l' / 'pivot-shoulder-r'  at (±0.135, 0.575, 0) — arms hang below
 *   'pivot-hip-l'      / 'pivot-hip-r'       at (±0.058, 0.30, 0)  — legs hang below
 *   'pivot-neck'                              at (0, 0.645, 0)      — head + hair + face
 * root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups }.
 *
 * Deterministic: no randomness anywhere.
 */
import * as THREE from 'three';

export type LeviChibiStage = 'blockout' | 'full';

export interface LeviChibiOptions {
  /** 'blockout' shows only the macro masses; 'full' (default) everything. */
  stage?: LeviChibiStage;
  /** Force a single neutral clay material (blockout / structure review). */
  clay?: boolean;
  castShadow?: boolean;
}

export interface LeviChibiRuntime {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
}

/* ------------------------------------------------------------------ layout */
// World-space layout constants (match the sculpt spec componentTree).
const SHOULDER = { x: 0.135, y: 0.575 };
const HIP = { x: 0.058, y: 0.3 };
const NECK_PIVOT_Y = 0.645;

/* --------------------------------------------------------------- materials */
function buildMaterials(clay: boolean): Record<string, THREE.Material> {
  if (clay) {
    const clayMat = new THREE.MeshStandardMaterial({
      color: 0x8e8e93,
      roughness: 0.9,
      metalness: 0,
    });
    return new Proxy(
      { clay: clayMat },
      { get: (target) => target.clay },
    ) as unknown as Record<string, THREE.Material>;
  }
  const std = (
    color: number,
    roughness: number,
    extra: Partial<THREE.MeshStandardMaterialParameters> = {},
  ) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
  const phys = (
    color: number,
    roughness: number,
    clearcoat: number,
    extra: Partial<THREE.MeshPhysicalMaterialParameters> = {},
  ) =>
    new THREE.MeshPhysicalMaterial({
      color,
      roughness,
      metalness: 0,
      clearcoat,
      clearcoatRoughness: 0.35,
      ...extra,
    });
  return {
    skin: std(0xf2c39b, 0.55),
    hair: std(0x26201b, 0.58),
    'jacket-wool': std(0x1b1c20, 0.85),
    'lapel-satin': phys(0x26272c, 0.28, 0.25),
    'shirt-cotton': std(0xf7f5ef, 0.7),
    'bowtie-satin': phys(0x191a1e, 0.32, 0.2),
    'trouser-wool': std(0x17181b, 0.82),
    'shoe-leather': phys(0x131316, 0.34, 0.3),
    'eye-dark': std(0x221710, 0.24),
    catchlight: std(0xffffff, 0.15, { emissive: 0xffffff, emissiveIntensity: 0.55 }),
    brow: std(0x2a211a, 0.7),
    mouth: std(0x9c5b49, 0.6),
  };
}

/* ---------------------------------------------------------------- geometry */
/** Tapered box: scales the -X (inner) end of a unit box — used for bow-tie wings. */
function taperedBoxGeometry(w: number, h: number, d: number, innerScale: number): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(w, h, d, 1, 1, 1);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    if (x < 0) {
      pos.setY(i, pos.getY(i) * innerScale);
      pos.setZ(i, pos.getZ(i) * innerScale);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Builds a thin extruded panel from an outline, mirrored for the right side with
 * the point order reversed so the winding (and face normals) stay correct. */
function panelGeometry(points: [number, number][], sx: 1 | -1, depth: number): THREE.BufferGeometry {
  const pts = points.map(([x, y]) => new THREE.Vector2(x * sx, y));
  if (sx < 0) pts.reverse();
  const s = new THREE.Shape(pts);
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/** Satin peak lapel outline: strip in world units, +Y up the strip, +X outward.
 * The peak tip flare at the top is the peak-lapel identity feature. */
const LAPEL_OUTLINE: [number, number][] = [
  [-0.02, -0.068], // inner lower point (near closure)
  [0.022, -0.06], // outer lower edge
  [0.038, 0.03], // outer edge rising
  [0.085, 0.062], // peak tip flaring outward/up
  [0.03, 0.068], // notch back toward the collar
  [-0.03, 0.058], // inner collar edge
];

/** White shirt wedge between the lapels: wide at collar, apex down. */
const SHIRT_OUTLINE: [number, number][] = [
  [-0.04, 0.052],
  [0.04, 0.052],
  [0.0, -0.052],
];

/* ------------------------------------------------------------------- build */
export function createLeviChibiModel(options: LeviChibiOptions = {}): THREE.Group {
  const stage: LeviChibiStage = options.stage ?? 'full';
  const clay = options.clay ?? false;
  const castShadow = options.castShadow ?? true;
  const mats = buildMaterials(clay);

  const root = new THREE.Group();
  root.name = 'levi-chibi';

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};

  const full = stage === 'full';

  const sphereGeo = new THREE.SphereGeometry(0.5, 32, 24); // unit; scaled per part
  const sphereGeoLow = new THREE.SphereGeometry(0.5, 20, 14);

  function addMesh(
    id: string,
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    materialId: string,
    pos: [number, number, number],
    opts: {
      rot?: [number, number, number];
      scale?: [number, number, number];
      explodeWithParent?: boolean;
      colliderType?: string;
    } = {},
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(geo, mats[materialId]);
    mesh.name = id;
    mesh.position.set(...pos);
    if (opts.rot) mesh.rotation.set(...opts.rot);
    if (opts.scale) mesh.scale.set(...opts.scale);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = false;
    if (opts.explodeWithParent) mesh.userData.explodeWithParent = true;
    parent.add(mesh);
    meshes[id] = mesh;
    nodes[id] = mesh;
    colliders[id] = {
      type: opts.colliderType ?? 'box',
      offset: [0, 0, 0],
      scale: [1, 1, 1],
      isTrigger: false,
      notes: 'simplified proxy',
    };
    return mesh;
  }

  function addSocket(name: string, parent: THREE.Object3D, pos: [number, number, number]): void {
    const s = new THREE.Object3D();
    s.name = name;
    s.position.set(...pos);
    parent.add(s);
    sockets[name] = s;
  }

  /* ---------------- lower body: pelvis + hip pivots + legs + shoes -------- */
  addMesh('pelvis', root, sphereGeo, 'trouser-wool', [0, 0.295, 0], {
    scale: [0.235, 0.16, 0.175],
  });
  addSocket('socket-hip-l', root, [HIP.x, HIP.y, 0]);
  addSocket('socket-hip-r', root, [-HIP.x, HIP.y, 0]);

  for (const side of ['l', 'r'] as const) {
    const sx = side === 'l' ? 1 : -1;
    const hipPivot = new THREE.Group();
    hipPivot.name = `pivot-hip-${side}`;
    hipPivot.position.set(sx * HIP.x, HIP.y, 0);
    root.add(hipPivot);
    nodes[`pivot-hip-${side}`] = hipPivot;

    // Leg capsule: world center (±0.058, 0.165, 0) -> local (0, -0.135, 0).
    addMesh(`leg-${side}`, hipPivot, new THREE.CapsuleGeometry(0.048, 0.19, 6, 16), 'trouser-wool', [0, -0.135, 0], {
      colliderType: 'capsule',
    });
    // Shoe: world (±0.058, 0.034, 0.028) -> local (0, -0.266, 0.028).
    addMesh(`shoe-${side}`, hipPivot, sphereGeo, 'shoe-leather', [0, -0.266, 0.028], {
      scale: [0.095, 0.065, 0.175],
    });
    addSocket(`socket-ankle-${side}`, hipPivot, [0, -0.24, 0]);
  }

  /* ---------------- torso group: jacket + tuxedo details ------------------ */
  const torso = new THREE.Group();
  torso.name = 'torso';
  root.add(torso);
  nodes['torso'] = torso;

  addMesh('torso-jacket', torso, sphereGeo, 'jacket-wool', [0, 0.455, 0], {
    scale: [0.31, 0.37, 0.22],
  });
  addSocket('socket-chest', torso, [0, 0.545, 0.1]);
  addSocket('socket-collar', torso, [0, 0.625, 0.09]);
  addSocket('socket-neck', torso, [0, 0.635, 0.005]);

  if (full) {
    // Satin peak lapels: angled strips forming the double-breasted V.
    // Torso front z(y) = 0.11 * sqrt(1 - ((y - 0.455) / 0.185)^2): panels tilt back
    // (rot.x) to follow the chest curvature and stay surface-mounted.
    for (const side of ['l', 'r'] as const) {
      const sx = side === 'l' ? 1 : -1;
      const geo = panelGeometry(LAPEL_OUTLINE, sx, 0.012);
      const lapel = addMesh(`lapel-${side}`, torso, geo, 'lapel-satin', [sx * 0.056, 0.552, sx > 0 ? 0.096 : 0.094], {
        rot: [-0.39, 0, sx * -0.62],
        explodeWithParent: true,
      });
      lapel.userData.partOf = 'torso-jacket';
    }
    // White shirt triangle between the lapels (spans y ~0.51..0.615).
    addMesh('shirt-triangle', torso, panelGeometry(SHIRT_OUTLINE, 1, 0.012), 'shirt-cotton', [0, 0.5625, 0.082], {
      rot: [-0.36, 0, 0],
      explodeWithParent: true,
    });

    // Butterfly bow tie: named group of anonymous meshes = one part.
    // Tucked under the chin at the collar (torso front at y 0.60 is z ~0.068).
    const bowTie = new THREE.Group();
    bowTie.name = 'bow-tie';
    bowTie.position.set(0, 0.607, 0.07);
    bowTie.rotation.x = -0.1;
    torso.add(bowTie);
    nodes['bow-tie'] = bowTie;
    const knot = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.018), mats['bowtie-satin']);
    knot.position.set(0, 0, 0.004);
    knot.castShadow = castShadow;
    bowTie.add(knot);
    meshes['bowtie-knot'] = knot;
    for (const sx of [1, -1]) {
      const wingGeo = taperedBoxGeometry(0.052, 0.034, 0.016, 0.55);
      const wing = new THREE.Mesh(wingGeo, mats['bowtie-satin']);
      wing.scale.x = sx;
      wing.position.set(sx * 0.037, 0, -0.004);
      wing.rotation.z = sx * 0.06;
      wing.castShadow = castShadow;
      bowTie.add(wing);
      meshes[`bowtie-wing-${sx > 0 ? 'l' : 'r'}`] = wing;
    }
    colliders['bow-tie'] = { type: 'box', offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: 'simplified proxy' };

    // Two dark buttons on the double-breasted closure.
    for (const side of ['l', 'r'] as const) {
      const sx = side === 'l' ? 1 : -1;
      addMesh(`button-${side}`, torso, new THREE.CylinderGeometry(0.009, 0.009, 0.006, 16), 'shoe-leather', [sx * 0.036, 0.435, 0.112], {
        rot: [1.4708, 0, 0],
        explodeWithParent: true,
      });
    }
  }

  /* ---------------- arms: shoulder pivots + sleeves + mitten hands -------- */
  addSocket('socket-shoulder-l', torso, [SHOULDER.x, SHOULDER.y, 0]);
  addSocket('socket-shoulder-r', torso, [-SHOULDER.x, SHOULDER.y, 0]);
  for (const side of ['l', 'r'] as const) {
    const sx = side === 'l' ? 1 : -1;
    const shoulderPivot = new THREE.Group();
    shoulderPivot.name = `pivot-shoulder-${side}`;
    shoulderPivot.position.set(sx * SHOULDER.x, SHOULDER.y, 0);
    root.add(shoulderPivot);
    nodes[`pivot-shoulder-${side}`] = shoulderPivot;

    // Sleeve, splayed ~6 deg outward. World center (±0.163, 0.468, 0) -> local.
    addMesh(`arm-${side}`, shoulderPivot, new THREE.CapsuleGeometry(0.037, 0.16, 6, 16), 'jacket-wool', [sx * 0.028, -0.107, 0], {
      rot: [0, 0, sx * -0.1],
      colliderType: 'capsule',
    });
    // Mitten hand. World (±0.178, 0.352, 0.004) -> local.
    addMesh(`hand-${side}`, shoulderPivot, sphereGeoLow, 'skin', [sx * 0.043, -0.223, 0.004], {
      scale: [0.082, 0.082, 0.082],
    });
    addSocket(`socket-wrist-${side}`, shoulderPivot, [sx * 0.04, -0.2, 0]);
  }

  /* ---------------- neck pivot: neck + head + hair + face ----------------- */
  const neckPivot = new THREE.Group();
  neckPivot.name = 'pivot-neck';
  neckPivot.position.set(0, NECK_PIVOT_Y, 0);
  root.add(neckPivot);
  nodes['pivot-neck'] = neckPivot;
  const W = (y: number): number => y - NECK_PIVOT_Y; // world-y -> neck-local-y

  addMesh('neck', neckPivot, new THREE.CylinderGeometry(0.0475, 0.0475, 0.07, 20), 'skin', [0, W(0.635), 0.005]);

  const headGroup = new THREE.Group();
  headGroup.name = 'head-group';
  neckPivot.add(headGroup);
  nodes['head-group'] = headGroup;

  addMesh('head', headGroup, sphereGeo, 'skin', [0, W(0.8), 0.005], {
    scale: [0.35, 0.33, 0.32],
  });
  addSocket('socket-skull', headGroup, [0, W(0.9), 0]);

  // Hair: main swept-up mass + forward quiff + side masses + back taper.
  addMesh('hair-main', headGroup, sphereGeo, 'hair', [0, W(0.845), -0.018], {
    scale: [0.375, 0.3, 0.35],
  });
  if (full) {
    addMesh('hair-quiff', headGroup, sphereGeo, 'hair', [0.055, W(0.925), 0.085], {
      rot: [-0.38, 0, -0.18],
      scale: [0.175, 0.125, 0.16],
      explodeWithParent: true,
    });
    addMesh('hair-side-l', headGroup, sphereGeo, 'hair', [0.152, W(0.825), -0.01], {
      scale: [0.075, 0.16, 0.2],
      explodeWithParent: true,
    });
    addMesh('hair-side-r', headGroup, sphereGeo, 'hair', [-0.152, W(0.825), -0.01], {
      scale: [0.075, 0.16, 0.2],
      explodeWithParent: true,
    });
    addMesh('hair-back', headGroup, sphereGeo, 'hair', [0, W(0.775), -0.132], {
      scale: [0.3, 0.24, 0.13],
      explodeWithParent: true,
    });

    // Ears bracketed between eye line and nose base.
    for (const side of ['l', 'r'] as const) {
      const sx = side === 'l' ? 1 : -1;
      addMesh(`ear-${side}`, headGroup, sphereGeoLow, 'skin', [sx * 0.176, W(0.78), 0.005], {
        scale: [0.035, 0.072, 0.05],
        explodeWithParent: true,
      });
    }

    // Face: large dark almond eyes + catchlights, thin brows, minimal nose, smile.
    for (const side of ['l', 'r'] as const) {
      const sx = side === 'l' ? 1 : -1;
      addMesh(`eye-${side}`, headGroup, sphereGeo, 'eye-dark', [sx * 0.066, W(0.788), 0.146], {
        scale: [0.056, 0.068, 0.026],
        explodeWithParent: true,
      });
      // Same world offset (up + character-left) on both eyes so they read as one key light.
      addMesh(`catchlight-${side}`, headGroup, sphereGeoLow, 'catchlight', [sx * 0.066 + 0.012, W(0.804), 0.163], {
        scale: [0.017, 0.017, 0.017],
        explodeWithParent: true,
      });
      addMesh(`brow-${side}`, headGroup, new THREE.BoxGeometry(0.062, 0.013, 0.013), 'brow', [sx * 0.068, W(0.842), 0.152], {
        rot: [0, 0, sx * 0.1],
        explodeWithParent: true,
      });
    }
    addMesh('nose', headGroup, sphereGeoLow, 'skin', [0, W(0.748), 0.166], {
      scale: [0.024, 0.018, 0.02],
      explodeWithParent: true,
    });
    // Gentle closed smile: partial torus arc, opening upward.
    const smileGeo = new THREE.TorusGeometry(0.024, 0.0055, 8, 24, Math.PI * 0.75);
    smileGeo.rotateZ(Math.PI + (Math.PI * 0.25) / 2); // center the arc, opening up
    addMesh('mouth', headGroup, smileGeo, 'mouth', [0, W(0.72), 0.152], {
      rot: [0.25, 0, 0],
      explodeWithParent: true,
    });
  }

  /* ------------------------------------------------------------- runtime */
  const runtime: LeviChibiRuntime = {
    nodes,
    meshes,
    sockets,
    colliders,
    destructionGroups: {},
  };
  root.userData.sculptRuntime = runtime;
  root.userData.sculptStage = stage;
  root.userData.animationContract = {
    pivots: ['pivot-shoulder-l', 'pivot-shoulder-r', 'pivot-hip-l', 'pivot-hip-r', 'pivot-neck'],
    groundContactY: 0,
    totalHeight: 1.0,
    headUnits: 2.75,
  };
  return root;
}
