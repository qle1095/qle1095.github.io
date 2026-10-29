# Lumi pass 2: assessment log

Harness: `preview-lumi.html` (`src/character/previewLumi.ts`). Views:
front, three-quarter, site-angle, side (her right, the photo's side), left,
back, top, face, face34. Use `site=1` for her exact on-site pixels (the
site's camera, lights and placement, cropped and upscaled 4x, pixelated).

## Baseline (pass 1 model)
- 27 meshes / 27 draw calls / 12,806 triangles.
- The cap was a bowl-shaped shell sitting like a helmet. There was no widow's
  peak; a 5-sided cone poked out of the forehead instead. No brows.
- The shoulder and hip "patches" were shells that bulged off the body. From
  the site camera (her right flank) they were almost invisible, so at 50px she
  read as a plain white cat with a black tail.
- Ears were short cones. The black ear barely showed from the site angle.
- Legs were capsules with ball paws. The body was a plain ellipsoid plus a
  haunch sphere, and the tail was a uniform-radius tube.

## Iteration 1: rebuild
Changes:
- Skull and torso are now shaped UV spheres. Their markings are baked into
  CanvasTextures from the same shape function, so each patch is evaluated at
  its exact surface point. There are no shells, so no z-fighting and no
  bulges, and every edge is antialiased.
- Cap: white forehead dome with brow dips over each eye and a sharp V peak
  between the eyes. On her right the brow band runs outward, then lifts to the
  white ear. On her left the black runs down the temple beside the eye, as in
  the photo.
- Torso: deep chest, tucked waist, rounded haunch, and a neck rise. The saddle
  has a slanted front edge, a belly-line lower edge, a white rump underside and
  a rounded corner. The shoulder patch is a teardrop over the withers that
  wraps across the spine. The two sides are slightly asymmetric.
- Ears: a custom crescent-section mesh with a real concave cup and rim lip.
  Colours are vertex colours: the left ear is black with a dusky cup, the
  right is white with a pink cup that deepens at the base.
- Face: glassy clearcoat eyes with a baked iris (gold-green to green, limbal
  ring, oval pupil, two catchlights), set in a dark liner. Glossy
  rounded-triangle nose. Whisker pads and chin, a W-mouth tube, and six
  whiskers drawn as one LineSegments.
- Lathe legs with rounded paws. A two-joint tapered tail that curls forward
  at the tip.
- Fur is MeshPhysicalMaterial (roughness 0.82, cool sheen), with blue-tinted
  black.

Review:
- Close-up front and 3/4: reads as a vinyl collectible and clearly as her.
  Peak, brows, one black ear, and a pink-cupped white ear all present.
- Side vs photo: shoulder patch and saddle placement match well. The white
  band between them is the right width, and the white underside and rump are
  right.
- Problems:
  - The black was too light (slate) at first. Darkened to #17181f with lower
    sheen.
  - The legs read as leggy (dog-like). Lowered the torso and pivots, deepened
    the chest.
  - The head was too small for a chibi. Set the head pivot scale to 1.1.
  - The eyes protruded beyond the face silhouette at 3/4. Flattened and
    recessed them.
  - The near ear looked like a blade from the side. Thickened it.
  - The black ear's inner cup read pink at 50px, which muddied "one black
    ear". Darkened it.
  - UV seams sat on her right temple and right flank, which are both visible
    on site. Rotated them to the back of the head and under the belly.

## Iteration 2: fit, site check, outfits
Changes:
- Lowered the body and legs (pivot height 0.081). Total height is now about
  0.30 against Levi's 1.0, and the legs read as a cat's, not a dog's.
- Widened the torso slightly. Made the shoulder patch larger and placed it
  further back so it reads at site scale. Made the widow's peak bolder so the
  V survives at about 25px of head width.
- Moved the Lumi animation out of Character.tsx into a shared
  `animateLumi()` in lumi.ts, so the harness poses exactly what the site
  plays. Changes:
  - Asymmetric reach/push trot.
  - Body bob at the step frequency and a faint core pitch.
  - Head counter-nod and an idle curious head tilt.
  - Two-joint tail: the tip lags the base.
  - Periodic ear flicks: the white ear about every 5.3s, the black one about
    every 7.9s.
  - Blinks about every 3.9s, plus a double blink.
  - The wave paw is lifted higher and swung out beside her cheek. At 50px it
    used to vanish into her white chest; now it reads against the sky.
- Added `disposeLumiModel()`, called from Character's unmount cleanup. It
  frees the textures, geometries and materials of the base model and of the
  current outfit.
- Refitted the outfits to the new body:
  - **dev:** elliptical headphone band behind the ear bases, cups and a
    status LED.
  - **suit:** navy collar swept along the actual neck ellipse, plus a red bow
    tie at the throat. The old necktie was hidden under her chin.
  - **tactical:** the vest is now a band built from the torso's own shape
    function, inflated, with webbing, flank pouches, a MOLLE block and an
    IFF strobe. The helmet clears the brows.
  - **cyber:** glowing collar with an octahedral tag, a tighter halo, and a
    wider visor (covers both eyes, less opaque) with temple arms hugging the
    head.

Review on the real site, at 1440x900 with her actual canvas pixels captured:
- **Y=0, hero (dev):** reads as Lumi. Black cap, one black ear, a pink-cupped
  white ear, the shoulder patch, the saddle, a black tail and green eyes all
  show at about 55px.
- **Y=3000 (suit):** the collar and bow tie read. The black cap is crisp
  against the pale sky.
- **Y=4500 (tactical):** the vest and helmet fit with no clipping. The ears
  come through the helmet.
- **Y=9000 (cyber, dark sky):** the blue-tinted black and the cool sheen keep
  her black areas separate from the navy sky. The halo and collar glow. The
  eyes stay readable thanks to the faint self-lit iris.
- Still weak: at site scale the widow's peak is only a few pixels (bolder now,
  but it's inherently small). The sit-wave paw is white on white from the
  front.

## Iteration 3: polish, performance, parity
Changes:
- **Finish:** added a faint, very soft clearcoat (0.16 at roughness 0.6)
  over the roughness 0.74 sheen fur. This gives the satin skin of a vinyl
  collectible without turning glossy.
- **Peak:** retuned the widow's peak so its tip sits between the upper eyes.
  It's bold enough for site scale without the long V the photo doesn't have.
- **Blink:** squashing the eye alone read as a green squint, so the glassy
  ball now hides near the closed point and the squashed liner reads as a
  closed lid.
- **Performance:**
  - Texture bakes are now block-adaptive. Flat 4x4 blocks (torso) and 2x2
    blocks (head) are filled from corner samples, and only edge blocks are
    painted per texel.
  - Replaced `Math.hypot` with `sqrt`.
  - Trimmed the texture sizes (head 640x320, torso 768x384, iris 384x192).
  - Trimmed the tessellation: eye 24x18, shared small sphere 16x12, torso
    44x32, skull 36x28.
  - Model build time dropped from about 140ms to about 32ms.
- **Lighting:** the harness now imports the shared `lighting.ts` rig (Levi's
  agent extracted it mid-pass), so look-dev matches production exactly.

Counts (base model, no outfit):
- Before: 27 meshes, 27 draw calls, 12,806 triangles.
- After: 26 meshes plus 1 LineSegments (whiskers, 30 segments), 27 draw calls,
  13,020 triangles. The 3 marking/iris textures are CanvasTextures at
  640x320, 768x384 and 384x192.

With outfits:

| Outfit | Meshes | Triangles |
| --- | --- | --- |
| dev | 33 | 14,260 |
| suit | 30 | 14,276 |
| tactical | 37 | 17,892 |
| cyber | 33 | 17,356 |

Final review:
- **Side by side with the photo:**
  - Cap with brows and peak, black left temple and left ear, white right
    ear with a pink inner: all match.
  - White muzzle and chest, green-yellow eyes, pink nose: match.
  - The withers patch is separated from the cap by a white nape.
  - The saddle covers the back and hip, with a white underside and white
    rear thighs.
- **Site scale (about 55px), light and dark skies:** reads as a
  black-and-white bicolour with a capped head and one dark ear. The patches
  are legible from the walk-right camera (her right flank, the same side as
  the photo).

Known limits:
- The peak is a handful of pixels on site.
- No toe beans: the soles are never visible.
- Whiskers are 1px lines, so they are faint on light skies, which is
  realistic.
- Fixed in passing: the celebrate hop no longer competes with the trot bob
  while she stands, because the bob only writes position.y while she trots.
  Before, the bob overwrote the hop every frame.
