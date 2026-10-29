# Pass 8: designer-vinyl upgrade (face, hair, body, materials, outfits)

Reference: `assets-src/photo-ref.jpg`. Review harness: `preview-chibi.html`
(close-up views), plus the new `?site=1` mode, which renders at the site's real
340x260 canvas with the site camera, the site's facing and the shared lighting
rig (`src/character/lighting.ts`), over light-dawn, pale-sky and dark-frontier
backgrounds.

Baseline (pass 7) as measured in the harness:
- **Meshes / triangles:** bare 35 / 19.8k, dev 36 / 21.1k, suit 35 / 19.8k,
  tactical 80 / 23.4k, cyber 72 / 31.4k.
- **What it looked like:**
  - helmet-like hair from five ellipsoids
  - big black dot eyes
  - stacked capsules with a pelvis ring bulging at the waist
  - ball hands
  - a torus smile

## Iteration 1: rebuild the base

What changed:
- **Head:** a deformed ellipsoid with a soft oval jaw taper, fuller cheeks and
  the seam welded so there is no normal crease.
- **Face:** a "tampo-printed" vinyl face made of CanvasTexture decals
  z-projected onto the head:
  - almond eyes: dark-brown radial iris, pupil, upper-lid shadow, a lash mass
    with an outer flick, a soft lower lid, and two catchlights on an
    emissiveMap so they stay crisp
  - soft straight brows
  - a small closed smile with upturned corners
  - very low-alpha cheek blush on a glossier (lower roughness) decal
  - a nose bump and smaller angled ears
- **Hair, first try:** about 20 round tube locks over an ellipsoid cap.
  - **Result:** read as combed ribs or a "brain" and was too brown. The fat lock
    roots made a straight roll across the forehead (a bowl cut).
- **Hair, second try:** a sculpted mass. The cap now has a volume field: an
  up-swept front quiff that is thin at the hairline and full above it, a
  rounded crown, fuller sides, and a shallow side-part groove on his right.
  Broad, flat, shingled lens-section locks sit on that mass as relief, with the
  tips flicking off it. The signature wavy forelock falls onto his right
  forehead. Vertex-colour grooves darken the lock edges. The material is
  physical with sheen and a light clearcoat, coloured dark brown-black.
  - **Result:** reads as sculpted collectible hair, not a helmet.
- **Body:** a lathe-profiled torso (an A-line bell with narrow rounded
  shoulders), a pelvis tucked inside the hem, tapered legs and sleeves, sleeve
  caps that form the shoulders, mitten hands with a thumb, and shoes with a
  round toe box, toe spring and a separate bevelled sole.
  - **Result:** the first torso flare re-created a waist ring. The hem was
    narrowed and the pelvis tucked in, and the ring is gone.

Open issues after iteration 1:
- The face is slightly pale under ACES on the site.
- Brows and mouth are too faint at site scale.
- The cyber head slivers were mis-parented, so they floated below the chin.

## Iteration 2: outfits, site-scale lighting

What changed:
- **Outfits rewritten to fit the new body.** Panels are now bent onto the torso
  with `conformToTorso` and `torsoShellGeometry`, and onto the head with
  `headShellGeometry`.
  - **dev:**
    - hood with a rolled rim
    - kangaroo pocket with darker openings
    - ribbed waistband and cuffs
    - drawstrings with metal aglets and grommets
    - rolled jean hems
    - sneakers with laces and a coral flash
    - headphones refit over the taller hair, with a teal accent ring
  - **suit:**
    - shirt collar points
    - four-in-hand knot and a striped blade
    - welt pocket with a folded pocket square
    - hip flaps
    - four buttons (double-breasted)
    - shirt cuffs
    - brown brogues with their own sole
  - **tactical:**
    - chest-conformed plate carrier with a cummerbund, MOLLE rows, mag pouches
      and an admin pouch with a unit patch
    - arcing shoulder straps
    - flag patch on the right sleeve
    - boot shafts with crossed laces and lugged tread
    - helmet enlarged to clear the new hair
  - **cyber:**
    - faceplate extended down to the jaw (it stops short of the mouth)
    - dark panel-line slivers
    - emissive seams on the plate-skin join and along the chest-plate edge
    - chest plate panel lines
    - lit seams on the pauldron, bicep and shin
    - glowing soles
- **Fixes:**
  - The merged head slivers now get the head-centre offset; that was the
    floating-lines bug.
  - The preview `pose=wave` now matches the site (right arm raised).
- **Lighting:** moved into the shared `lighting.ts` and tuned:
  - exposure 1.35 to 1.25, environment intensity 0.55 to 0.5
  - hemisphere 1.15 to 0.95
  - warmer key
  - fill moved camera-left so the near cheek is lit
  - rim 0.8 to 1.25 for dark-sky separation
  - skin albedo warmed

Observations at site scale (2x pixel zoom of a real 340x260 render):
- The hair silhouette, the headphones and the outfit colours all read
  clearly.
- The dark cyber sky separates thanks to the rim and the halo.
- The skin is still on the light side.
- The 49-degree facing puts the near eye near the centre of the face and the
  far eye on the profile edge, so the brows and mouth need more weight to
  read.

## Iteration 3: hairline, face weight, performance, real-site check

What changed:
- **Hairline:** the hair mass now grows out of the scalp over the first 12
  degrees past the hairline. It used to step up as a 2.8 cm "helmet ledge".
  Lock lifts follow the same ramp, so:
  - the quiff rises off the forehead and sweeps up and back;
  - the forelock hangs on his right forehead (visible in the front view);
  - the sideburns sit on the skin.
- **Face weight for the site:**
  - eyes about 9% larger and slightly wider set
  - brows larger and darker
  - mouth patch larger
  - cyber optic re-centred on the new eye position
- **Hair sheen:** clearcoat 0.3 to 0.12, and rounder lock undersides, to cut
  the white edge streaks in the back view. A faint rim catch remains.
- **Cyber jacket:** lifted a notch, from near-black to 0x1b1f2c, with a cool
  sheen so the silhouette holds on the dark frontier sky.
- **Performance:** `headShellGeometry` tessellation now scales with the
  angular size of the patch. Thin panel-line slivers had cost 1,920 triangles
  each. Torso, pelvis and hair-cap tessellation was also trimmed.

Meshes / triangles, visible and without shadow passes:

| outfit | before (meshes / tris) | after (meshes / tris) |
| --- | --- | --- |
| bare | 35 / 19.8k | 35 / 19.8k |
| dev | 36 / 21.1k | 53 / 24.9k |
| suit | 35 / 19.8k | 42 / 20.2k |
| tactical | 80 / 23.4k | 84 / 27.3k |
| cyber | 72 / 31.4k | 68 / 30.1k |

Real site, 1440x900. The pane is downscaled, so these were judged at about
0.55x and are pessimistic.
- **Hero (dev):** the hair mass, a face with two eyes, the headphones and the
  hoodie all read.
- **Y 3000 (suit):** navy suit, red tie, brown brogues and the swept hair read.
- **Y 9000 (tactical):** the helmet, plate carrier and boots read.
- **Y 9900 (cyber, dark sky):**
  - halo, faceplate and optic glow read
  - the alloy arm and leg read
  - the rim keeps the hair and jacket off the sky
- **Console:** no errors.

Against the photo:
- **Carried:**
  - dark brown-black volume swept up and back
  - side part on his right
  - wavy forelock on his right forehead
  - soft oval face with full cheeks
  - dark-brown almond eyes with a calm, slightly hooded gaze
  - soft straight brows
  - a small nose
  - a closed, gentle, slight smile
  - ears just visible
- **Stylised away by design:** the real hair's messy texture. It is now
  readable, sculpted clumps.

Known limitations:
- On the site the character faces the camera at a 49-degree turn, set by
  FACING in Character.tsx, which was left untouched. The far eye sits on the
  profile edge; the face reads fully only while waving (about 7 degrees).
- Mitten thumbs read in close-ups but are invisible at site scale, as
  expected.
- The back-view hair keeps thin rim-lit lock edges. That view is never seen on
  the site.
