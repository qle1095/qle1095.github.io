# Upgrade plan: making "The Journey" recruiter-grade

Built from two audits: a recruiter/copy review against `resume.pdf`, and a visual/UX review measured live at 1440×900, 1280×720 and 375×812.

**Goal:** a recruiter who gives the site 30 seconds learns who Levi is, his level, his proof points, and how to reach him. The walk itself should feel crafted, not buggy.

## Keep (the signature)
- The walking 3D chibi and cat, with per-era outfits.
- The side-scroller mechanic (Lenis + scrubbed ScrollTrigger).
- The five eras.
- Skill pickups feeding a HUD.
- Real HTML content and the reduced-motion fallback.
- The Bricolage + Inter type pairing.

## P0: bugs a recruiter would notice
| # | Problem | Fix |
|---|---|---|
| 1 | The character covers the text of **every** active card. | Cards activate *ahead* of him (`CARD_LEAD`). Fix `walkX` so the code tracks his real centre (he is drawn 105px off). |
| 2 | The hero says "Six years" (it was ~5). The character overlaps the intro. There's no contact info until the very bottom. | Rebuild the hero as a title screen: name, sharper tagline, a proof-stat strip, CTAs (Start / Resume / Email / LinkedIn), and a reserved slot where the character stands. |
| 3 | Scenery from 2–3 eras shows at once. | Cross-fade per-era scenery groups with the sky. |
| 4 | The primary CTA and all orange/gold labels fail contrast (2.3–3.3:1). | Accessible token set (accent-700 `#c2410c`, text-safe kind colours). |
| 5 | Emoji icons; the HUD is 15px emoji that covers the character on mobile. | Real logos (simple-icons) and Lucide UI icons. One-row HUD tray with a popover; a pill on mobile. |
| 6 | On mobile a full card is visible in only 9 of 46 frames. | Mobile renders the active milestone in a fixed screen-space panel. |

## P1: from "cute" to "crafted"
- **Cards:**
  - Opaque even when dimmed.
  - One highlight per story, max ~35 words.
  - A metric callout (`10,000 msg/s`, `$450M`, `~30 teams`…).
  - Consistent `Company · context` subtitles.
  - Tags read "New role" instead of "New chapter".
- **Chapter title:** the half-cut ghost wordmark goes away. Replace it with a screen-space chapter chip (`CHAPTER 03 · Startup Ascent · Raft`).
- **Skill pickups:** move them onto the path so they never paint over cards.
- **Ending:** cut the dead ~1000px of night after the $450M card and add a finale beat.
- **Outro:** contact actions first, then the course and playground as side-by-side "things I teach & tinker with" cards. Fix the colour seam and the jump over text. Add a real footer.
- **Tech stack:** clearance and certs first, icon chips, left-aligned heading.
- **Design tokens:** type scale (15 ad-hoc sizes collapse to 8), radii, shadows, motion. Each era palette drives the scenery fills.
- **Copy:** every card rewritten outcome-first, per `resume.pdf`. Fix drift: "executive" → "scheduled" demos, "on the spot", "Exit" → "Acquisition", "Levelling". Tighten the meta/OG tags for LinkedIn previews.

## P2: polish
- Progress-bar labels collide, tap targets are too small, and there's no focus ring.
- Keyboard focus should move the world to the focused card.
- Arrow-key navigation.
- `THREE.Timer`.
- Remove dead `.chibi*` CSS.
- `text-wrap: balance`, tabular numerals.

## Execution
Two implementation agents run in parallel with clear file ownership:
- **Stage agent:**
  - Files: `JourneyStage.tsx`, `layout.ts`, `Scenery.tsx`, `Character.tsx`, and the stage/scenery/progress/pickup CSS.
  - Work: P0 1, 3, 6; chapter chip; pickups; ending; outro landing; progress bar; keyboard.
- **Surface agent:**
  - Files: `journey.ts`, `index.html`, `Hero`, `MilestoneCard`, `SkillHUD`, `SoundToggle`, `Outro`, `TechStack`, `StaticTimeline`, and tokens/card/hero/outro CSS.
  - Work: P0 2, 4, 5; cards; copy; outro; tech stack.
- **Shared contracts:**
  - `[data-character-slot]` in the hero marks where the character stands.
  - `[data-character-landing]` in the outro marks where he lands.
  - `MilestoneCard` accepts `onFocus`.

## Open questions for Levi (safe defaults used meanwhile)
1. Open to work? Which roles, and remote or relocation? (No "open to" line was added.)
2. Still Raft, or now Leonardo DRS? Has the deal closed? (The badge keeps "Raft → Leonardo DRS"; the acquisition card says "announced".)
3. Exact months for FIU graduation (Dec 2019), JPMC start (Feb 2020), and the Staff promo (Apr 2023). The resume shows years only. (Kept as-is.)
4. A measured AI result (time per CVE now vs ~5 min)? This is the biggest copy upgrade available.
5. A GitHub URL to add to the contact row?
6. Next.js is on the site but not in the resume. (Kept.)
7. `public/og.jpg` still says "Scroll to walk the journey". It needs re-rendering with the new tagline.
