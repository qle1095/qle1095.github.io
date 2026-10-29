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
 *
 * Panels (pockets, vest plates, ties, chest plating) are bent onto the body
 * with the factory's surface helpers, so they hug the lathe-profiled torso
 * and the deformed head instead of floating as flat boxes.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  ARM_SPLAY,
  HEAD_CENTER,
  conformToTorso,
  headShellGeometry,
  outlinePanelGeometry,
  torsoFrontZ,
  torsoShellGeometry,
  type LeviChibiRuntime,
} from './createLeviChibiModel';

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

/** Point on the sleeve axis, `d` down from the shoulder pivot (pivot-local). */
function armPoint(sx: number, d: number): [number, number] {
  return [sx * (0.006 + Math.sin(ARM_SPLAY) * d), -0.004 - Math.cos(ARM_SPLAY) * d];
}
/** Sleeve radius `d` down the arm (matches ARM_PROFILE). */
function armRadius(d: number): number {
  return d <= 0.03 ? 0.046 : 0.046 - (d - 0.03) * 0.05;
}

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
  const phys = (
    color: number,
    roughness: number,
    extra: Partial<THREE.MeshPhysicalMaterialParameters> = {},
  ) => {
    const m = new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 0, ...extra });
    res.mats.push(m);
    return m;
  };
  /** Matte fabric with a soft grazing-angle sheen (the vinyl-figure "flock"). */
  const cloth = (color: number, roughness = 0.88, sheen = 0.35) =>
    phys(color, roughness, {
      sheen,
      sheenRoughness: 0.7,
      sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.3),
    });
  /** Polished leather / lacquered shoe. */
  const leather = (color: number, clearcoat = 0.6) =>
    phys(color, 0.42, { clearcoat, clearcoatRoughness: 0.25 });
  const glow = (color: number, intensity = 1.5) =>
    std(color, 0.4, { emissive: color, emissiveIntensity: intensity });
  /** Emissive material that slowly breathes (driven by the render loop). */
  const livingGlow = (color: number, intensity = 1.5) => {
    const m = glow(color, intensity) as PulseMaterial;
    m.userData.baseEmissive = intensity;
    res.pulse.push(m);
    return m;
  };
  /** Open cylinder shell for plating a limb that runs along Y. */
  const limbShell = (radius: number, height: number, thetaStart: number, thetaLength: number) =>
    new THREE.CylinderGeometry(radius, radius * 0.96, height, 20, 1, true, thetaStart, thetaLength);
  /** Rod spanning two points — antennas, booms, cables, drawstrings. */
  const addStrut = (
    parent: THREE.Object3D | undefined,
    mat: THREE.Material,
    radius: number,
    from: [number, number, number],
    to: [number, number, number],
    taper = 1,
  ) => {
    if (!parent) return;
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const len = dir.length();
    const geo = new THREE.CylinderGeometry(radius * taper, radius, len, 8);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.castShadow = true;
    parent.add(mesh);
    res.geos.push(geo);
    res.extras.push(mesh);
  };

  const setMat = (id: string, mat: THREE.Material) => {
    const mesh = meshes[id];
    if (mesh) mesh.material = mat;
  };
  const setPair = (id: string, mat: THREE.Material) => {
    setMat(`${id}-l`, mat);
    setMat(`${id}-r`, mat);
  };
  const setVisible = (id: string, visible: boolean) => {
    const obj = nodes[id] ?? meshes[id];
    if (obj) obj.visible = visible;
  };
  const addExtra = (
    parent: THREE.Object3D | undefined,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    pos: [number, number, number] = [0, 0, 0],
    opts: { rot?: [number, number, number]; scale?: [number, number, number]; shadow?: boolean } = {},
  ) => {
    if (!parent) return;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    if (opts.rot) mesh.rotation.set(...opts.rot);
    if (opts.scale) mesh.scale.set(...opts.scale);
    mesh.castShadow = opts.shadow !== false;
    parent.add(mesh);
    res.geos.push(geo);
    res.extras.push(mesh);
  };
  /** Several same-material static bits merged into one draw call. */
  const addMerged = (
    parent: THREE.Object3D | undefined,
    mat: THREE.Material,
    parts: THREE.BufferGeometry[],
    pos: [number, number, number] = [0, 0, 0],
  ) => {
    const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
    parts.forEach((g) => g.dispose());
    if (merged) addExtra(parent, merged, mat, pos);
  };
  /** Box placed (and optionally rotated) then baked, for merging. */
  const bakedBox = (
    w: number,
    h: number,
    d: number,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
  ) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.applyMatrix4(
      new THREE.Matrix4().compose(
        new THREE.Vector3(...pos),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
        new THREE.Vector3(1, 1, 1),
      ),
    );
    return g;
  };
  /** Front-conformed box (segmented so it bends with the chest). */
  const chestBox = (w: number, h: number, d: number, x: number, y: number, offset: number, side: 1 | -1 = 1) => {
    const g = new THREE.BoxGeometry(w, h, d, 4, 3, 1);
    g.translate(x, y, 0);
    return conformToTorso(g, offset + d / 2, side);
  };
  /** Ring around the sleeve, `d` down the arm (cuffs, couplings). */
  const sleeveRing = (pivot: THREE.Object3D | undefined, sx: number, mat: THREE.Material, d: number, h: number, grow: number) => {
    const [x, y] = armPoint(sx, d);
    const r = armRadius(d) + grow;
    addExtra(pivot, new THREE.CylinderGeometry(r, r, h, 20), mat, [x, y, 0], { rot: [0, 0, sx * ARM_SPLAY] });
  };

  const torso = nodes['torso'];
  const head = nodes['head-group'];
  const W = (y: number) => y - 0.645; // world-y -> neck-local-y (see factory)
  const HC = HEAD_CENTER;

  const showTux = (on: boolean) => TUX_PARTS.forEach((id) => setVisible(id, on));

  // The tactical helmet replaces the quiff (it would clip through the shell);
  // every other outfit keeps the signature hair.
  setVisible('hair-quiff', outfit !== 'tactical');
  // Cybernetics take over the character-left eye and ear in the AI era.
  const cyborg = outfit === 'cyber';
  setVisible('eye-l', !cyborg);
  setVisible('ear-l', !cyborg);
  setVisible('brow-l', !cyborg);
  setVisible('blush-l', !cyborg);

  if (outfit === 'dev') {
    showTux(false);
    const hoodie = cloth(0x56637a, 0.9);
    const hoodieDark = cloth(0x46516a, 0.92);
    const jeans = cloth(0x3d5d8c, 0.82, 0.4);
    const denimLight = cloth(0x5d7fae, 0.85, 0.4);
    const sneaker = phys(0xf4f2ec, 0.55, { sheen: 0.3, sheenColor: new THREE.Color(0xffffff) });
    const sneakerSole = phys(0xe4e1d8, 0.7);
    const accent = phys(0xe0735a, 0.5); // warm coral flash on the sneakers
    setMat('torso-jacket', hoodie);
    setPair('arm', hoodie);
    setMat('pelvis', jeans);
    setPair('leg', jeans);
    setPair('shoe', sneaker);
    setPair('sole', sneakerSole);

    // Hood: a soft bunched mass behind the neck plus the opening's rolled rim.
    addExtra(torso, new THREE.SphereGeometry(0.5, 20, 14), hoodieDark, [0, 0.598, -0.07], {
      scale: [0.19, 0.1, 0.12],
    });
    addExtra(torso, new THREE.TorusGeometry(0.052, 0.014, 8, 26), hoodie, [0, 0.632, 0.004], {
      rot: [Math.PI / 2 + 0.25, 0, 0],
      scale: [1.1, 1, 1],
    });
    // Kangaroo pocket with darker slanted openings.
    const pocket = conformToTorso(
      outlinePanelGeometry(
        [
          [-0.078, 0.338],
          [0.078, 0.338],
          [0.06, 0.428],
          [-0.06, 0.428],
        ],
        1,
        0.004,
        0.002,
      ),
      0.004,
    );
    addExtra(torso, pocket, hoodie);
    addMerged(torso, hoodieDark, [
      conformToTorso(outlinePanelGeometry([[0.06, 0.428], [0.078, 0.338], [0.071, 0.338], [0.053, 0.428]], 1, 0.003), 0.008),
      conformToTorso(outlinePanelGeometry([[0.06, 0.428], [0.078, 0.338], [0.071, 0.338], [0.053, 0.428]], -1, 0.003), 0.008),
    ]);
    // Ribbed waistband + cuffs.
    addExtra(torso, torsoShellGeometry(0.297, 0.33, 0.003), hoodieDark);
    for (const side of ['l', 'r'] as const) {
      const sx = side === 'l' ? 1 : -1;
      sleeveRing(nodes[`pivot-shoulder-${side}`], sx, hoodieDark, 0.172, 0.026, 0.002);
    }
    // Drawstrings with aglets and grommets.
    const stringMat = phys(0xf1efe8, 0.6);
    const aglet = std(0xbfc4cc, 0.3, { metalness: 0.6 });
    for (const sx of [1, -1]) {
      const top: [number, number, number] = [sx * 0.022, 0.606, torsoFrontZ(sx * 0.022, 0.606) + 0.008];
      const bot: [number, number, number] = [sx * 0.03, 0.522, torsoFrontZ(sx * 0.03, 0.522) + 0.006];
      addStrut(torso, stringMat, 0.0038, top, bot);
      addExtra(torso, new THREE.CylinderGeometry(0.0055, 0.0045, 0.014, 8), aglet, [bot[0], bot[1] - 0.006, bot[2]]);
      addExtra(torso, new THREE.TorusGeometry(0.006, 0.002, 6, 12), aglet, top, { rot: [-0.6, 0, 0] });
    }
    // Jeans: rolled hems above the sneakers.
    for (const side of ['l', 'r'] as const) {
      addExtra(nodes[`pivot-hip-${side}`], new THREE.TorusGeometry(0.043, 0.008, 8, 22), denimLight, [0, -0.238, 0], {
        rot: [Math.PI / 2, 0, 0],
      });
      // Sneaker flash + laces.
      const sx = side === 'l' ? 1 : -1;
      const hip = nodes[`pivot-hip-${side}`];
      addMerged(hip, accent, [
        bakedBox(0.004, 0.014, 0.05, [sx * 0.05, -0.278, 0.022], [0, sx * -0.06, 0.2 * sx]),
        bakedBox(0.004, 0.014, 0.05, [sx * -0.046, -0.278, 0.022], [0, sx * -0.06, -0.2 * sx]),
      ]);
      addMerged(
        hip,
        stringMat,
        [0, 1, 2].map((i) => bakedBox(0.03, 0.004, 0.006, [sx * 0.002, -0.249 - i * 0.006, 0.05 + i * 0.016], [0.5 + i * 0.15, 0, 0])),
      );
    }

    // Headphones: band arcing over the sculpted hair + cushioned cups.
    const cans = phys(0x23252d, 0.4, { clearcoat: 0.5, clearcoatRoughness: 0.3 });
    const cansSoft = cloth(0x30333e, 0.85);
    const cansAccent = phys(0x7fd1c3, 0.45);
    addExtra(head, new THREE.TorusGeometry(0.214, 0.013, 10, 40, Math.PI), cans, [0, HC.y, -0.012], {
      scale: [1, 1.07, 1],
    });
    for (const sx of [1, -1]) {
      addExtra(head, new THREE.CylinderGeometry(0.05, 0.05, 0.034, 24), cans, [sx * 0.204, W(0.782), -0.005], {
        rot: [0, 0, Math.PI / 2],
      });
      addExtra(head, new THREE.TorusGeometry(0.04, 0.012, 8, 22), cansSoft, [sx * 0.188, W(0.782), -0.005], {
        rot: [0, Math.PI / 2, 0],
      });
      addExtra(head, new THREE.TorusGeometry(0.034, 0.004, 6, 22), cansAccent, [sx * 0.222, W(0.782), -0.005], {
        rot: [0, Math.PI / 2, 0],
      });
    }
  }

  if (outfit === 'suit') {
    showTux(true);
    setVisible('bow-tie', false); // long tie instead
    const navy = cloth(0x22304f, 0.82);
    const navyLapel = phys(0x2a3a5f, 0.5, { sheen: 0.4, sheenColor: new THREE.Color(0x6b7fa8) });
    const navyTrouser = cloth(0x1d2941, 0.84);
    const navyDeep = cloth(0x182238, 0.9);
    const shirt = cloth(0xffffff, 0.66, 0.3);
    const tie = phys(0xa82838, 0.45, { sheen: 0.6, sheenColor: new THREE.Color(0xff7b86), clearcoat: 0.2 });
    const tieDark = phys(0x7e1c29, 0.5);
    const brogue = leather(0x4a2c1b, 0.7);
    const brogueSole = phys(0x24170e, 0.75);
    const square = cloth(0xf3f5fa, 0.7, 0.3);
    setMat('torso-jacket', navy);
    setPair('arm', navy);
    setPair('lapel', navyLapel);
    setMat('shirt-triangle', shirt);
    setMat('pelvis', navyTrouser);
    setPair('leg', navyTrouser);
    setPair('shoe', brogue);
    setPair('sole', brogueSole);
    setPair('button', phys(0x1a1b22, 0.3, { clearcoat: 0.7 }));

    // Shirt collar points flanking the knot.
    addMerged(torso, shirt, [
      conformToTorso(outlinePanelGeometry([[0.004, 0.612], [0.036, 0.632], [0.03, 0.598]], 1, 0.004, 0.0015), 0.007),
      conformToTorso(outlinePanelGeometry([[0.004, 0.612], [0.036, 0.632], [0.03, 0.598]], -1, 0.004, 0.0015), 0.007),
    ]);
    // Four-in-hand knot + a blade that widens to a point.
    addExtra(
      torso,
      conformToTorso(outlinePanelGeometry([[-0.016, 0.62], [0.016, 0.62], [0.01, 0.596], [-0.01, 0.596]], 1, 0.008, 0.003), 0.008),
      tie,
    );
    addExtra(
      torso,
      conformToTorso(
        outlinePanelGeometry([[-0.009, 0.597], [0.009, 0.597], [0.021, 0.488], [0, 0.466], [-0.021, 0.488]], 1, 0.004, 0.0015),
        0.007,
      ),
      tie,
    );
    // Subtle diagonal stripes on the blade.
    addMerged(
      torso,
      tieDark,
      [0, 1, 2, 3].map((i) =>
        conformToTorso(
          outlinePanelGeometry(
            [
              [-0.016, 0.545 - i * 0.022],
              [0.016, 0.561 - i * 0.022],
              [0.016, 0.567 - i * 0.022],
              [-0.016, 0.551 - i * 0.022],
            ].map(([x, y]) => [x * (1 + (0.58 - y) * 4), y] as [number, number]),
            1,
            0.002,
          ),
          0.0105,
        ),
      ),
    );
    // Breast welt pocket + folded pocket square (character-left chest).
    addExtra(torso, conformToTorso(outlinePanelGeometry([[0.062, 0.52], [0.1, 0.524], [0.1, 0.53], [0.062, 0.526]], 1, 0.003), 0.003), navyDeep);
    addExtra(
      torso,
      conformToTorso(
        outlinePanelGeometry([[0.066, 0.524], [0.096, 0.528], [0.093, 0.548], [0.084, 0.539], [0.076, 0.55], [0.068, 0.54]], 1, 0.003, 0.001),
        0.003,
      ),
      square,
    );
    // Hip pocket flaps and a second button row (double-breasted).
    addMerged(torso, navyDeep, [
      conformToTorso(outlinePanelGeometry([[0.045, 0.352], [0.105, 0.352], [0.105, 0.362], [0.045, 0.362]], 1, 0.004, 0.0015), 0.003),
      conformToTorso(outlinePanelGeometry([[0.045, 0.352], [0.105, 0.352], [0.105, 0.362], [0.045, 0.362]], -1, 0.004, 0.0015), 0.003),
    ]);
    const btn = phys(0x1a1b22, 0.3, { clearcoat: 0.7 });
    addMerged(
      torso,
      btn,
      [1, -1].map((sx) => {
        const g = new THREE.CylinderGeometry(0.0075, 0.0075, 0.005, 12);
        g.rotateX(Math.PI / 2);
        g.translate(sx * 0.032, 0.378, torsoFrontZ(sx * 0.032, 0.378) + 0.002);
        return g;
      }),
    );
    // Shirt cuffs peeking out of the sleeves.
    for (const side of ['l', 'r'] as const) {
      const sx = side === 'l' ? 1 : -1;
      sleeveRing(nodes[`pivot-shoulder-${side}`], sx, shirt, 0.188, 0.012, -0.003);
    }
  }

  if (outfit === 'tactical') {
    showTux(false);
    /* ---- palette: multi-tone modern kit — ranger-green nylon, coyote
       pouches, rubberised black hardware, amber displays (deliberately NOT
       cyan, so the defense era stays distinct from the AI era). */
    const field = cloth(0x5c6247, 0.92);
    const cargo = cloth(0x4d4f3d, 0.9);
    const boot = phys(0x1f1e1c, 0.6, { clearcoat: 0.25 });
    const vest = cloth(0x394030, 0.95, 0.45);
    const pouch = cloth(0x8a7350, 0.92, 0.45); // coyote brown
    const pouchDark = cloth(0x2f3527, 0.95, 0.4);
    const belt = cloth(0x26291f, 0.85);
    const rubber = std(0x17181a, 0.65, { metalness: 0.15 });
    const hardware = std(0x9aa2ad, 0.35, { metalness: 0.85 });
    const glass = std(0x14261c, 0.15, { metalness: 0.5 });
    const lace = cloth(0x8a7350, 0.9);
    const amberLive = livingGlow(0xffab3d, 1.0);
    const greenLive = livingGlow(0x7de08a, 0.85);
    const vestShell = cloth(0x394030, 0.95, 0.45);
    vestShell.side = THREE.DoubleSide;

    setMat('torso-jacket', field);
    setPair('arm', field);
    setMat('pelvis', cargo);
    setPair('leg', cargo);
    setPair('shoe', boot);
    setPair('sole', rubber);

    /* ---------------- plate carrier ---------------- */
    // Front + back plates bent to the chest; cummerbund wraps the sides.
    addExtra(torso, chestBox(0.19, 0.17, 0.026, 0, 0.495, 0.004), vest);
    addExtra(torso, chestBox(0.19, 0.15, 0.024, 0, 0.5, 0.004, -1), vest);
    addExtra(torso, torsoShellGeometry(0.41, 0.49, 0.012), vestShell);
    // MOLLE webbing rows across the front plate.
    addMerged(torso, pouchDark, [0, 1, 2].map((i) => chestBox(0.17, 0.007, 0.004, 0, 0.553 - i * 0.03, 0.03)));
    // Triple magazine pouches low on the carrier, with darker flaps.
    addMerged(torso, pouch, [-1, 0, 1].map((sx) => chestBox(0.048, 0.056, 0.026, sx * 0.054, 0.44, 0.029)));
    addMerged(torso, pouchDark, [-1, 0, 1].map((sx) => chestBox(0.05, 0.012, 0.006, sx * 0.054, 0.464, 0.053)));
    // Admin pouch, upper left chest, with a subdued unit patch on its face.
    addExtra(torso, chestBox(0.058, 0.044, 0.02, 0.054, 0.535, 0.03), pouch);
    addExtra(torso, chestBox(0.036, 0.024, 0.003, 0.054, 0.537, 0.05), pouchDark);
    addMerged(torso, field, [chestBox(0.028, 0.005, 0.002, 0.054, 0.543, 0.053), chestBox(0.028, 0.005, 0.002, 0.054, 0.532, 0.053)]);
    // Shoulder straps arcing front-to-back over each shoulder, IFF strobe left.
    for (const sx of [1, -1]) {
      const strap = new THREE.TorusGeometry(0.068, 0.009, 6, 16, Math.PI);
      strap.rotateY(Math.PI / 2);
      addExtra(torso, strap, vest, [sx * 0.072, 0.552, 0], { scale: [2.4, 1, 1] });
    }
    addExtra(torso, new THREE.SphereGeometry(0.0085, 10, 8), amberLive, [0.072, 0.612, 0.04]);
    // Belt with a metal buckle at the hem line.
    const beltShell = belt.clone() as THREE.MeshPhysicalMaterial;
    beltShell.side = THREE.DoubleSide;
    res.mats.push(beltShell);
    addExtra(torso, torsoShellGeometry(0.3, 0.33, 0.006), beltShell);
    addExtra(torso, new THREE.BoxGeometry(0.04, 0.026, 0.012), hardware, [0, 0.315, torsoFrontZ(0, 0.315) + 0.01]);
    // Radio on the back-left plate + whip antenna clearing the helmet.
    addExtra(torso, chestBox(0.05, 0.075, 0.03, 0.06, 0.5, 0.03, -1), pouchDark);
    addStrut(torso, rubber, 0.004, [0.075, 0.54, -0.12], [0.11, 0.74, -0.23], 0.55);
    addExtra(torso, new THREE.SphereGeometry(0.007, 8, 6), rubber, [0.11, 0.742, -0.232]);

    /* ---------------- helmet + comms ---------------- */
    const helmet = cloth(0x4a5138, 0.85, 0.35);
    const helmetDark = cloth(0x33382a, 0.8, 0.3);
    addExtra(head, new THREE.SphereGeometry(0.5, 32, 22), helmet, [0, W(0.876), -0.012], {
      scale: [0.452, 0.33, 0.444],
    });
    for (const sx of [1, -1]) {
      addExtra(head, new THREE.BoxGeometry(0.014, 0.022, 0.13), helmetDark, [sx * 0.214, W(0.866), -0.01], {
        rot: [0, 0, sx * 0.14],
      });
    }
    addExtra(head, new THREE.BoxGeometry(0.1, 0.062, 0.05), pouchDark, [0, W(0.86), -0.215], { rot: [0.25, 0, 0] });
    // Front brim so the shell reads as a helmet, not a bike lid.
    addExtra(head, new THREE.TorusGeometry(0.222, 0.012, 8, 30, Math.PI * 1.15), helmetDark, [0, W(0.838), -0.012], {
      rot: [1.62, 0, -0.08],
    });
    // NVG bracket + flipped-up binocular tubes, proud of the shell.
    addExtra(head, new THREE.BoxGeometry(0.05, 0.05, 0.034), helmetDark, [0, W(0.9), 0.222], { rot: [-0.2, 0, 0] });
    addExtra(head, new THREE.BoxGeometry(0.082, 0.018, 0.022), rubber, [0, W(0.934), 0.23]);
    for (const sx of [1, -1]) {
      addStrut(head, rubber, 0.022, [sx * 0.037, W(0.938), 0.23], [sx * 0.037, W(1.008), 0.21]);
      addExtra(head, new THREE.CylinderGeometry(0.02, 0.02, 0.009, 16), glass, [sx * 0.037, W(1.012), 0.209], {
        rot: [0.27, 0, 0],
      });
    }
    // Chin straps + buckle.
    for (const sx of [1, -1]) {
      addStrut(head, rubber, 0.006, [sx * 0.19, W(0.82), 0.02], [sx * 0.06, W(0.688), 0.085]);
    }
    addExtra(head, new THREE.BoxGeometry(0.022, 0.016, 0.012), hardware, [0.06, W(0.688), 0.088]);
    // Headset: earcup over the left ear with a boom mic to the mouth.
    addExtra(head, new THREE.CylinderGeometry(0.042, 0.042, 0.026, 20), rubber, [0.19, W(0.775), -0.004], {
      rot: [0, 0, Math.PI / 2],
    });
    addExtra(head, new THREE.CylinderGeometry(0.03, 0.03, 0.01, 20), helmetDark, [0.205, W(0.775), -0.004], {
      rot: [0, 0, Math.PI / 2],
    });
    addStrut(head, rubber, 0.005, [0.188, W(0.752), 0.025], [0.06, W(0.708), 0.148]);
    addExtra(head, new THREE.SphereGeometry(0.011, 10, 8), rubber, [0.056, W(0.706), 0.152]);
    addStrut(head, rubber, 0.0045, [0.19, W(0.752), -0.025], [0.14, W(0.665), -0.07]);

    /* ---------------- wrist computer + limb kit ---------------- */
    const armL = nodes['pivot-shoulder-l'];
    const [wx, wy] = armPoint(1, 0.14);
    addExtra(armL, new THREE.BoxGeometry(0.05, 0.036, 0.02), rubber, [wx + 0.004, wy, 0.042], { rot: [0, -0.2, ARM_SPLAY] });
    addExtra(armL, new THREE.BoxGeometry(0.038, 0.025, 0.004), greenLive, [wx + 0.006, wy, 0.053], { rot: [0, -0.2, ARM_SPLAY] });
    sleeveRing(armL, 1, pouchDark, 0.125, 0.008, 0.003);
    sleeveRing(armL, 1, pouchDark, 0.155, 0.008, 0.003);
    // Velcro flag patch on the right shoulder (faces out).
    const armR = nodes['pivot-shoulder-r'];
    const [px, py] = armPoint(-1, 0.05);
    addExtra(armR, new THREE.BoxGeometry(0.004, 0.032, 0.04), pouchDark, [px - 0.046, py, 0.0], { rot: [0, 0, -ARM_SPLAY] });
    addMerged(armR, pouch, [
      bakedBox(0.003, 0.007, 0.032, [px - 0.048, py + 0.008, 0], [0, 0, -ARM_SPLAY]),
      bakedBox(0.003, 0.007, 0.032, [px - 0.048, py - 0.008, 0], [0, 0, -ARM_SPLAY]),
    ]);
    // Elbow pad on the human-side arm for symmetry of kit.
    const [ex, ey] = armPoint(-1, 0.105);
    addExtra(armR, new THREE.SphereGeometry(0.5, 16, 12), pouchDark, [ex, ey, -0.02], { scale: [0.07, 0.06, 0.06] });

    for (const side of ['l', 'r'] as const) {
      const sx = side === 'l' ? 1 : -1;
      const legPivot = nodes[`pivot-hip-${side}`];
      // Kneepad — tinted, not black, or it merges with the boot below it.
      addExtra(legPivot, new THREE.SphereGeometry(0.5, 18, 14), pouchDark, [0, -0.15, 0.03], { scale: [0.094, 0.098, 0.058] });
      addExtra(legPivot, new THREE.BoxGeometry(0.09, 0.007, 0.03), rubber, [0, -0.128, 0.04]);
      // Boot shaft + padded collar, laces crossing up the front.
      addExtra(legPivot, new THREE.CylinderGeometry(0.05, 0.052, 0.06, 18), boot, [0, -0.245, 0.006]);
      addExtra(legPivot, new THREE.TorusGeometry(0.048, 0.007, 6, 18), rubber, [0, -0.214, 0.006], { rot: [Math.PI / 2, 0, 0] });
      addMerged(
        legPivot,
        lace,
        [0, 1, 2, 3].flatMap((i) => [
          bakedBox(0.03, 0.004, 0.005, [0, -0.226 - i * 0.012, 0.054 + i * 0.004], [0, 0, 0.45]),
          bakedBox(0.03, 0.004, 0.005, [0, -0.226 - i * 0.012, 0.054 + i * 0.004], [0, 0, -0.45]),
        ]),
      );
      // Lugged tread blocks around the sole edge.
      addMerged(
        legPivot,
        rubber,
        [-0.066, -0.04, -0.013, 0.013, 0.04, 0.066].flatMap((z) => {
          // Sole half-width at this point of the footprint (see soleGeometry).
          const zn = z / 0.093;
          const hw = 0.05 * (0.9 + 0.16 * (zn * 0.5 + 0.5)) * Math.sqrt(1 - zn * zn) + 0.002;
          return [1, -1].map((s) => bakedBox(0.01, 0.01, 0.014, [sx * 0.002 + s * hw, -0.294, 0.03 + z], [0, s * 0.2, 0]));
        }),
      );
    }
    // Drop-leg pouch on the character-left thigh.
    const hipL = nodes['pivot-hip-l'];
    addExtra(hipL, new THREE.BoxGeometry(0.044, 0.06, 0.036), pouch, [0.048, -0.105, 0.016], { rot: [0, 0, 0.06] });
    addExtra(hipL, new THREE.BoxGeometry(0.048, 0.01, 0.04), pouchDark, [0.048, -0.077, 0.016]);
    // Sling swivel detail at the belt line.
    addExtra(torso, new THREE.TorusGeometry(0.012, 0.004, 8, 14), hardware, [-0.085, 0.33, torsoFrontZ(-0.085, 0.33) + 0.006], {
      rot: [0.4, 0.5, 0],
    });
  }

  if (outfit === 'cyber') {
    showTux(false);
    /* ---- palette: matte techwear on the human half, brushed alloy on the
       machine half, cyan primary / magenta secondary for the live circuitry. */
    // A notch lighter than pure black + cool sheen so the silhouette holds on
    // the dark frontier sky.
    const jacket = phys(0x1b1f2c, 0.5, { metalness: 0.2, sheen: 0.6, sheenColor: new THREE.Color(0x4a5f86) });
    const trouser = cloth(0x11131b, 0.7, 0.4);
    const shoe = leather(0x0e0e15, 0.7);
    const alloy = std(0xccd6e6, 0.28, { metalness: 0.85 });
    const alloyDark = std(0x6b7590, 0.38, { metalness: 0.8 });
    const jointBlack = std(0x222634, 0.45, { metalness: 0.7 });
    const seam = std(0x0b0d14, 0.6, { metalness: 0.3, side: THREE.DoubleSide });
    const plate = std(0xd6dfec, 0.24, { metalness: 0.85, side: THREE.DoubleSide });
    // Saturated at moderate intensity: ACES tone mapping washes hot emissives
    // out to white, which kills the cyan/magenta read.
    const cyan = glow(0x2fd8f5, 1.15);
    const cyanLive = livingGlow(0x2fd8f5, 1.3);
    cyanLive.side = THREE.DoubleSide;
    const coreLive = livingGlow(0x35e0ff, 1.5);
    const magenta = glow(0xe23fc4, 1.1);
    const magentaLive = livingGlow(0xe23fc4, 1.3);
    const soleGlow = std(0x0c0f16, 0.6, { emissive: 0x2fd8f5, emissiveIntensity: 0.35 });

    setMat('torso-jacket', jacket);
    setMat('arm-r', jacket); // human arm stays sleeved
    setMat('arm-l', alloy); // exposed prosthetic
    setMat('hand-l', alloy);
    setMat('pelvis', trouser);
    setMat('leg-r', trouser);
    setMat('leg-l', jointBlack); // actuator housing under the plating
    setMat('shoe-l', alloyDark);
    setMat('shoe-r', shoe);
    setPair('sole', soleGlow);

    /* ---------------- head: augmented left hemisphere ---------------- */
    // Cheek-to-temple faceplate hugging the skull (front→character-left).
    const P0 = 1.74;
    const PL = 1.26;
    const T0 = 0.8;
    const TL = 1.5;
    addExtra(head, headShellGeometry(P0, PL, T0, TL, 0.004), plate, [HC.x, HC.y, HC.z]);
    // Panel lines (dark slivers) and the emissive seam where plate meets skin.
    addMerged(head, seam, [
      headShellGeometry(P0 + 0.62, 0.014, T0 + 0.05, TL - 0.1, 0.0052),
      headShellGeometry(P0 + 0.06, PL - 0.1, T0 + 0.82, 0.014, 0.0052),
      headShellGeometry(P0 + 0.95, 0.014, T0 + 0.1, 0.7, 0.0052),
    ], [HC.x, HC.y, HC.z]);
    addExtra(head, headShellGeometry(P0 - 0.004, 0.02, T0 + 0.08, TL - 0.2, 0.0055), cyanLive, [HC.x, HC.y, HC.z]);
    addExtra(head, headShellGeometry(P0 + 0.06, 0.6, T0 + TL - 0.03, 0.018, 0.0055), cyanLive, [HC.x, HC.y, HC.z]);
    // Optic replacing the left eye: housing ring, lens, hot pupil.
    const eyeZ = 0.166;
    addExtra(head, new THREE.TorusGeometry(0.034, 0.008, 10, 26), alloyDark, [0.07, W(0.772), eyeZ]);
    addExtra(head, new THREE.SphereGeometry(0.5, 20, 14), livingGlow(0x35e0ff, 1.5), [0.07, W(0.772), eyeZ - 0.002], {
      scale: [0.05, 0.05, 0.022],
    });
    addExtra(head, new THREE.SphereGeometry(0.0085, 12, 10), magenta, [0.07, W(0.772), eyeZ + 0.01]);
    // Brow guard above the optic (replaces the organic brow on that side).
    addExtra(head, new THREE.BoxGeometry(0.072, 0.012, 0.014), alloyDark, [0.068, W(0.83), 0.162], { rot: [-0.2, -0.35, 0.1] });
    // Audio/sensor module where the left ear was, with three status LEDs.
    addExtra(head, new THREE.BoxGeometry(0.03, 0.068, 0.05), alloyDark, [0.176, W(0.776), -0.004]);
    addMerged(head, cyan, [0, 2].map((i) => new THREE.SphereGeometry(0.006, 8, 6).translate(0.192, W(0.798) - i * 0.019, -0.004)));
    addExtra(head, new THREE.SphereGeometry(0.006, 8, 6), magenta, [0.192, W(0.779), -0.004]);
    // Swept sensor antenna off the temple.
    addStrut(head, alloyDark, 0.005, [0.17, W(0.86), -0.02], [0.215, W(0.99), -0.09], 0.6);
    addExtra(head, new THREE.SphereGeometry(0.0105, 10, 8), magentaLive, [0.216, W(0.994), -0.092]);

    /* ---------------- neck + torso: reactor core and plating ---------------- */
    addExtra(torso, new THREE.TorusGeometry(0.046, 0.008, 8, 28), cyan, [0, 0.632, 0.004], { rot: [Math.PI / 2, 0, 0] });
    // Cable from the collar down to the prosthetic shoulder.
    addStrut(torso, alloyDark, 0.007, [0.03, 0.628, -0.02], [0.112, 0.592, -0.03]);
    // Upper-left chest plate, a slice of the torso surface.
    addExtra(torso, torsoShellGeometry(0.47, 0.6, 0.007, 0.3, 1.25, 28), plate);
    addMerged(torso, seam, [
      torsoShellGeometry(0.47, 0.6, 0.0085, 0.95, 0.025, 4),
      torsoShellGeometry(0.535, 0.542, 0.0085, 0.35, 1.15, 20),
    ]);
    addExtra(torso, torsoShellGeometry(0.47, 0.6, 0.009, 0.3, 0.03, 4), cyanLive);
    // Heat-vent slats on the chest plate.
    addMerged(
      torso,
      jointBlack,
      [0, 1, 2].map((i) => {
        const y = 0.565 - i * 0.012;
        const x = 0.075;
        return bakedBox(0.034, 0.004, 0.006, [x, y, torsoFrontZ(x, y) + 0.01], [-0.3, 0.55, 0]);
      }),
    );
    // Sternum reactor: housing ring, breathing lens, hot centre, four bolts.
    const coreZ = torsoFrontZ(0, 0.5);
    addExtra(torso, new THREE.TorusGeometry(0.038, 0.009, 10, 30), alloy, [0, 0.5, coreZ + 0.004], { rot: [-0.1, 0, 0] });
    addExtra(torso, new THREE.SphereGeometry(0.5, 22, 16), coreLive, [0, 0.5, coreZ], { scale: [0.062, 0.062, 0.03] });
    addExtra(torso, new THREE.SphereGeometry(0.014, 12, 10), magentaLive, [0, 0.5, coreZ + 0.012]);
    addMerged(
      torso,
      alloyDark,
      [0.79, 2.36, 3.93, 5.5].map((a) => {
        const g = new THREE.CylinderGeometry(0.0045, 0.0045, 0.008, 8);
        g.rotateX(Math.PI / 2);
        g.translate(Math.cos(a) * 0.052, 0.5 + Math.sin(a) * 0.052, coreZ + 0.0);
        return g;
      }),
    );
    // Circuit piping on the human (right) side of the jacket.
    addExtra(torso, conformToTorso(outlinePanelGeometry([[-0.05, 0.53], [-0.045, 0.53], [-0.06, 0.43], [-0.065, 0.43]], 1, 0.002), 0.002), cyan);
    addExtra(torso, conformToTorso(outlinePanelGeometry([[-0.065, 0.43], [-0.02, 0.425], [-0.02, 0.43], [-0.062, 0.435]], 1, 0.002), 0.002), magenta);

    /* ---------------- prosthetic arm (character-left) ---------------- */
    const armPivot = nodes['pivot-shoulder-l'];
    const tilt: [number, number, number] = [0, 0, ARM_SPLAY];
    // Pauldron: a domed guard capping the shoulder, with a lit seam.
    addExtra(armPivot, new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, 0, 1.2), plate, [0.008, -0.012, 0], {
      scale: [0.122, 0.104, 0.116],
    });
    addExtra(armPivot, new THREE.TorusGeometry(0.052, 0.006, 8, 28), cyanLive, [0.009, -0.03, 0], { rot: [Math.PI / 2, 0, 0] });
    const at = (d: number): [number, number, number] => {
      const [x, y] = armPoint(1, d);
      return [x, y, 0];
    };
    // Bicep actuator seam, elbow servo ring + hot joint.
    addExtra(armPivot, new THREE.BoxGeometry(0.005, 0.05, 0.005), cyanLive, [at(0.07)[0], at(0.07)[1], armRadius(0.07) - 0.001], { rot: tilt });
    addExtra(armPivot, new THREE.TorusGeometry(armRadius(0.1) + 0.002, 0.008, 10, 26), alloyDark, at(0.1), { rot: [Math.PI / 2, ARM_SPLAY, 0] });
    addExtra(armPivot, new THREE.SphereGeometry(0.01, 10, 8), magentaLive, [at(0.1)[0], at(0.1)[1], armRadius(0.1) + 0.006]);
    // Forearm plating over the alloy limb, with a dark panel line.
    addExtra(armPivot, limbShell(armRadius(0.135) + 0.005, 0.06, -1.3, 2.6), plate, at(0.135), { rot: tilt });
    addExtra(armPivot, limbShell(armRadius(0.135) + 0.0065, 0.004, -1.25, 2.5), seam, at(0.135), { rot: tilt });
    addExtra(armPivot, new THREE.TorusGeometry(armRadius(0.172) + 0.003, 0.007, 8, 22), alloyDark, at(0.172), { rot: [Math.PI / 2, ARM_SPLAY, 0] });
    // Palm emitter.
    addExtra(armPivot, new THREE.SphereGeometry(0.012, 12, 10), cyanLive, [0.042, -0.226, 0.036]);

    /* ---------------- augmented leg (character-left) ---------------- */
    const legPivot = nodes['pivot-hip-l'];
    addExtra(legPivot, limbShell(0.055, 0.09, -1.2, 2.4), plate, [0, -0.075, 0]);
    addExtra(legPivot, limbShell(0.0565, 0.004, -1.15, 2.3), seam, [0, -0.06, 0]);
    // Knee hinge bolt on the outer face of the knee + lit core.
    addExtra(legPivot, new THREE.CylinderGeometry(0.028, 0.028, 0.016, 20), alloyDark, [0.047, -0.15, 0.006], { rot: [0, 0, Math.PI / 2] });
    addExtra(legPivot, new THREE.SphereGeometry(0.01, 10, 8), cyanLive, [0.056, -0.15, 0.006]);
    addExtra(legPivot, limbShell(0.049, 0.06, -1.2, 2.4), plate, [0, -0.2, 0]);
    // Vertical emissive seam down the shin plate.
    addExtra(legPivot, new THREE.BoxGeometry(0.004, 0.05, 0.004), cyanLive, [0.0, -0.2, 0.05]);
    addExtra(legPivot, new THREE.TorusGeometry(0.045, 0.007, 8, 22), alloyDark, [0, -0.236, 0], { rot: [Math.PI / 2, 0, 0] });

    /* ---------------- halo ---------------- */
    // Neural halo with three orbiting data nodes (one magenta so the accent
    // stays rare instead of reading as candy).
    const haloY = W(1.085);
    addExtra(head, new THREE.TorusGeometry(0.125, 0.012, 10, 40), livingGlow(0x2fd8f5, 1.6), [0, haloY, -0.01], {
      rot: [Math.PI / 2 - 0.1, 0, 0],
    });
    [0, 2.1, 4.2].forEach((a, i) => {
      addExtra(
        head,
        new THREE.SphereGeometry(0.013, 10, 8),
        i === 1 ? magentaLive : cyan,
        [Math.cos(a) * 0.125, haloY + Math.sin(-0.1) * Math.sin(a) * 0.125, -0.01 + Math.sin(a) * 0.125 * Math.cos(0.1)],
      );
    });
  }
}
