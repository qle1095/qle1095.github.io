/**
 * createLumiModel — Levi's cat Lumi as a designer-vinyl chibi companion.
 *
 * Built from her photo (assets-src/lumi-ref.jpg): a slim young black-and-white
 * bicolour, mostly white. A black cap over the skull comes down the forehead
 * in a sharp widow's peak between the eyes and spreads over each brow like
 * eyebrows; on HER LEFT (+X) the black runs on down the temple beside the eye.
 * Her left ear is black, her right ear white with a pink inner. White muzzle,
 * chest, legs and paws; green-yellow eyes; pink nose; long white whiskers. A
 * separate black patch sits over the withers behind the head, and a big black
 * saddle covers the back and hip (white underneath). The tail is not visible
 * in the reference; black is inferred from the saddle.
 *
 * Frame matches the character: faces +Z, ground contact at y=0, her left = +X.
 * Total height ~0.30 units against the character's 1.0.
 *
 * MARKINGS are painted, not layered: the skull and torso are shaped spheres
 * whose CanvasTextures are baked per texel from the SAME shape function used
 * to place the vertices, so every patch is evaluated at its exact surface
 * point. No shells, so no z-fighting and no bulges; edges are antialiased in
 * the bake. Ears carry their colours as vertex colours.
 *
 * SCALE CONVENTION (the trap): the shared sphere geometry has radius 0.5, so a
 * mesh `scale` of S produces a semi-axis of S/2 — i.e. scale is the FULL
 * diameter. The shaped skull/torso below are the exception: HEAD/TORSO give
 * SEMI-axes (they are built in place, not scaled). Face features are placed
 * by raycasting the actual skull/muzzle surfaces, not by solving ellipsoids.
 *
 * Named nodes for the render loop (see animateLumi at the bottom):
 *   'lumi-leg-fl' | 'lumi-leg-fr' | 'lumi-leg-bl' | 'lumi-leg-br'
 *   'lumi-core' (hip pivot: rocks back for the sitting wave)
 *   'lumi-tail' (+ child 'lumi-tail-tip') | 'lumi-head'
 *   'lumi-ear-l' | 'lumi-ear-r' | 'lumi-eye-l' | 'lumi-eye-r' (blink)
 *
 * Deterministic: no randomness.
 */
import * as THREE from 'three';

export interface LumiRuntime {
  nodes: Record<string, THREE.Object3D>;
  /** Geometries, materials and textures owned by the base model. */
  disposables: { dispose(): void }[];
  /** Rest rotations of animated nodes that are not built at identity. */
  rest: Record<string, THREE.Euler>;
}

/* Palette (sRGB). The black is blue-tinted so it keeps form on the dark
 * AI-era sky instead of crushing to a flat hole. */
const FUR_WHITE = 0xf7f3ee;
const FUR_BLACK = 0x17181f;
const EAR_PINK = 0xf3a6b0;
const EAR_PINK_DEEP = 0xdc8494;
const EAR_DUSK = 0x5f4855; // inner cup of the black ear: reads dark at 50px
const NOSE_PINK = 0xec95a2;
const LINER = 0x262230;
const MOUTH = 0x8a6470;

/** Head pivot position (root space) and skull SEMI-axes. */
const HEAD = { y: 0.182, z: 0.158, rx: 0.079, ry: 0.07, rz: 0.068 };
/** Uniform scale on the head pivot: chibi head:body ratio. Head-local design
 *  space (features, outfit pieces) stays in the unscaled units above. */
const HEAD_SCALE = 1.1;
/** Torso: axis height, centre z, half-length (front = +Z). */
const TORSO = { yc: 0.13, z0: -0.025, lh: 0.162 };
/** Leg pivot height = ground clearance of the pivots (paw bottom at y=0). */
const LEG_Y = 0.081;
/** Hip pivot: everything forward of it rocks back when she sits up to wave. */
const CORE = { y: 0.105, z: -0.1 };

const gauss = (x: number, c: number, w: number) => Math.exp(-(((x - c) / w) ** 2));
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** sqrt(a²+b²) — Math.hypot is several times slower in V8, and the texture
 *  bakes call this per texel. */
const hyp = (a: number, b: number) => Math.sqrt(a * a + b * b);

type ShapeFn = (dx: number, dy: number, dz: number, out: THREE.Vector3) => void;

/** Skull: slightly flat crown, full cheeks, a touch longer at the back. */
const headShape: ShapeFn = (dx, dy, dz, out) => {
  const cheek = 1 + 0.07 * gauss(dy, -0.3, 0.38) * (0.6 + 0.4 * Math.max(0, dz));
  const rz = HEAD.rz * mix(1.05, 0.96, smooth(-0.4, 0.4, dz));
  out.set(dx * HEAD.rx * cheek, dy * HEAD.ry * (1 - 0.07 * Math.max(0, dy) ** 2), dz * rz);
};

/** Torso profile along s (-1 rump .. +1 chest): deep chest, tucked waist,
 *  rounded haunch, and a front that rises into the neck. Root-space output. */
const torsoShape: ShapeFn = (dx, dy, dz, out) => {
  const s = dz;
  const rx = 0.069 + 0.007 * gauss(s, 0.5, 0.32) - 0.009 * gauss(s, -0.05, 0.3) + 0.012 * gauss(s, -0.58, 0.3);
  const ryT = 0.063 + 0.004 * gauss(s, 0.5, 0.3) - 0.003 * gauss(s, 0, 0.3) + 0.007 * gauss(s, -0.55, 0.3);
  const ryB = 0.08 + 0.01 * gauss(s, 0.42, 0.3) - 0.015 * gauss(s, -0.08, 0.32) + 0.006 * gauss(s, -0.62, 0.25);
  const ring = hyp(dx, dy);
  const elev = ring > 1e-6 ? dy / ring : 0;
  const ry = mix(ryB, ryT, smooth(-0.45, 0.45, elev));
  const yc = TORSO.yc + 0.006 * gauss(s, -0.45, 0.4) + 0.026 * gauss(s, 1, 0.32);
  // Blunt the ends a little (C1 at s=0).
  const zs = (s * 1.3) / (1 + 0.3 * Math.abs(s));
  out.set(dx * rx, yc + dy * ry, TORSO.z0 + zs * TORSO.lh);
};

/** The torso sphere is laid on its side (poles at chest and rump) with its
 *  UV seam under the belly, where it is never seen. */
const torsoDir = (dx: number, dy: number, dz: number): [number, number, number] => [dz, dx, dy];
/** Skull UV seam turned to the back of the head (default is her right
 *  temple, which faces the site camera). */
const headDir = (dx: number, dy: number, dz: number): [number, number, number] => [-dz, dy, dx];

/** A UV sphere moved onto `shape`, with seam/pole normals welded. */
function shapedSphere(
  wSeg: number,
  hSeg: number,
  shape: ShapeFn,
  dir?: (dx: number, dy: number, dz: number) => [number, number, number],
): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.5, wSeg, hSeg);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).multiplyScalar(2);
    const [dx, dy, dz] = dir ? dir(v.x, v.y, v.z) : [v.x, v.y, v.z];
    shape(dx, dy, dz, v);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  weldNormals(g);
  return g;
}

/** computeVertexNormals, then average normals of coincident vertices so the
 *  UV seam and poles shade smoothly. */
function weldNormals(g: THREE.BufferGeometry): void {
  g.computeVertexNormals();
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nor = g.attributes.normal as THREE.BufferAttribute;
  const groups = new Map<string, number[]>();
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`;
    const list = groups.get(k);
    if (list) list.push(i);
    else groups.set(k, [i]);
  }
  const n = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    n.set(0, 0, 0);
    for (const i of list) n.add(tmp.fromBufferAttribute(nor, i));
    n.normalize();
    for (const i of list) nor.setXYZ(i, n.x, n.y, n.z);
  }
}

/** Bakes an equirectangular texture for a (shaped) UV sphere. `paint` gets
 *  the sphere's unit direction for each texel (SphereGeometry convention:
 *  row 0 = +Y pole, u=0.25 faces +Z) and writes sRGB 0-255 into rgb.
 *
 *  With `block` > 1, paint is first sampled on a block-corner lattice and
 *  blocks whose four corners agree are flat-filled; only blocks straddling a
 *  marking edge are painted per texel. Patches are far larger than a block,
 *  so the result is identical at a fraction of the cost. */
function bakeTexture(
  w: number,
  h: number,
  paint: (dx: number, dy: number, dz: number, rgb: number[]) => void,
  block = 1,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const rgb = [0, 0, 0];
  const texel = (i: number, j: number) => {
    const theta = ((j + 0.5) / h) * Math.PI;
    const phi = ((i + 0.5) / w) * Math.PI * 2;
    const st = Math.sin(theta);
    paint(-Math.cos(phi) * st, Math.cos(theta), Math.sin(phi) * st, rgb);
    return (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
  };
  const put = (i: number, j: number, c: number) => {
    const k = (j * w + i) * 4;
    data[k] = (c >> 16) & 255;
    data[k + 1] = (c >> 8) & 255;
    data[k + 2] = c & 255;
    data[k + 3] = 255;
  };
  const B = Math.max(1, block);
  const bw = Math.ceil(w / B);
  const bh = Math.ceil(h / B);
  const corner = new Int32Array((bw + 1) * (bh + 1));
  if (B > 1) {
    for (let bj = 0; bj <= bh; bj++) {
      for (let bi = 0; bi <= bw; bi++) {
        corner[bj * (bw + 1) + bi] = texel((bi * B) % w, Math.min(h - 1, bj * B));
      }
    }
  }
  for (let bj = 0; bj < bh; bj++) {
    for (let bi = 0; bi < bw; bi++) {
      const i0 = bi * B;
      const j0 = bj * B;
      const i1 = Math.min(w, i0 + B);
      const j1 = Math.min(h, j0 + B);
      const c00 = corner[bj * (bw + 1) + bi];
      const flat =
        B > 1 &&
        c00 === corner[bj * (bw + 1) + bi + 1] &&
        c00 === corner[(bj + 1) * (bw + 1) + bi] &&
        c00 === corner[(bj + 1) * (bw + 1) + bi + 1];
      for (let j = j0; j < j1; j++) {
        for (let i = i0; i < i1; i++) put(i, j, flat ? c00 : texel(i, j));
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const rgbOf = (hex: number): [number, number, number] => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const W_RGB = rgbOf(FUR_WHITE);
const B_RGB = rgbOf(FUR_BLACK);
function furMix(rgb: number[], black: number): void {
  for (let c = 0; c < 3; c++) rgb[c] = Math.round(mix(W_RGB[c], B_RGB[c], black));
}

/* ------------------------------------------------------------- markings */
/** Black coverage of the cap at a head-local surface point. */
function capCoverage(p: THREE.Vector3): number {
  const nx = p.x / HEAD.rx;
  const ny = p.y / HEAD.ry;
  const nz = p.z / HEAD.rz;
  const ax = Math.abs(nx);
  // Front edge: the white forehead dome, dipped over each brow ("eyebrows"),
  // with a sharp V widow's peak running down between the eyes.
  let front = 0.64 - 0.27 * gauss(ax, 0.48, 0.25);
  if (nx < 0) {
    // Her right: the brow band carries on outward, then lifts to the white ear.
    if (ax > 0.48) front = mix(0.37, 0.8, smooth(0.8, 1.02, ax));
  } else {
    // Her left: black runs down the temple beside the eye to the cheek.
    front -= 0.62 * smooth(0.6, 0.93, nx);
  }
  const peak = 0.16 + 1.85 * ax;
  front = Math.min(front, peak);
  // Back of the skull: black down to about ear-base level (white nape), lower
  // on her left where it joins the temple.
  const back = 0.12 - 0.3 * smooth(0.35, 0.9, nx);
  const edge = mix(back, front, smooth(-0.15, 0.45, nz));
  return smooth(-0.02, 0.02, ny - edge);
}

/** Black coverage of the shoulder patch + back/hip saddle on the torso, in
 *  the torso's parametric space (s along the body, h around it: top = 1). */
function coatCoverage(dx: number, dy: number, s: number): number {
  const ring = hyp(dx, dy);
  const h = ring > 1e-6 ? Math.atan2(dy, Math.abs(dx)) / (Math.PI / 2) : 0;
  const left = dx > 0 ? 1 : 0; // slight asymmetry so she isn't a stencil
  const e = 0.014;

  // Saddle: front edge slants back as it goes down the flank; lower edge
  // along the belly line, lifting at the rump so the back of the thigh is
  // white. Rounded front-lower corner.
  const frontEdge = 0.04 + 0.14 * h + 0.025 * Math.sin(h * 6.5 + 1.3) - 0.03 * left;
  const lowEdge = -0.36 - 0.05 * gauss(s, -0.5, 0.25) + 0.28 * smooth(-0.78, -1.0, s) + 0.02 * Math.sin(s * 9);
  const q1 = frontEdge - s;
  const q2 = h - lowEdge;
  const r = 0.12;
  const sd = r - hyp(Math.max(r - q1, 0), Math.max(r - q2, 0));
  const saddle = smooth(-e, e, sd);

  // Shoulder patch over the withers: wide on top, rounding off down the
  // shoulder, wrapping over the spine to the other side.
  const cs = 0.6 - 0.02 * left;
  const ch = 0.92;
  const ss = s - cs + 0.07 * (h - ch);
  const dist = hyp(ss / 0.19, (h - ch) / (0.86 - 0.06 * left));
  const shoulder = smooth(-e, e, (1 - dist) * 0.19);

  return Math.max(saddle, shoulder);
}

/** Partial sphere shell (outfit pieces: helmet, visor).
 *  phi: π/2 = front (+Z), π = her left (+X). theta: 0 = top. */
function shell(phiStart: number, phiLength: number, thetaStart: number, thetaLength: number): THREE.BufferGeometry {
  return new THREE.SphereGeometry(0.5, 32, 20, phiStart, phiLength, thetaStart, thetaLength);
}

/* ------------------------------------------------------------ part shapes */
/** Ear with a real cup: a crescent cross-section (convex back, concave front
 *  with a soft rim lip) tapering to the tip. Vertex colours: fur on the back
 *  and rim, `inner` in the cup deepening to `deep` at the base. */
function earGeometry(fur: number, inner: number, deep: number): THREE.BufferGeometry {
  const H = 0.07;
  const A = 0.032;
  const B = 0.021;
  const rings = 12;
  const around = 22;
  const pos: number[] = [];
  const col: number[] = [];
  const cFur = new THREE.Color(fur);
  const cIn = new THREE.Color(inner);
  const cDeep = new THREE.Color(deep);
  const c = new THREE.Color();
  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const y = -0.014 + t * (H + 0.014);
    const tt = Math.max(0, (y) / H);
    const a = A * (1 - tt) * (1 + 0.32 * tt) * (y < 0 ? 1.04 : 1);
    const b = B * Math.pow(1 - tt, 0.8);
    const cup = 0.7 * b;
    const lip = 0.3 * b;
    for (let k = 0; k < around; k++) {
      const s = (k / around) * Math.PI * 2;
      const cs = Math.cos(s);
      const sn = Math.sin(s);
      const x = a * cs;
      const z = sn >= 0 ? lip * sn * (1 - sn) * 4 - cup * sn * sn : b * sn;
      pos.push(x, y, z);
      const w = smooth(0.3, 0.62, sn) * (1 - smooth(0.78, 0.95, tt));
      c.copy(cDeep).lerp(cIn, smooth(0.05, 0.55, tt));
      c.lerp(cFur, 1 - w);
      col.push(c.r, c.g, c.b);
    }
  }
  const idx: number[] = [];
  for (let r = 0; r < rings; r++) {
    for (let k = 0; k < around; k++) {
      const a = r * around + k;
      const b = r * around + ((k + 1) % around);
      const cc = (r + 1) * around + k;
      const d = (r + 1) * around + ((k + 1) % around);
      idx.push(a, cc, b, b, cc, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** TubeGeometry along `curve`, radius tapering r0 -> r1. */
function taperedTube(curve: THREE.Curve<THREE.Vector3>, segs: number, radial: number, r0: number, r1: number) {
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const P = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    curve.getPointAt(i / segs, P);
    const r = mix(r0, r1, i / segs);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(P).multiplyScalar(r).add(P);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  return g;
}

/** Rounded-triangle nose, point down, facing +Z. */
function noseGeometry(): THREE.BufferGeometry {
  const w = 0.0105;
  const h = 0.0125;
  const r = 0.0032;
  const s = new THREE.Shape();
  // Top-left, top-right, bottom point, with rounded corners.
  s.moveTo(-w + r, 0);
  s.lineTo(w - r, 0);
  s.quadraticCurveTo(w, 0, w - r * 0.7, -r * 0.8);
  s.lineTo(r * 0.6, -h + r * 0.6);
  s.quadraticCurveTo(0, -h, -r * 0.6, -h + r * 0.6);
  s.lineTo(-w + r * 0.7, -r * 0.8);
  s.quadraticCurveTo(-w, 0, -w + r, 0);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.003,
    bevelEnabled: true,
    bevelThickness: 0.0025,
    bevelSize: 0.0022,
    bevelSegments: 3,
    curveSegments: 4,
  });
  g.translate(0, h * 0.45, -0.0015);
  return g;
}

/* ================================================================ model */
export function createLumiModel(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'lumi';
  const nodes: Record<string, THREE.Object3D> = { root };
  const disposables: { dispose(): void }[] = [];
  const rest: Record<string, THREE.Euler> = {};
  const own = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x);
    return x;
  };

  // Soft vinyl-flock fur: high roughness, cool sheen that lifts the black
  // fur's silhouette on dark skies and softens the white's terminator.
  const furParams: THREE.MeshPhysicalMaterialParameters = {
    roughness: 0.74,
    metalness: 0,
    // A faint, very soft clearcoat: the satin skin of a vinyl collectible.
    clearcoat: 0.16,
    clearcoatRoughness: 0.6,
    sheen: 0.55,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color(0x8e9abb),
  };
  const furMat = (extra: THREE.MeshPhysicalMaterialParameters) =>
    own(new THREE.MeshPhysicalMaterial({ ...furParams, ...extra }));
  const white = furMat({ color: FUR_WHITE });
  const black = furMat({ color: FUR_BLACK });
  const earMat = furMat({ vertexColors: true });

  /* Baked marking textures. */
  const v = new THREE.Vector3();
  const headTex = own(
    bakeTexture(640, 320, (dx, dy, dz, rgb) => {
      const [x, y, z] = headDir(dx, dy, dz);
      headShape(x, y, z, v);
      furMix(rgb, capCoverage(v));
    }, 2),
  );
  const torsoTex = own(
    bakeTexture(768, 384, (dx, dy, dz, rgb) => {
      const [x, y, z] = torsoDir(dx, dy, dz);
      furMix(rgb, coatCoverage(x, y, z));
    }, 4),
  );
  const skullMat = furMat({ map: headTex });
  const torsoMat = furMat({ map: torsoTex });

  const nose = own(
    new THREE.MeshPhysicalMaterial({
      color: NOSE_PINK,
      roughness: 0.42,
      clearcoat: 0.6,
      clearcoatRoughness: 0.35,
    }),
  );
  const liner = own(new THREE.MeshStandardMaterial({ color: LINER, roughness: 0.55 }));
  const mouthMat = own(new THREE.MeshStandardMaterial({ color: MOUTH, roughness: 0.8 }));

  // Eyes: baked iris — gold-green centre to green rim, dark limbal ring,
  // oval pupil, two catchlights. Lit and slightly self-lit so they stay
  // readable on the night sky; clearcoat gives the glassy vinyl-eye pop.
  const IRIS_IN = rgbOf(0xe3d763);
  const IRIS_MID = rgbOf(0xb9c95a);
  const IRIS_OUT = rgbOf(0x6a8a3c);
  const LIMBAL = rgbOf(0x2c3b22);
  const PUPIL = rgbOf(0x0f0e14);
  const DARK = rgbOf(LINER);
  const irisTex = own(
    bakeTexture(384, 192, (dx, dy, dz, rgb) => {
      if (dz <= 0) {
        rgb[0] = DARK[0];
        rgb[1] = DARK[1];
        rgb[2] = DARK[2];
        return;
      }
      const r = hyp(dx, dy) / 0.84;
      const t1 = smooth(0, 0.6, r);
      const t2 = smooth(0.5, 0.95, r);
      const ang = Math.atan2(dy, dx);
      const fibre = 1 + 0.06 * Math.sin(ang * 23) * smooth(0.25, 0.7, r);
      const lid = 1 - 0.3 * smooth(0.15, 0.85, dy / 0.84);
      const limb = smooth(0.84, 0.97, r);
      const out = smooth(0.985, 1.02, r);
      const pupil = smooth(0.98, 1.04, 1 / Math.max(1e-3, hyp(dx / 0.26, dy / 0.52)));
      const cl1 = smooth(0.02, -0.02, hyp(dx - 0.27, dy - 0.33) - 0.15);
      const cl2 = smooth(0.015, -0.015, hyp(dx + 0.24, dy + 0.3) - 0.065);
      for (let c = 0; c < 3; c++) {
        let x = mix(mix(IRIS_IN[c], IRIS_MID[c], t1), IRIS_OUT[c], t2) * fibre * lid;
        x = mix(x, LIMBAL[c], limb);
        x = mix(x, DARK[c], out);
        x = mix(x, PUPIL[c], pupil);
        x = mix(x, 255, Math.max(cl1, cl2 * 0.85));
        rgb[c] = Math.max(0, Math.min(255, Math.round(x)));
      }
    }),
  );
  const eyeMat = own(
    new THREE.MeshPhysicalMaterial({
      map: irisTex,
      roughness: 0.18,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      emissive: 0xffffff,
      emissiveMap: irisTex,
      emissiveIntensity: 0.22,
    }),
  );

  const eyeBall = own(new THREE.SphereGeometry(0.5, 24, 18));
  const sphereLo = own(new THREE.SphereGeometry(0.5, 16, 12));

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
  const group = (name: string, parent: THREE.Object3D, pos: [number, number, number]) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(...pos);
    parent.add(g);
    nodes[name] = g;
    return g;
  };

  /* ------------------------------- body ------------------------------- */
  // Everything forward of the hips hangs off a core group, so she can rock
  // back onto her haunches for the maneki-neko wave. Core sits at the hip.
  const core = group('lumi-core', root, [0, CORE.y, CORE.z]);
  const C = (x: number, y: number, z: number): [number, number, number] => [x, y - CORE.y, z - CORE.z];

  // One continuous torso (chest, waist, haunch, neck rise) so the saddle and
  // shoulder patch are painted across a single surface.
  const torsoGeo = own(shapedSphere(44, 32, torsoShape, torsoDir));
  torsoGeo.translate(0, -CORE.y, -CORE.z);
  add('lumi-body', core, torsoGeo, torsoMat, [0, 0, 0]);

  /* ------------------------------- legs ------------------------------- */
  // Slender tapered legs (thicker at the thigh behind) with rounded paws.
  // Pivots at LEG_Y; paw bottoms touch y=0. Diagonal pairs trot together.
  const legProfile = (top: number) =>
    [
      [0.001, 0.034],
      [top * 0.8, 0.032],
      [top, 0.016],
      [0.0175, -0.012],
      [0.0152, -0.045],
      [0.0138, -0.07],
      [0.0142, -0.084],
      [0.001, -0.086],
    ]
      .reverse() // bottom-to-top so the lathe's normals face outward
      .map(([x, y]) => new THREE.Vector2(x, y * (LEG_Y / 0.1)));
  const frontLegGeo = own(new THREE.LatheGeometry(legProfile(0.02), 12));
  const rearLegGeo = own(new THREE.LatheGeometry(legProfile(0.025), 12));
  const legs: [string, number, number][] = [
    ['lumi-leg-fl', 0.038, 0.07],
    ['lumi-leg-fr', -0.038, 0.07],
    ['lumi-leg-bl', 0.044, -0.118],
    ['lumi-leg-br', -0.044, -0.118],
  ];
  for (const [name, x, z] of legs) {
    // Front legs ride the core (they lift when she sits up); rear legs stay
    // planted on the root.
    const front = name.startsWith('lumi-leg-f');
    const pivot = group(name, front ? core : root, front ? C(x, LEG_Y, z) : [x, LEG_Y, z]);
    add(`${name}-limb`, pivot, front ? frontLegGeo : rearLegGeo, white, [0, 0, 0]);
    add(`${name}-paw`, pivot, sphereLo, white, [0, -LEG_Y + 0.0115, 0.008], {
      scale: [0.034, 0.023, 0.043],
    });
  }

  /* ------------------------------- tail ------------------------------- */
  // Two-joint tail so the tip lags the base into a soft whip. Rises back and
  // up from the rump and curls forward at the tip (a question mark), clear
  // of the head in profile.
  const tailPivot = group('lumi-tail', core, C(0, 0.148, -0.165));
  const tailBase = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0.012),
    new THREE.Vector3(0, 0.006, -0.028),
    new THREE.Vector3(0.002, 0.028, -0.058),
    new THREE.Vector3(0.004, 0.056, -0.072),
  ]);
  add('lumi-tail-mesh', tailPivot, own(taperedTube(tailBase, 14, 10, 0.019, 0.0145)), black, [0, 0, 0]);
  const tailTip = group('lumi-tail-tip', tailPivot, [0.004, 0.056, -0.072]);
  const tipCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.002, 0.03, -0.002),
    new THREE.Vector3(0.005, 0.058, 0.01),
    new THREE.Vector3(0.008, 0.074, 0.032),
  ]);
  add('lumi-tail-joint', tailTip, sphereLo, black, [0, 0, 0], { scale: [0.029, 0.029, 0.029] });
  add('lumi-tail-tipmesh', tailTip, own(taperedTube(tipCurve, 14, 10, 0.0145, 0.009)), black, [0, 0, 0]);
  add('lumi-tail-end', tailTip, sphereLo, black, [0.008, 0.074, 0.032], { scale: [0.018, 0.018, 0.018] });

  /* ------------------------------- head ------------------------------- */
  const headPivot = group('lumi-head', core, C(0, HEAD.y, HEAD.z));
  headPivot.scale.setScalar(HEAD_SCALE);
  const skullGeo = own(shapedSphere(36, 28, headShape, headDir));
  add('lumi-skull', headPivot, skullGeo, skullMat, [0, 0, 0]);

  // Muzzle: two whisker pads and a small chin, white.
  const probe = new THREE.Group();
  const probeMesh = (geo: THREE.BufferGeometry, pos: [number, number, number], scale?: [number, number, number]) => {
    const m = new THREE.Mesh(geo);
    m.position.set(...pos);
    if (scale) m.scale.set(...scale);
    probe.add(m);
    probe.updateMatrixWorld(true);
  };
  probeMesh(skullGeo, [0, 0, 0]);
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, 0, -1);
  /** Front surface z of the face (skull + muzzle so far) at head-local x,y. */
  const surfZ = (x: number, y: number) => {
    ray.set(new THREE.Vector3(x, y, 0.3), down);
    const hit = ray.intersectObject(probe, true)[0];
    return hit ? hit.point.z : 0;
  };

  const PAD: [number, number, number] = [0.034, 0.027, 0.03];
  for (const sx of [1, -1]) {
    const x = sx * 0.0145;
    const y = -0.027;
    const p: [number, number, number] = [x, y, surfZ(x, y) - 0.008];
    add(`lumi-pad-${sx > 0 ? 'l' : 'r'}`, headPivot, sphereLo, white, p, { scale: PAD });
    probeMesh(sphereLo, p, PAD);
  }
  const CHIN: [number, number, number] = [0.026, 0.018, 0.022];
  {
    const p: [number, number, number] = [0, -0.041, surfZ(0, -0.041) - 0.0085];
    add('lumi-chin', headPivot, sphereLo, white, p, { scale: CHIN });
    probeMesh(sphereLo, p, CHIN);
  }

  // Nose: glossy pink rounded triangle seated on the top of the pads.
  {
    const y = -0.0135;
    const z = surfZ(0, y);
    add('lumi-nose', headPivot, own(noseGeometry()), nose, [0, y, z - 0.0005], { rot: [-0.32, 0, 0] });
  }

  // W-mouth: short philtrum from the nose, curling out over each pad.
  {
    const lift = 0.0006;
    const onFace = (pts: [number, number][]) =>
      new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, surfZ(x, y) + lift)));
    for (const sx of [1, -1]) {
      const curve = onFace([
        [0, -0.02],
        [0, -0.0255],
        [sx * 0.0045, -0.0305],
        [sx * 0.0105, -0.0315],
        [sx * 0.0155, -0.0285],
      ]);
      add(`lumi-mouth-${sx > 0 ? 'l' : 'r'}`, headPivot, own(new THREE.TubeGeometry(curve, 16, 0.00105, 5, false)), mouthMat, [0, 0, 0]);
    }
  }

  // Whiskers: three long white strands per side from the pads, fanning out
  // and drooping slightly. One LineSegments draw.
  {
    const pts: number[] = [];
    const fan: [number, number, number, number][] = [
      // [rootY, rise, length, back]
      [-0.023, 0.16, 0.074, 0.3],
      [-0.0285, 0.02, 0.082, 0.24],
      [-0.034, -0.14, 0.07, 0.2],
    ];
    const seg = 5;
    for (const sx of [1, -1]) {
      for (const [ry, rise, len, back] of fan) {
        const rx = sx * 0.024;
        const rz = surfZ(rx, ry) - 0.002;
        const dir = new THREE.Vector3(sx, rise, -back).normalize();
        let prev: THREE.Vector3 | null = null;
        for (let i = 0; i <= seg; i++) {
          const u = i / seg;
          const q = new THREE.Vector3(rx, ry, rz).addScaledVector(dir, len * u);
          q.y -= 0.012 * u * u;
          if (prev) pts.push(prev.x, prev.y, prev.z, q.x, q.y, q.z);
          prev = q;
        }
      }
    }
    const wg = own(new THREE.BufferGeometry());
    wg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const wm = own(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
    const whiskers = new THREE.LineSegments(wg, wm);
    whiskers.name = 'lumi-whiskers';
    headPivot.add(whiskers);
    nodes['lumi-whiskers'] = whiskers;
  }

  // Eyes: big glossy ellipsoids set into the face, each in a dark liner
  // (upper lid slightly heavier) inside a blink group.
  const EYE: [number, number, number] = [0.04, 0.044, 0.02];
  const EYE_LINER: [number, number, number] = [0.0465, 0.0505, 0.019];
  for (const sx of [1, -1]) {
    const tag = sx > 0 ? 'l' : 'r';
    const x = sx * 0.034;
    const y = 0.008;
    const eye = group(`lumi-eye-${tag}`, headPivot, [x, y, surfZ(x, y) - 0.0075]);
    eye.rotation.set(-0.06, sx * 0.14, 0);
    add(`lumi-eye-${tag}-liner`, eye, sphereLo, liner, [0, 0.0008, -0.0026], { scale: EYE_LINER });
    add(`lumi-eye-${tag}-ball`, eye, eyeBall, eyeMat, [0, 0, 0], { scale: EYE });
  }

  // Ears: tall, splayed slightly outward, cups facing forward-out. Her LEFT
  // (+X) is black with a dusky cup; her right is white with a pink cup.
  const earGeoL = own(earGeometry(FUR_BLACK, EAR_DUSK, 0x3e2f3a));
  const earGeoR = own(earGeometry(FUR_WHITE, EAR_PINK, EAR_PINK_DEEP));
  for (const side of ['l', 'r'] as const) {
    const sx = side === 'l' ? 1 : -1;
    const ear = group(`lumi-ear-${side}`, headPivot, [sx * 0.045, 0.043, -0.01]);
    ear.rotation.set(-0.12, sx * 0.34, -sx * 0.27);
    rest[`lumi-ear-${side}`] = ear.rotation.clone();
    add(`lumi-ear-${side}-shell`, ear, side === 'l' ? earGeoL : earGeoR, earMat, [0, 0, 0]);
  }

  const runtime: LumiRuntime = { nodes, disposables, rest };
  root.userData.lumiRuntime = runtime;
  return root;
}

/** Frees everything createLumiModel and applyLumiOutfit allocated. */
export function disposeLumiModel(model: THREE.Object3D): void {
  const prev = model.userData.__lumiOutfit as LumiResources | undefined;
  if (prev) {
    prev.extras.forEach((o) => o.parent?.remove(o));
    prev.geos.forEach((g) => g.dispose());
    prev.mats.forEach((m) => m.dispose());
    model.userData.__lumiOutfit = undefined;
  }
  const runtime = model.userData.lumiRuntime as LumiRuntime | undefined;
  runtime?.disposables.forEach((d) => d.dispose());
}

/* ------------------------------------------------------------------ outfits */
/**
 * applyLumiOutfit — Lumi wears kit matching whatever Levi is wearing.
 * Accessories attach to her rig nodes so they follow the head / body as she
 * trots, sits and waves. Resources are disposed on every swap.
 *
 * Head pieces live in head-local design space (HEAD semi-axes, before the
 * HEAD_SCALE pivot scale). Body pieces are fitted with onTorso(), which
 * samples the torso's own shape function, so they track any body change.
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
    res.geos.push(geo); // registered first so it is disposed even if unused
    if (!parent) return;
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(...pos);
    if (opts.rot) mesh.rotation.set(...opts.rot);
    if (opts.scale) mesh.scale.set(...opts.scale);
    mesh.castShadow = true;
    parent.add(mesh);
    res.extras.push(mesh);
  };

  const head = nodes['lumi-head'];
  const core = nodes['lumi-core'];
  /** Root space -> core space (everything rides the core so it follows the
   *  sit-wave rock). */
  const K = (p: THREE.Vector3): [number, number, number] => [p.x, p.y - CORE.y, p.z - CORE.z];
  /** Point on the torso surface (inflated by k) at body station s and angle
   *  a around the body axis (0 = her left, π/2 = spine, π = her right). */
  const onTorso = (s: number, a: number, k = 1) => {
    const q = Math.sqrt(Math.max(0, 1 - s * s));
    const p = new THREE.Vector3();
    const axis = new THREE.Vector3();
    torsoShape(Math.cos(a) * q, Math.sin(a) * q, s, p);
    torsoShape(0, 0, s, axis);
    return p.sub(axis).multiplyScalar(k).add(axis);
  };
  // Neck collar, root space. The head overhangs the chest, so the ring is
  // tilted to the neck axis (chest -> head) and is an ellipse wider than it
  // is deep, sitting just proud of the fur where head and chest meet.
  const COLLAR = { y: 0.15, z: 0.13, rx: 0.061, ry: 0.055, tilt: -0.5 };
  const collarAt = (ang: number, out = 0): [number, number, number] => {
    // ang 0 = her left, -π/2 = throat (front-bottom of the ring).
    const lx = Math.cos(ang) * (COLLAR.rx + out);
    const ly = Math.sin(ang) * (COLLAR.ry + out);
    const v = new THREE.Vector3(lx, ly, 0).applyEuler(new THREE.Euler(COLLAR.tilt, 0, 0));
    return K(v.add(new THREE.Vector3(0, COLLAR.y, COLLAR.z)));
  };
  // A torus scaled non-uniformly scales its tube too, so the ring is built
  // from a tube swept along the actual ellipse instead.
  const collarRing = (material: THREE.Material, tube: number) => {
    const pts = Array.from({ length: 32 }, (_, i) => {
      const [x, y, z] = collarAt((i / 32) * Math.PI * 2);
      return new THREE.Vector3(x, y, z);
    });
    put(core, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 64, tube, 8, true), material, [0, 0, 0]);
  };

  if (outfit === 'dev') {
    // Tiny headphones to match his: an elliptical band hugging the crown just
    // behind the ear bases, padded cups at the temples with a status LED.
    const cans = mat(0x23252d, 0.45);
    const cansSoft = mat(0x3a3e4c, 0.85);
    const led = glow(0x55e0a0, 1.4);
    const arc = new THREE.EllipseCurve(0, 0, 0.083, 0.074, 0, Math.PI, false, 0);
    const band = new THREE.CatmullRomCurve3(arc.getPoints(24).map((p) => new THREE.Vector3(p.x, p.y, 0)));
    put(head, new THREE.TubeGeometry(band, 40, 0.0072, 8, false), cans, [0, 0.006, -0.036]);
    for (const sx of [1, -1]) {
      put(head, new THREE.CylinderGeometry(0.025, 0.027, 0.017, 20), cans, [sx * 0.088, 0.004, -0.034], {
        rot: [0, 0, Math.PI / 2],
      });
      put(head, new THREE.CylinderGeometry(0.021, 0.021, 0.008, 20), cansSoft, [sx * 0.079, 0.004, -0.034], {
        rot: [0, 0, Math.PI / 2],
      });
      put(head, new THREE.SphereGeometry(0.0042, 10, 8), led, [sx * 0.097, 0.012, -0.026]);
    }
  }

  if (outfit === 'suit') {
    // Navy collar with a red bow tie at the throat — a necktie hangs where
    // her chin hides it, a bow tie reads from every angle.
    const navy = mat(0x22304f, 0.6);
    const tie = mat(0xb0283b, 0.45);
    const knot = mat(0x8e1d2e, 0.5);
    collarRing(navy, 0.0078);
    const [bx, by, bz] = collarAt(-Math.PI / 2, 0.008);
    const tilt = COLLAR.tilt + Math.PI / 2 - 0.15;
    for (const sx of [1, -1]) {
      // Wings: flattened pyramids pointing in at the knot.
      put(core, new THREE.ConeGeometry(0.012, 0.022, 4), tie, [bx + sx * 0.0115, by, bz], {
        rot: [tilt, 0, (sx * Math.PI) / 2],
        scale: [1, 1, 0.45],
      });
    }
    put(core, new THREE.SphereGeometry(0.0062, 12, 10), knot, [bx, by, bz + 0.002], { scale: [1, 1.1, 0.8] });
  }

  if (outfit === 'tactical') {
    // Plate-carrier vest: a band conforming to her actual torso (the torso's
    // own shape function, inflated), webbing at both edges, a pouch on each
    // flank, a MOLLE block on the spine and an amber IFF strobe.
    const vest = mat(0x3d4532, 0.92, { side: THREE.DoubleSide });
    const webbing = mat(0x2c3224, 0.95);
    const pouch = mat(0x8a7350, 0.9);
    const amber = glow(0xffab3d, 1.1);
    const s0 = 0.0;
    const s1 = 0.46;
    const band = new THREE.SphereGeometry(0.5, 40, 10, 0, Math.PI * 2, Math.acos(s1), Math.acos(s0) - Math.acos(s1));
    const bp = band.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    const axis = new THREE.Vector3();
    for (let i = 0; i < bp.count; i++) {
      v.fromBufferAttribute(bp, i).multiplyScalar(2);
      const [dx, dy, dz] = torsoDir(v.x, v.y, v.z);
      torsoShape(dx, dy, dz, v);
      torsoShape(0, 0, dz, axis);
      v.sub(axis).multiplyScalar(1.05).add(axis);
      bp.setXYZ(i, v.x, v.y - CORE.y, v.z - CORE.z);
    }
    weldNormals(band);
    put(core, band, vest, [0, 0, 0]);
    for (const sEdge of [s0 + 0.025, s1 - 0.025]) {
      const pts = Array.from({ length: 28 }, (_, i) => new THREE.Vector3(...K(onTorso(sEdge, (i / 28) * Math.PI * 2, 1.065))));
      put(core, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 56, 0.0032, 6, true), webbing, [0, 0, 0]);
    }
    for (const a of [0.3, Math.PI - 0.3]) {
      put(core, new THREE.BoxGeometry(0.03, 0.012, 0.034), pouch, K(onTorso(0.22, a, 1.1)), {
        rot: [0, 0, a - Math.PI / 2],
      });
    }
    put(core, new THREE.BoxGeometry(0.045, 0.012, 0.05), webbing, K(onTorso(0.22, Math.PI / 2, 1.09)));
    put(core, new THREE.SphereGeometry(0.0065, 10, 8), amber, K(onTorso(0.4, Math.PI / 2, 1.13)));

    // Combat helmet. Her ears pierce the shell, which reads as ear holes —
    // exactly what a cat helmet needs. The backward tilt lifts the front edge
    // to about y=0.05, safely above her brows and eyes.
    const helmet = mat(0x4a5138, 0.85);
    const helmetDark = mat(0x33382a, 0.8);
    put(head, shell(0, Math.PI * 2, 0, 1.08), helmet, [0, 0.004, -0.008], {
      scale: [0.17, 0.158, 0.162],
      rot: [-0.24, 0, 0],
    });
    put(head, shell(0, Math.PI * 2, 1.02, 0.08), helmetDark, [0, 0.004, -0.008], {
      scale: [0.174, 0.162, 0.166],
      rot: [-0.24, 0, 0],
    });
    // NVG mount on the brow of the shell.
    put(head, new THREE.BoxGeometry(0.028, 0.02, 0.014), helmetDark, [0, 0.054, 0.066], {
      rot: [-0.55, 0, 0],
    });
    put(head, new THREE.BoxGeometry(0.02, 0.01, 0.012), mat(0x17181a, 0.6), [0, 0.066, 0.068], {
      rot: [-0.55, 0, 0],
    });
  }

  if (outfit === 'cyber') {
    // Glowing collar with a tag, her own neural halo, and wraparound shades.
    const cyan = glow(0x2fd8f5, 1.2);
    const magenta = glow(0xe23fc4, 1.1);
    collarRing(cyan, 0.0055);
    put(core, new THREE.OctahedronGeometry(0.009), magenta, collarAt(-Math.PI / 2, 0.012), {
      scale: [1, 1.25, 0.6],
      rot: [COLLAR.tilt + Math.PI / 2, 0, 0],
    });
    put(head, new THREE.TorusGeometry(0.05, 0.0045, 10, 36), cyan, [0, 0.13, -0.02], {
      rot: [Math.PI / 2 - 0.22, 0, 0],
    });

    // Shades: a curved visor band on the eye line (eyes at head-local y≈0.008,
    // theta ≈ 1.41 from the crown), wrapping ±1 rad so it covers both eyes,
    // just proud of the eye fronts.
    const lens = mat(0x0d1a24, 0.18, {
      metalness: 0.5,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.72,
    });
    const rim = glow(0x2fd8f5, 1.0);
    put(head, shell(Math.PI / 2 - 1.0, 2.0, 1.24, 0.3), lens, [0, 0, 0], {
      scale: [0.168, 0.152, 0.152],
    });
    put(head, shell(Math.PI / 2 - 1.0, 2.0, 1.2, 0.05), rim, [0, 0, 0], {
      scale: [0.171, 0.155, 0.155],
    });
    const arm = mat(0x1c1e2a, 0.4, { metalness: 0.6 });
    for (const sx of [1, -1]) {
      put(head, new THREE.BoxGeometry(0.045, 0.007, 0.005), arm, [sx * 0.081, 0.016, 0.012], {
        rot: [0, sx * (Math.PI / 2 - 0.2), 0],
      });
    }
  }
}

/* --------------------------------------------------------------- animation */
export interface LumiAnimState {
  /** Walk blend 0..1. */
  amp: number;
  /** Wave blend 0..1. */
  waveAmp: number;
  /** Character stride phase (radians); Lumi trots at 1.55x his cadence. */
  phase: number;
  /** Elapsed seconds. */
  t: number;
}

/** 0..1..0 pulse of `dur` seconds, once every `period` seconds. */
const pulse = (t: number, period: number, offset: number, dur: number) => {
  const p = (((t + offset) % period) + period) % period;
  return p < dur ? Math.sin((p / dur) * Math.PI) : 0;
};

/** Poses Lumi for one frame: diagonal trot with body bob, two-joint tail
 *  sway, idle look-around with head tilt, ear flicks, blinks, and the
 *  sitting maneki-neko wave. Cheap: a handful of rotations, no allocation. */
export function animateLumi(lumi: THREE.Object3D, s: LumiAnimState): void {
  const runtime = lumi.userData.lumiRuntime as LumiRuntime | undefined;
  if (!runtime) return;
  const n = runtime.nodes;
  const { t } = s;
  const catPhase = s.phase * 1.55;
  const w = s.waveAmp;
  const walk = s.amp * (1 - w);
  const idle = 1 - s.amp;
  const trot = Math.sin(catPhase) * walk;

  // Waving: she keeps all-but-one paw planted and lifts the near front paw.
  // (A full sit needs a supporting-contact solve — pitching the core further
  // tips her off the ground.) A faint pitch rocks with each trot step.
  const core = n['lumi-core'];
  if (core) core.rotation.x = -0.1 * w + Math.sin(catPhase * 2) * 0.018 * walk;
  // -2.45 lifts the leg up past horizontal; the outward z-swing carries the
  // paw out beside her cheek, where it reads against the sky instead of
  // vanishing into her white chest.
  const wavePaw = -2.45 + Math.sin(t * 7.5) * 0.32;
  const fl = n['lumi-leg-fl'];
  const fr = n['lumi-leg-fr'];
  const bl = n['lumi-leg-bl'];
  const br = n['lumi-leg-br'];
  // Diagonal pairs: front-left with back-right, front-right with back-left.
  // Legs swing a little further forward than back (reach, then push).
  const reach = (x: number) => (x > 0 ? x * 0.72 : x * 0.55);
  if (fl) {
    fl.rotation.x = reach(trot) * (1 - w) + wavePaw * w;
    fl.rotation.z = 0.78 * w;
  }
  if (fr) fr.rotation.x = reach(-trot) + 0.1 * w;
  if (bl) bl.rotation.x = reach(-trot);
  if (br) br.rotation.x = reach(trot);
  // Two footfalls per stride cycle -> bob at twice the leg frequency. Only
  // written while trotting, so the site's celebrate hop (a gsap tween on the
  // same position.y) isn't overwritten every frame while she stands.
  if (walk > 1e-3) lumi.position.y = walk * Math.abs(Math.sin(catPhase)) * 0.014;

  const tail = n['lumi-tail'];
  const tip = n['lumi-tail-tip'];
  if (tail) {
    // Sways with the trot, curls lazily when she's still; the tip lags.
    tail.rotation.z = Math.sin(catPhase * 0.5) * 0.2 * s.amp + Math.sin(t * 1.4) * 0.12;
    tail.rotation.x = Math.sin(t * 0.9) * 0.06 - 0.12 * walk;
  }
  if (tip) {
    tip.rotation.z = Math.sin(catPhase * 0.5 - 0.9) * 0.3 * s.amp + Math.sin(t * 1.4 - 0.8) * 0.2;
    tip.rotation.x = Math.sin(t * 0.9 - 0.6) * 0.1;
  }

  const head = n['lumi-head'];
  if (head) {
    // Looks up at him now and then while idle (with a curious tilt), and up
    // at the viewer while she waves; a small counter-nod while trotting.
    head.rotation.y = Math.sin(t * 0.6) * 0.28 * idle * (1 - w);
    head.rotation.x =
      -0.12 * idle + Math.sin(t * 2.3) * 0.02 + 0.22 * w - Math.sin(catPhase * 2) * 0.03 * walk;
    head.rotation.z = Math.sin(t * 0.45 + 0.7) * 0.09 * idle * (1 - w) + 0.08 * w;
  }

  // Ear flicks: the white ear twitches every ~5s, the black one less often.
  for (const [key, period, offset, sign] of [
    ['lumi-ear-r', 5.3, 0, -1],
    ['lumi-ear-l', 7.9, 3.1, 1],
  ] as const) {
    const ear = n[key];
    const r0 = runtime.rest[key];
    if (!ear || !r0) continue;
    const f = pulse(t, period, offset, 0.22);
    ear.rotation.set(r0.x - 0.25 * f, r0.y + sign * 0.35 * f, r0.z + sign * 0.18 * f);
  }

  // Blink: a quick close every ~4s, with a double blink every third.
  const blink = Math.max(pulse(t, 3.9, 0.4, 0.16), pulse(t, 11.7, 0.66, 0.16));
  // Squashing the eye alone reads as a squint (a green strip); near the
  // closed point the glassy ball hides so the squashed liner reads as a lid.
  for (const key of ['lumi-eye-l', 'lumi-eye-r']) {
    const eye = n[key];
    if (eye) eye.scale.y = 1 - 0.86 * blink;
    const ball = n[`${key}-ball`];
    if (ball) ball.visible = blink < 0.55;
  }
}
