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
 * Pass 8 (designer-vinyl finish):
 *   - Lathe-profiled torso / pelvis / limbs (one smooth silhouette, no waist ring).
 *   - Head is a deformed ellipsoid (soft oval jaw, full cheeks); the face is
 *     "tampo printed" like a vinyl collectible: small CanvasTexture decals
 *     conformed to the head surface (almond eyes, brows, mouth, blush).
 *   - Hair is a sculpted mass of overlapping tapered locks swept up and back,
 *     side part on his right (-X), wavy forelock on his right forehead.
 *   - Exported surface helpers (torso / head) let outfits conform panels.
 *
 * Deterministic: no randomness anywhere (every lock is listed by hand).
 * Call disposeLeviChibiModel(root) on teardown (frees base + outfit resources).
 */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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
const W = (y: number): number => y - NECK_PIVOT_Y; // world-y -> neck-local-y

/* ------------------------------------------------------- body surface math */
/** Torso cross-sections are ellipses: depth = TORSO_DEPTH * half-width. */
export const TORSO_DEPTH = 0.8;

/** Jacket / hoodie / shirt torso profile as [halfWidth, y] (A-line chibi bell:
 * narrow rounded shoulders, a soft chest, a slight flare at the hem). */
const TORSO_PROFILE: [number, number][] = [
  [0.0, 0.292],
  [0.1, 0.294],
  [0.121, 0.302],
  [0.125, 0.33],
  [0.123, 0.4],
  [0.123, 0.46],
  [0.126, 0.515],
  [0.122, 0.555],
  [0.114, 0.59],
  [0.088, 0.616],
  [0.05, 0.632],
  [0.0, 0.637],
];
/** Trouser seat: tucked inside the jacket hem, rounds into the crotch. */
const PELVIS_PROFILE: [number, number][] = [
  [0.0, 0.218],
  [0.05, 0.222],
  [0.086, 0.238],
  [0.106, 0.266],
  [0.114, 0.305],
  [0.112, 0.36],
  [0.0, 0.366],
];
/** Leg (hip-pivot local y): full thigh tapering to a slim ankle. */
const LEG_PROFILE: [number, number][] = [
  [0.0, 0.032],
  [0.038, 0.026],
  [0.052, 0.002],
  [0.05, -0.08],
  [0.046, -0.17],
  [0.042, -0.236],
  [0.041, -0.262],
  [0.0, -0.268],
];
/** Sleeve (shoulder-pivot local, along the arm axis): round cap = shoulder. */
const ARM_PROFILE: [number, number][] = [
  [0.0, 0.034],
  [0.03, 0.028],
  [0.046, 0.004],
  [0.046, -0.03],
  [0.043, -0.1],
  [0.039, -0.16],
  [0.038, -0.183],
  [0.0, -0.19],
];
/** Arm splay (rad) and the local offset/scale of the hand, shared with outfits. */
export const ARM_SPLAY = 0.15;
export const ARM_LENGTH = 0.19;

function sampleProfile(points: [number, number][], n: number): THREE.Vector2[] {
  const curve = new THREE.SplineCurve(points.map(([r, y]) => new THREE.Vector2(r, y)));
  return curve.getPoints(n).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
}

const TORSO_SAMPLES = sampleProfile(TORSO_PROFILE, 120);

/** Torso half-width (x) at world height y (0 outside the profile). */
export function torsoHalfWidth(y: number): number {
  const s = TORSO_SAMPLES;
  if (y <= s[0].y || y >= s[s.length - 1].y) return 0;
  for (let i = 1; i < s.length; i += 1) {
    if (s[i].y >= y) {
      const a = s[i - 1];
      const b = s[i];
      const t = (y - a.y) / Math.max(1e-6, b.y - a.y);
      return a.x + (b.x - a.x) * t;
    }
  }
  return 0;
}

/** Front-surface z of the torso at (x, y) (mirror with a minus for the back). */
export function torsoFrontZ(x: number, y: number): number {
  const hw = torsoHalfWidth(y);
  if (Math.abs(x) >= hw) return 0;
  return TORSO_DEPTH * Math.sqrt(hw * hw - x * x);
}

/** Bend a flat front-facing panel (built in torso x/y, thickness around z=0)
 * onto the torso surface. side=-1 conforms to the back. */
export function conformToTorso(geo: THREE.BufferGeometry, offset: number, side: 1 | -1 = 1): THREE.BufferGeometry {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, side * (torsoFrontZ(x, y) + offset) + pos.getZ(i));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** A band of the torso surface (lathe slice) inflated by `inflate`: vests,
 * waistbands, chest plates. phi 0 = front (+Z), +PI/2 = character-left (+X). */
export function torsoShellGeometry(
  y0: number,
  y1: number,
  inflate: number,
  phiStart = 0,
  phiLength = Math.PI * 2,
  segments = 36,
): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const n = 14;
  for (let i = 0; i <= n; i += 1) {
    const y = y0 + ((y1 - y0) * i) / n;
    pts.push(new THREE.Vector2(torsoHalfWidth(y) + inflate, y));
  }
  const geo = new THREE.LatheGeometry(pts, segments, phiStart, phiLength);
  geo.scale(1, 1, TORSO_DEPTH);
  geo.computeVertexNormals();
  return geo;
}

/* Head: deformed ellipsoid in neck-pivot space. */
export const HEAD_CENTER = new THREE.Vector3(0, W(0.8), 0.005);
export const HEAD_AXES = new THREE.Vector3(0.175, 0.165, 0.16);

/** Head surface point for a unit direction n (relative to HEAD_CENTER),
 * pushed out along the surface normal by `inflate`. */
export function headShape(n: THREE.Vector3, inflate = 0, out = new THREE.Vector3()): THREE.Vector3 {
  let x = n.x * HEAD_AXES.x;
  let y = n.y * HEAD_AXES.y;
  let z = n.z * HEAD_AXES.z;
  if (n.y < 0) {
    // Soft oval jaw: narrows and tucks toward the chin.
    const t = n.y * n.y;
    x *= 1 - 0.15 * t;
    z *= 1 - 0.06 * t;
    y *= 1 - 0.04 * t;
  }
  // Full chibi cheeks: a gentle push on the lower-front sides of the face.
  const cheek = Math.max(0, n.z) * Math.exp(-((n.y + 0.32) ** 2) / 0.05) * Math.min(1, Math.abs(n.x) * 2.2);
  x *= 1 + 0.045 * cheek;
  z *= 1 + 0.02 * cheek;
  // Slightly fuller cranium at the back (hidden by hair, keeps the hair round).
  if (n.z < 0 && n.y > -0.2) z *= 1 + 0.05 * -n.z;
  out.set(x, y, z);
  if (inflate !== 0) {
    const nx = x / (HEAD_AXES.x * HEAD_AXES.x);
    const ny = y / (HEAD_AXES.y * HEAD_AXES.y);
    const nz = z / (HEAD_AXES.z * HEAD_AXES.z);
    const l = Math.hypot(nx, ny, nz) || 1;
    out.x += (nx / l) * inflate;
    out.y += (ny / l) * inflate;
    out.z += (nz / l) * inflate;
  }
  return out;
}

/** Partial-sphere shell hugging the head (SphereGeometry phi/theta convention:
 * phi PI/2 = front, PI = character-left). Positioned at HEAD_CENTER. */
export function headShellGeometry(
  phiStart: number,
  phiLength: number,
  thetaStart: number,
  thetaLength: number,
  inflate: number,
): THREE.BufferGeometry {
  // Tessellation follows the angular size (~3.5 deg per quad), so thin
  // panel-line slivers stay cheap.
  const seg = (a: number) => Math.max(1, Math.round(a / 0.06));
  const geo = new THREE.SphereGeometry(1, seg(phiLength), seg(thetaLength), phiStart, phiLength, thetaStart, thetaLength);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i).normalize();
    headShape(v, inflate, v);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Point on the front of the head under face-plane (x, y) (relative to the
 * head center), i.e. a z-projection like a tampo print. */
export function headFrontPoint(x: number, y: number, inflate = 0, out = new THREE.Vector3()): THREE.Vector3 {
  const nx = x / HEAD_AXES.x;
  const ny = y / HEAD_AXES.y;
  const nz = Math.sqrt(Math.max(0.0025, 1 - nx * nx - ny * ny));
  const n = new THREE.Vector3(nx, ny, nz).normalize();
  return headShape(n, inflate, out);
}

/* --------------------------------------------------------------- materials */
type Mats = Record<string, THREE.Material>;

function buildMaterials(clay: boolean): Mats {
  if (clay) {
    const clayMat = new THREE.MeshStandardMaterial({
      color: 0x8e8e93,
      roughness: 0.9,
      metalness: 0,
    });
    return new Proxy({ clay: clayMat }, { get: (target) => target.clay }) as unknown as Mats;
  }
  const phys = (color: number, roughness: number, extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
    new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 0, ...extra });
  /** Brushed cloth: matte with a soft fabric sheen at grazing angles. */
  const cloth = (color: number, roughness = 0.86, sheenColor = 0x9aa0ad) =>
    phys(color, roughness, { sheen: 0.35, sheenRoughness: 0.75, sheenColor: new THREE.Color(sheenColor) });
  return {
    // Vinyl skin: warm albedo, soft peach sheen and a whisper of warm emissive
    // so the shadow side never goes grey (a cheap stand-in for subsurface).
    skin: phys(0xedbf9f, 0.52, {
      sheen: 0.45,
      sheenRoughness: 0.55,
      sheenColor: new THREE.Color(0xffb59a),
      emissive: new THREE.Color(0xff8a66),
      emissiveIntensity: 0.035,
      clearcoat: 0.08,
      clearcoatRoughness: 0.6,
    }),
    hair: phys(0x221913, 0.42, {
      vertexColors: true,
      sheen: 0.5,
      sheenRoughness: 0.4,
      sheenColor: new THREE.Color(0x6e5240),
      clearcoat: 0.12,
      clearcoatRoughness: 0.5,
    }),
    'jacket-wool': cloth(0x1b1c21, 0.86, 0x555a66),
    'lapel-satin': phys(0x2b2d33, 0.34, { clearcoat: 0.25, clearcoatRoughness: 0.35 }),
    'shirt-cotton': cloth(0xf2ece2, 0.75, 0xffffff),
    'bowtie-satin': phys(0x222329, 0.32, { clearcoat: 0.45, clearcoatRoughness: 0.3 }),
    'trouser-wool': cloth(0x18191d, 0.84, 0x4a4f5a),
    'shoe-leather': phys(0x141417, 0.38, { clearcoat: 0.7, clearcoatRoughness: 0.22 }),
    'sole-rubber': phys(0x0d0d0f, 0.8),
    button: phys(0x0f0f12, 0.3, { clearcoat: 0.6 }),
  };
}

/* ------------------------------------------------------ face print textures */
// The face is printed, vinyl-collectible style: crisp shapes that stay legible
// at ~190px on the site. All drawn deterministically in 2D.
function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d') as CanvasRenderingContext2D];
}

function toTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

const EYE_TEX = 256;
/** World size of the square eye decal patch. */
const EYE_PATCH = 0.1;

/** One eye, as seen from the front. outer=+1 puts the outer corner on the
 * canvas right (character-left eye). Returns [albedo, emissive] canvases. */
function drawEye(outer: 1 | -1): [HTMLCanvasElement, HTMLCanvasElement] {
  const S = EYE_TEX;
  const [c, g] = canvas(S, S);
  const [ce, ge] = canvas(S, S);
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, S, S);
  const k = S / EYE_PATCH; // px per world unit
  const ew = 0.072 * k; // eye width
  const eh = 0.06 * k; // eye height
  const cx = S / 2;
  const cy = S / 2 + 6;
  const X = (u: number) => cx + outer * u * ew * 0.5; // u in [-1 inner, +1 outer]
  const Y = (v: number) => cy + v * eh * 0.5; // v in [-1 top, +1 bottom]

  // Almond: calm, fairly flat upper lid, rounder lower lid, outer corner a
  // touch higher than the inner one.
  const almond = (ctx: CanvasRenderingContext2D) => {
    ctx.beginPath();
    ctx.moveTo(X(-1), Y(0.2));
    ctx.bezierCurveTo(X(-0.7), Y(-1.05), X(0.55), Y(-1.12), X(1), Y(-0.12));
    ctx.bezierCurveTo(X(0.82), Y(0.92), X(-0.55), Y(1.08), X(-1), Y(0.2));
    ctx.closePath();
  };

  // Sclera + iris, clipped to the almond.
  g.save();
  almond(g);
  g.clip();
  g.fillStyle = '#fbf6f0';
  g.fillRect(0, 0, S, S);
  const ix = cx + outer * 0.02 * ew;
  const iy = cy + eh * 0.06;
  const ir = eh * 0.47;
  const iris = g.createRadialGradient(ix, iy + ir * 0.45, ir * 0.1, ix, iy, ir);
  iris.addColorStop(0, '#9a6440');
  iris.addColorStop(0.45, '#6a3e24');
  iris.addColorStop(0.85, '#3a2013');
  iris.addColorStop(1, '#1f110a');
  g.fillStyle = iris;
  g.beginPath();
  g.ellipse(ix, iy, ir * 0.96, ir, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#140b07';
  g.beginPath();
  g.ellipse(ix, iy - ir * 0.04, ir * 0.44, ir * 0.48, 0, 0, Math.PI * 2);
  g.fill();
  // Shadow cast by the upper lid onto the eyeball.
  const lid = g.createLinearGradient(0, Y(-1), 0, Y(-0.05));
  lid.addColorStop(0, 'rgba(30,14,8,0.75)');
  lid.addColorStop(1, 'rgba(30,14,8,0)');
  g.fillStyle = lid;
  g.fillRect(0, 0, S, S);
  g.restore();

  // Upper lash mass: heavier toward the outer corner with a small flick.
  g.fillStyle = '#1b110b';
  g.beginPath();
  g.moveTo(X(-1.04), Y(0.24));
  g.bezierCurveTo(X(-0.72), Y(-1.08), X(0.55), Y(-1.15), X(1.02), Y(-0.14));
  g.lineTo(X(1.2), Y(-0.36)); // flick
  g.bezierCurveTo(X(1.12), Y(-0.48), X(1.06), Y(-0.6), X(0.96), Y(-0.62));
  g.bezierCurveTo(X(0.55), Y(-1.42), X(-0.75), Y(-1.32), X(-1.04), Y(0.24));
  g.closePath();
  g.fill();
  // Soft lower lid line (outer two thirds only, warm and light).
  g.strokeStyle = 'rgba(122,72,56,0.55)';
  g.lineWidth = 3.2;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(X(0.95), Y(0.12));
  g.bezierCurveTo(X(0.75), Y(0.98), X(-0.2), Y(1.1), X(-0.45), Y(0.98));
  g.stroke();

  // Two catchlights, same screen side on both eyes (one key light).
  const lights = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ix - ir * 0.36, iy - ir * 0.36, ir * 0.27, ir * 0.25, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(ix + ir * 0.4, iy + ir * 0.42, ir * 0.12, ir * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  lights(g);
  lights(ge);
  return [c, ce];
}

/** Soft straight brow, inner end on the canvas left (u=0). */
function drawBrow(): HTMLCanvasElement {
  const [c, g] = canvas(128, 64);
  g.fillStyle = '#2a1d15';
  g.shadowColor = 'rgba(42,29,21,0.7)';
  g.shadowBlur = 3;
  g.beginPath();
  g.moveTo(10, 42);
  g.bezierCurveTo(6, 28, 16, 20, 32, 20);
  g.bezierCurveTo(62, 18, 92, 19, 118, 28);
  g.bezierCurveTo(112, 36, 94, 37, 72, 38);
  g.bezierCurveTo(48, 40, 26, 46, 10, 42);
  g.closePath();
  g.fill();
  return c;
}

/** Small closed gentle smile with a faint lower-lip hint. */
function drawMouth(): HTMLCanvasElement {
  const [c, g] = canvas(128, 64);
  const lip = g.createRadialGradient(64, 40, 2, 64, 40, 20);
  lip.addColorStop(0, 'rgba(214,120,108,0.28)');
  lip.addColorStop(1, 'rgba(214,120,108,0)');
  g.fillStyle = lip;
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = '#9c5446';
  g.beginPath();
  g.moveTo(34, 26);
  g.quadraticCurveTo(64, 40, 94, 26);
  g.quadraticCurveTo(64, 50, 34, 26);
  g.closePath();
  g.fill();
  // Tiny upturned corners: the "slight smile".
  g.strokeStyle = 'rgba(156,84,70,0.7)';
  g.lineWidth = 2.4;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(35, 28);
  g.lineTo(31, 24);
  g.moveTo(93, 28);
  g.lineTo(97, 24);
  g.stroke();
  return c;
}

function drawBlush(): HTMLCanvasElement {
  const [c, g] = canvas(64, 64);
  const r = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  r.addColorStop(0, 'rgba(255,128,118,0.34)');
  r.addColorStop(0.55, 'rgba(255,128,118,0.16)');
  r.addColorStop(1, 'rgba(255,128,118,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return c;
}

/** Plane patch z-projected onto the face (relative to HEAD_CENTER). */
function faceDecalGeometry(cx: number, cy: number, w: number, h: number, seg: number, mirrorU = false): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(w, h, seg, seg);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    headFrontPoint(cx + pos.getX(i), cy + pos.getY(i), 0.0012, v);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  if (mirrorU) {
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i += 1) uv.setX(i, 1 - uv.getX(i));
  }
  geo.computeVertexNormals();
  return geo;
}

/* ---------------------------------------------------------- hair sculpting */
const HAIR_BASE = 0.017; // cap thickness over the scalp
const DEG = Math.PI / 180;
/** Direction from head center: az around Y from front (+Z) toward +X, el up. */
function dir(az: number, el: number): THREE.Vector3 {
  const a = az * DEG;
  const e = el * DEG;
  return new THREE.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a));
}

function bezierV(ps: THREE.Vector3[], t: number): THREE.Vector3 {
  const tmp = ps.map((p) => p.clone());
  for (let k = tmp.length - 1; k > 0; k -= 1) {
    for (let i = 0; i < k; i += 1) tmp[i].lerp(tmp[i + 1], t);
  }
  return tmp[0];
}
function bezierN(ps: number[], t: number): number {
  const tmp = ps.slice();
  for (let k = tmp.length - 1; k > 0; k -= 1) {
    for (let i = 0; i < k; i += 1) tmp[i] += (tmp[i + 1] - tmp[i]) * t;
  }
  return tmp[0];
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Sculpted hair mass thickness above the base: the up-swept front volume
 * (his quiff), a rounded crown and slightly full sides. */
function hairVolume(d: THREE.Vector3): number {
  const el = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)) / DEG;
  const az = Math.atan2(d.x, d.z) / DEG;
  // Rises off the forehead (thin at the hairline, full above it) instead of
  // overhanging it like a bowl cut.
  const front = 0.046 * Math.exp(-(((el - 58) / 22) ** 2)) * Math.exp(-(((az - 8) / 58) ** 2)) * smooth(16, 42, el);
  const top = 0.014 * smooth(0, 0.9, d.y);
  const side = 0.007 * Math.exp(-(((el - 30) / 24) ** 2));
  const back = 0.008 * Math.max(0, -d.z) * smooth(-0.3, 0.4, d.y);
  // Side part on his right: a shallow groove running back from the hairline.
  const partAz = -40 - Math.max(0, el - 25) * 1.1;
  const part = el > 20 && el < 80 ? Math.exp(-(((az - partAz) / 7) ** 2)) : 0;
  return front + top + side + back - 0.008 * part;
}

/** Degrees above the hairline for a direction (negative = bare skin). */
function aboveHairline(d: THREE.Vector3): number {
  const el = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)) / DEG;
  const az = Math.atan2(d.x, d.z) / DEG;
  return el - hairlineEl(az);
}

/** Hair mass thickness: grows out of the scalp over the first ~12 degrees
 * past the hairline (no helmet ledge), full sculpted volume above that. */
function hairThickness(d: THREE.Vector3): number {
  return smooth(-1, 12, aboveHairline(d)) * (HAIR_BASE + hairVolume(d));
}

/** Outer hair surface pushed out by `extra` (bare skin below the hairline). */
function hairOuter(d: THREE.Vector3, extra = 0, out = new THREE.Vector3()): THREE.Vector3 {
  return headShape(d, hairThickness(d) + extra, out);
}

type Lock = {
  /** Control directions as [az, el] degrees (Bezier, sphere space). */
  p: [number, number][];
  /** Radial lift above the hair base, per control point. */
  lift: number[];
  /** Full width / thickness at the fattest point. */
  w: number;
  t: number;
};

/** Sweeps a lens-shaped, tapering cross-section along a lock path that hugs
 * the head. Width lies along the scalp, thickness along the head normal. */
function lockGeometry(lock: Lock, segs = 12, radial = 8): THREE.BufferGeometry {
  const ctrl = lock.p.map(([az, el]) => dir(az, el));
  const pts: THREE.Vector3[] = [];
  const ups: THREE.Vector3[] = [];
  for (let i = 0; i <= segs; i += 1) {
    const t = i / segs;
    const d = bezierV(ctrl, t).normalize();
    const lift = bezierN(lock.lift, t);
    pts.push(hairOuter(d, lift));
    ups.push(headShape(d, 0).normalize());
  }
  const positions: number[] = [];
  const colors: number[] = [];
  const T = new THREE.Vector3();
  const B = new THREE.Vector3();
  const N = new THREE.Vector3();
  for (let i = 0; i <= segs; i += 1) {
    const t = i / segs;
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(segs, i + 1)];
    T.subVectors(b, a).normalize();
    B.crossVectors(T, ups[i]).normalize();
    N.crossVectors(B, T).normalize();
    const grow = 0.35 + 0.65 * smooth(0, 0.32, t);
    const shrink = 1 - Math.pow(Math.max(0, (t - 0.3) / 0.7), 1.7);
    const s = Math.max(0.02, grow * shrink);
    for (let j = 0; j < radial; j += 1) {
      const ang = (j / radial) * Math.PI * 2;
      const cw = Math.cos(ang) * lock.w * 0.5 * s;
      const sn = Math.sin(ang);
      // Lens: domed crest outward, flatter underside against the scalp.
      const ct = (sn > 0 ? Math.pow(sn, 0.8) : sn * 0.45) * lock.t * 0.5 * s;
      positions.push(pts[i].x + B.x * cw + N.x * ct, pts[i].y + B.y * cw + N.y * ct, pts[i].z + B.z * cw + N.z * ct);
      // Vertex shade: lit crest, dark grooves at the lock edges and roots.
      const crest = Math.pow((sn + 1) / 2, 1.3);
      const v = (0.62 + 0.38 * crest) * (0.8 + 0.2 * smooth(0, 0.35, t));
      colors.push(v, v, v);
    }
  }
  const index: number[] = [];
  for (let i = 0; i < segs; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + ((j + 1) % radial);
      index.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** Hairline elevation (deg) around the head: high swept forehead, temples,
 * over the ears, dipping to the nape. */
function hairlineEl(az: number): number {
  const a = Math.abs(((az + 540) % 360) - 180); // 0 front .. 180 back
  const table: [number, number][] = [
    [0, 25],
    [16, 22],
    [34, 22],
    [52, 13],
    [72, 6],
    [95, 12],
    [118, 0],
    [145, -24],
    [180, -36],
  ];
  for (let i = 1; i < table.length; i += 1) {
    if (a <= table[i][0]) {
      const [a0, e0] = table[i - 1];
      const [a1, e1] = table[i];
      return e0 + ((e1 - e0) * (a - a0)) / (a1 - a0);
    }
  }
  return -36;
}

/** Scalp cap: a smooth under-layer that dives under the skin at the hairline. */
function hairCapGeometry(): THREE.BufferGeometry {
  let geo: THREE.BufferGeometry = new THREE.SphereGeometry(1, 36, 24);
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  geo = mergeVertices(geo);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const colors: number[] = [];
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i).normalize();
    // Dives under the skin just below the hairline so the edge is crisp.
    const under = 1 - smooth(-3, 0, aboveHairline(v));
    headShape(v, hairThickness(v) - under * 0.01, v);
    pos.setXYZ(i, v.x, v.y, v.z);
    colors.push(0.58, 0.58, 0.58);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

// Side part on his right (-X, az ~ -38): everything right of it sweeps up,
// back and over toward +X; the short side combs back and down.
// Locks are relief strokes over the sculpted mass (lift is relative to the
// outer hair surface): broad, flat and shingled, tips flicking off the mass.
const QUIFF_LOCKS: Lock[] = [
  { p: [[-30, 23], [-24, 46], [-8, 70], [24, 80]], lift: [-0.016, 0.005, 0.006, 0.012], w: 0.07, t: 0.016 },
  { p: [[-18, 24], [-6, 48], [12, 74], [56, 78]], lift: [-0.016, 0.006, 0.007, 0.014], w: 0.08, t: 0.017 },
  { p: [[-2, 26], [12, 48], [32, 70], [84, 70]], lift: [-0.016, 0.006, 0.007, 0.013], w: 0.078, t: 0.017 },
  { p: [[14, 24], [30, 46], [52, 62], [104, 58]], lift: [-0.016, 0.005, 0.006, 0.012], w: 0.074, t: 0.016 },
  { p: [[30, 24], [48, 40], [72, 48], [118, 42]], lift: [-0.016, 0.004, 0.005, 0.011], w: 0.066, t: 0.015 },
  { p: [[48, 16], [64, 28], [90, 34], [128, 28]], lift: [-0.018, 0.004, 0.004, 0.01], w: 0.06, t: 0.014 },
];
/** The signature loose wavy strand falling onto his right forehead. */
const FORELOCK: Lock = {
  p: [[-8, 44], [-22, 30], [-4, 19], [-16, 11]],
  lift: [0.008, 0.014, 0.011, 0.007],
  w: 0.032,
  t: 0.016,
};
const MAIN_LOCKS: Lock[] = [
  // Short side (his right), combed back from the part.
  { p: [[-44, 18], [-64, 34], [-98, 34], [-134, 18]], lift: [-0.018, 0.004, 0.005, 0.011], w: 0.07, t: 0.016 },
  { p: [[-58, 9], [-80, 17], [-106, 14], [-138, -2]], lift: [-0.016, 0.003, 0.004, 0.01], w: 0.06, t: 0.014 },
  // Long side (his left), swept back over the temple.
  { p: [[62, 9], [84, 22], [112, 20], [142, 4]], lift: [-0.016, 0.004, 0.005, 0.011], w: 0.066, t: 0.015 },
  { p: [[76, 5], [96, 11], [116, 5], [138, -10]], lift: [-0.014, 0.003, 0.004, 0.01], w: 0.054, t: 0.013 },
  // Crown: over the top and down the back.
  { p: [[-25, 80], [-150, 62], [-154, 30], [-150, 2]], lift: [-0.004, 0.006, 0.006, 0.012], w: 0.09, t: 0.017 },
  { p: [[0, 84], [-178, 62], [-178, 30], [-178, -4]], lift: [-0.004, 0.006, 0.006, 0.013], w: 0.094, t: 0.017 },
  { p: [[22, 82], [164, 62], [160, 30], [157, -2]], lift: [-0.004, 0.006, 0.006, 0.012], w: 0.09, t: 0.017 },
  { p: [[48, 72], [130, 56], [128, 28], [124, 2]], lift: [-0.004, 0.005, 0.005, 0.011], w: 0.084, t: 0.016 },
  { p: [[-48, 72], [-126, 56], [-123, 28], [-118, 4]], lift: [-0.004, 0.005, 0.005, 0.011], w: 0.084, t: 0.016 },
  // Nape: pointing down with an outward flick at the tips.
  { p: [[-158, 22], [-161, 4], [-159, -18], [-156, -31]], lift: [-0.004, 0.004, 0.006, 0.016], w: 0.064, t: 0.015 },
  { p: [[180, 22], [180, 4], [180, -20], [180, -35]], lift: [-0.004, 0.004, 0.006, 0.018], w: 0.068, t: 0.015 },
  { p: [[158, 22], [161, 4], [159, -18], [156, -31]], lift: [-0.004, 0.004, 0.006, 0.016], w: 0.064, t: 0.015 },
  // Sideburns in front of the ears (below the hairline: lift is over skin).
  { p: [[-68, 12], [-70, 2], [-69, -7], [-67, -14]], lift: [-0.002, 0.004, 0.004, 0.002], w: 0.026, t: 0.01 },
  { p: [[68, 12], [70, 2], [69, -7], [67, -14]], lift: [-0.002, 0.004, 0.004, 0.002], w: 0.026, t: 0.01 },
];

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

/** Flat extruded panel from an outline in torso x/y (mirrored for sx=-1 with
 * the point order reversed so the winding stays correct). */
export function outlinePanelGeometry(points: [number, number][], sx: 1 | -1, depth: number, bevel = 0): THREE.BufferGeometry {
  const pts = points.map(([x, y]) => new THREE.Vector2(x * sx, y));
  if (sx < 0) pts.reverse();
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/** Peak lapel (character-left), in torso x/y: collar at the neck down to the
 * closure, the peak flaring out and up below the collarbone. */
const LAPEL_OUTLINE: [number, number][] = [
  [0.008, 0.452],
  [0.03, 0.47],
  [0.066, 0.545],
  [0.082, 0.582],
  [0.104, 0.607],
  [0.084, 0.613],
  [0.064, 0.626],
  [0.044, 0.624],
  [0.03, 0.58],
];
/** White shirt V between the lapels. */
const SHIRT_OUTLINE: [number, number][] = [
  [-0.05, 0.628],
  [0.05, 0.628],
  [0.0, 0.448],
];

/** Lathe a [r, y] profile into a body part (elliptical when depth != 1). */
function latheGeometry(profile: [number, number][], samples: number, segments: number, depth = 1): THREE.BufferGeometry {
  const geo = new THREE.LatheGeometry(sampleProfile(profile, samples), segments);
  if (depth !== 1) geo.scale(1, 1, depth);
  return geo;
}

/** Smooth deformed-sphere helper: welds the seam so normals stay continuous. */
function deformedSphere(wSeg: number, hSeg: number, fn: (n: THREE.Vector3) => void): THREE.BufferGeometry {
  let geo: THREE.BufferGeometry = new THREE.SphereGeometry(1, wSeg, hSeg);
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  geo = mergeVertices(geo);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i).normalize();
    fn(v);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Shoe upper: round toe box, slimmer heel, flat underside, slight toe spring. */
function shoeGeometry(): THREE.BufferGeometry {
  return deformedSphere(24, 16, (n) => {
    const toe = Math.max(0, n.z);
    const w = 0.049 * (0.92 + 0.14 * (n.z * 0.5 + 0.5));
    const top = 0.042 * (1 - 0.32 * toe * toe);
    n.set(n.x * w, (n.y > 0 ? n.y * top : n.y * 0.012) + 0.007 * Math.pow(toe, 4), n.z * 0.09);
  });
}

/** Sole: rounded footprint slab with a bevelled edge, toe wider than heel. */
function soleGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < 32; i += 1) {
    const a = (i / 32) * Math.PI * 2;
    const z = Math.cos(a);
    const w = 0.05 * (0.9 + 0.16 * (z * 0.5 + 0.5));
    // Shape-space y maps to -z after the rotation below.
    pts.push(new THREE.Vector2(Math.sin(a) * w, -z * 0.093));
  }
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
    depth: 0.008,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.003,
    bevelSegments: 2,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.004, 0); // bottom of the bevel at y=0
  return geo;
}

/** Mitten hand with a thumb on the front, palm facing the body. */
function handGeometry(sx: 1 | -1): THREE.BufferGeometry {
  const palm = deformedSphere(16, 12, (n) => {
    // Flattened toward the body, rounder at the finger end.
    const bottom = Math.max(0, -n.y);
    n.set(n.x * 0.029 * (1 + 0.08 * bottom), n.y * 0.04, n.z * 0.036 * (1 + 0.06 * bottom));
  });
  const thumb = new THREE.CapsuleGeometry(0.0125, 0.02, 4, 10);
  thumb.deleteAttribute('uv');
  thumb.rotateX(0.5);
  thumb.rotateZ(sx * 0.35);
  thumb.translate(-sx * 0.012, 0.006, 0.026);
  const merged = mergeGeometries([palm, mergeVertices(thumb)]);
  palm.dispose();
  thumb.dispose();
  return merged ?? new THREE.SphereGeometry(0.04, 12, 10);
}

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
  const baseGeos = new Set<THREE.BufferGeometry>();
  const baseMats = new Set<THREE.Material>(clay ? [mats.skin] : Object.values(mats));
  const baseTexs: THREE.Texture[] = [];

  const full = stage === 'full';

  // Shared geometries (each built once, reused left/right).
  const sphereGeoLow = new THREE.SphereGeometry(0.5, 16, 12);

  function addMesh(
    id: string,
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    material: string | THREE.Material,
    pos: [number, number, number],
    opts: {
      rot?: [number, number, number];
      scale?: [number, number, number];
      explodeWithParent?: boolean;
      colliderType?: string;
      shadow?: boolean;
    } = {},
  ): THREE.Mesh {
    const mat = typeof material === 'string' ? mats[material] : material;
    const mesh = new THREE.Mesh(geo, mat);
    baseGeos.add(geo);
    baseMats.add(mat);
    mesh.name = id;
    mesh.position.set(...pos);
    if (opts.rot) mesh.rotation.set(...opts.rot);
    if (opts.scale) mesh.scale.set(...opts.scale);
    mesh.castShadow = castShadow && opts.shadow !== false;
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
  addMesh('pelvis', root, latheGeometry(PELVIS_PROFILE, 16, 28, TORSO_DEPTH), 'trouser-wool', [0, 0, 0]);
  addSocket('socket-hip-l', root, [HIP.x, HIP.y, 0]);
  addSocket('socket-hip-r', root, [-HIP.x, HIP.y, 0]);

  const legGeo = latheGeometry(LEG_PROFILE, 16, 18);
  const shoeGeo = shoeGeometry();
  const soleGeo = soleGeometry();
  for (const side of ['l', 'r'] as const) {
    const sx = side === 'l' ? 1 : -1;
    const hipPivot = new THREE.Group();
    hipPivot.name = `pivot-hip-${side}`;
    hipPivot.position.set(sx * HIP.x, HIP.y, 0);
    root.add(hipPivot);
    nodes[`pivot-hip-${side}`] = hipPivot;

    addMesh(`leg-${side}`, hipPivot, legGeo, 'trouser-wool', [0, 0, 0], { colliderType: 'capsule' });
    // Shoe upper sits on the sole; sole bottom at world y=0 (local -0.30).
    addMesh(`shoe-${side}`, hipPivot, shoeGeo, 'shoe-leather', [sx * 0.002, -0.283, 0.03], {
      rot: [0, sx * -0.06, 0],
    });
    addMesh(`sole-${side}`, hipPivot, soleGeo, 'sole-rubber', [sx * 0.002, -0.3, 0.03], {
      rot: [0, sx * -0.06, 0],
    });
    addSocket(`socket-ankle-${side}`, hipPivot, [0, -0.24, 0]);
  }

  /* ---------------- torso group: jacket + tuxedo details ------------------ */
  const torso = new THREE.Group();
  torso.name = 'torso';
  root.add(torso);
  nodes['torso'] = torso;

  addMesh('torso-jacket', torso, latheGeometry(TORSO_PROFILE, 30, 36, TORSO_DEPTH), 'jacket-wool', [0, 0, 0]);
  addSocket('socket-chest', torso, [0, 0.545, torsoFrontZ(0, 0.545)]);
  addSocket('socket-collar', torso, [0, 0.625, torsoFrontZ(0, 0.625)]);
  addSocket('socket-neck', torso, [0, 0.635, 0.005]);

  if (full) {
    // Satin peak lapels, conformed to the chest so they never float or clip.
    for (const side of ['l', 'r'] as const) {
      const sx = side === 'l' ? 1 : -1;
      const geo = conformToTorso(outlinePanelGeometry(LAPEL_OUTLINE, sx, 0.006, 0.0025), 0.006);
      const lapel = addMesh(`lapel-${side}`, torso, geo, 'lapel-satin', [0, 0, 0], { explodeWithParent: true });
      lapel.userData.partOf = 'torso-jacket';
    }
    addMesh('shirt-triangle', torso, conformToTorso(outlinePanelGeometry(SHIRT_OUTLINE, 1, 0.004), 0.002), 'shirt-cotton', [0, 0, 0], {
      explodeWithParent: true,
    });

    // Butterfly bow tie: a named group of NAMED parts (knot + 2 wings).
    const bowTie = new THREE.Group();
    bowTie.name = 'bow-tie';
    bowTie.position.set(0, 0.612, torsoFrontZ(0, 0.612) + 0.012);
    bowTie.rotation.x = -0.35;
    torso.add(bowTie);
    nodes['bow-tie'] = bowTie;
    const knotGeo = new THREE.SphereGeometry(0.5, 12, 10);
    const knot = new THREE.Mesh(knotGeo, mats['bowtie-satin']);
    baseGeos.add(knotGeo);
    knot.name = 'bowtie-knot';
    knot.scale.set(0.024, 0.022, 0.016);
    knot.position.set(0, 0, 0.004);
    knot.castShadow = castShadow;
    knot.userData.explodeWithParent = true;
    bowTie.add(knot);
    meshes['bowtie-knot'] = knot;
    const wingGeo = taperedBoxGeometry(0.05, 0.036, 0.012, 0.45);
    baseGeos.add(wingGeo);
    for (const sx of [1, -1]) {
      const wing = new THREE.Mesh(wingGeo, mats['bowtie-satin']);
      wing.name = `bowtie-wing-${sx > 0 ? 'l' : 'r'}`;
      wing.scale.x = sx;
      wing.position.set(sx * 0.03, 0, -0.002);
      wing.rotation.z = sx * 0.06;
      wing.castShadow = castShadow;
      wing.userData.explodeWithParent = true;
      bowTie.add(wing);
      meshes[`bowtie-wing-${sx > 0 ? 'l' : 'r'}`] = wing;
    }
    colliders['bow-tie'] = { type: 'box', offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: 'simplified proxy' };

    // Two dark buttons on the double-breasted closure.
    const buttonGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.005, 14);
    buttonGeo.rotateX(Math.PI / 2);
    for (const side of ['l', 'r'] as const) {
      const sx = side === 'l' ? 1 : -1;
      addMesh(`button-${side}`, torso, buttonGeo, 'button', [sx * 0.032, 0.42, torsoFrontZ(sx * 0.032, 0.42) + 0.002], {
        explodeWithParent: true,
      });
    }
  }

  /* ---------------- arms: shoulder pivots + sleeves + mitten hands -------- */
  addSocket('socket-shoulder-l', torso, [SHOULDER.x, SHOULDER.y, 0]);
  addSocket('socket-shoulder-r', torso, [-SHOULDER.x, SHOULDER.y, 0]);
  const armGeo = latheGeometry(ARM_PROFILE, 16, 18);
  for (const side of ['l', 'r'] as const) {
    const sx = side === 'l' ? 1 : -1;
    const shoulderPivot = new THREE.Group();
    shoulderPivot.name = `pivot-shoulder-${side}`;
    shoulderPivot.position.set(sx * SHOULDER.x, SHOULDER.y, 0);
    root.add(shoulderPivot);
    nodes[`pivot-shoulder-${side}`] = shoulderPivot;

    // Sleeve hangs from the pivot, splayed outward so the arm reads clear of
    // the torso silhouette.
    addMesh(`arm-${side}`, shoulderPivot, armGeo, 'jacket-wool', [sx * 0.006, -0.004, 0], {
      rot: [0, 0, sx * ARM_SPLAY],
      colliderType: 'capsule',
    });
    const handGeo = handGeometry(sx);
    addMesh(`hand-${side}`, shoulderPivot, handGeo, 'skin', [sx * 0.04, -0.222, 0.004], {
      rot: [0, 0, sx * ARM_SPLAY * 0.6],
    });
    addSocket(`socket-wrist-${side}`, shoulderPivot, [sx * 0.033, -0.19, 0]);
  }

  /* ---------------- neck pivot: neck + head + hair + face ----------------- */
  const neckPivot = new THREE.Group();
  neckPivot.name = 'pivot-neck';
  neckPivot.position.set(0, NECK_PIVOT_Y, 0);
  root.add(neckPivot);
  nodes['pivot-neck'] = neckPivot;

  addMesh('neck', neckPivot, new THREE.CylinderGeometry(0.036, 0.041, 0.08, 16, 1, true), 'skin', [0, W(0.64), 0.004]);

  const headGroup = new THREE.Group();
  headGroup.name = 'head-group';
  neckPivot.add(headGroup);
  nodes['head-group'] = headGroup;

  const C = HEAD_CENTER;
  addMesh('head', headGroup, deformedSphere(48, 32, (n) => headShape(n, 0, n)), 'skin', [C.x, C.y, C.z]);
  addSocket('socket-skull', headGroup, [0, W(0.9), 0]);

  // Hair: scalp cap + sculpted locks. hair-quiff is hidden under the tactical
  // helmet, so the volume-making front locks live there.
  const lockGeos = (locks: Lock[]) => locks.map((l) => lockGeometry(l));
  const mainParts = full ? [hairCapGeometry(), ...lockGeos(MAIN_LOCKS)] : [hairCapGeometry()];
  const hairMain = mergeGeometries(mainParts) as THREE.BufferGeometry;
  mainParts.forEach((g) => g.dispose());
  addMesh('hair-main', headGroup, hairMain, 'hair', [C.x, C.y, C.z]);
  if (full) {
    const quiffParts = lockGeos(QUIFF_LOCKS);
    const quiff = mergeGeometries(quiffParts) as THREE.BufferGeometry;
    quiffParts.forEach((g) => g.dispose());
    addMesh('hair-quiff', headGroup, quiff, 'hair', [C.x, C.y, C.z], { explodeWithParent: true });
    addMesh('hair-forelock', headGroup, lockGeometry(FORELOCK, 18, 8), 'hair', [C.x, C.y, C.z], {
      explodeWithParent: true,
    });

    // Ears: tucked under the side hair, angled back a touch.
    for (const side of ['l', 'r'] as const) {
      const sx = side === 'l' ? 1 : -1;
      addMesh(`ear-${side}`, headGroup, sphereGeoLow, 'skin', [sx * 0.166, W(0.774), -0.006], {
        rot: [0, sx * 0.5, sx * -0.08],
        scale: [0.028, 0.054, 0.04],
        explodeWithParent: true,
      });
    }

    // Small nose hint: a soft bump that catches the key light.
    const noseP = headFrontPoint(0, W(0.737) - C.y, -0.004);
    addMesh('nose', headGroup, sphereGeoLow, 'skin', [C.x + noseP.x, C.y + noseP.y, C.z + noseP.z], {
      scale: [0.024, 0.02, 0.022],
      explodeWithParent: true,
    });

    if (!clay) {
      /* -------- printed face decals -------- */
      const decal = (
        tex: THREE.Texture,
        extra: Partial<THREE.MeshStandardMaterialParameters> = {},
      ): THREE.MeshStandardMaterial => {
        const m = new THREE.MeshStandardMaterial({
          map: tex,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
          roughness: 0.5,
          metalness: 0,
          ...extra,
        });
        baseMats.add(m);
        return m;
      };
      const tex = (c: HTMLCanvasElement) => {
        const t = toTexture(c);
        baseTexs.push(t);
        return t;
      };

      const EYE_X = 0.07;
      const EYE_Y = W(0.772) - C.y;
      for (const side of ['l', 'r'] as const) {
        const sx = side === 'l' ? 1 : -1;
        const [albedo, glowC] = drawEye(sx);
        const eyeMat = decal(tex(albedo), {
          roughness: 0.22,
          emissive: 0xffffff,
          emissiveMap: tex(glowC),
          emissiveIntensity: 0.55,
        });
        addMesh(`eye-${side}`, headGroup, faceDecalGeometry(sx * EYE_X, EYE_Y, EYE_PATCH, EYE_PATCH, 10), eyeMat, [C.x, C.y, C.z], {
          explodeWithParent: true,
          shadow: false,
        });
      }
      const browMat = decal(tex(drawBrow()), { roughness: 0.7 });
      for (const side of ['l', 'r'] as const) {
        const sx = side === 'l' ? 1 : -1;
        addMesh(
          `brow-${side}`,
          headGroup,
          faceDecalGeometry(sx * 0.07, W(0.84) - C.y, 0.068, 0.036, 6, sx < 0),
          browMat,
          [C.x, C.y, C.z],
          { explodeWithParent: true, shadow: false },
        );
      }
      addMesh('mouth', headGroup, faceDecalGeometry(0, W(0.703) - C.y, 0.058, 0.029, 6), decal(tex(drawMouth()), { roughness: 0.45 }), [C.x, C.y, C.z], {
        explodeWithParent: true,
        shadow: false,
      });
      // Cheeks: soft blush with a slightly glossier finish (lower roughness).
      const blushMat = decal(tex(drawBlush()), { roughness: 0.34 });
      for (const side of ['l', 'r'] as const) {
        const sx = side === 'l' ? 1 : -1;
        addMesh(`blush-${side}`, headGroup, faceDecalGeometry(sx * 0.1, W(0.735) - C.y, 0.06, 0.042, 6), blushMat, [C.x, C.y, C.z], {
          explodeWithParent: true,
          shadow: false,
        });
      }
    }
  }

  /* ------------------------------------------------------------- runtime */
  const runtime: LeviChibiRuntime = {
    nodes,
    meshes,
    sockets,
    colliders,
    destructionGroups: {},
  };
  baseGeos.add(sphereGeoLow);
  root.userData.sculptRuntime = runtime;
  root.userData.sculptStage = stage;
  root.userData.__baseResources = { geos: baseGeos, mats: baseMats, texs: baseTexs };
  root.userData.animationContract = {
    pivots: ['pivot-shoulder-l', 'pivot-shoulder-r', 'pivot-hip-l', 'pivot-hip-r', 'pivot-neck'],
    groundContactY: 0,
    totalHeight: 1.0,
    headUnits: 2.75,
  };
  return root;
}

/** Frees every geometry / material / texture the factory and the current
 * outfit created. Call once on teardown. */
export function disposeLeviChibiModel(root: THREE.Object3D): void {
  type Res = { geos?: Iterable<THREE.BufferGeometry>; mats?: Iterable<THREE.Material>; texs?: Iterable<THREE.Texture> };
  for (const key of ['__outfitResources', '__baseResources']) {
    const r = root.userData[key] as Res | undefined;
    if (!r) continue;
    for (const g of r.geos ?? []) g.dispose();
    for (const m of r.mats ?? []) m.dispose();
    for (const t of r.texs ?? []) t.dispose();
    delete root.userData[key];
  }
}
