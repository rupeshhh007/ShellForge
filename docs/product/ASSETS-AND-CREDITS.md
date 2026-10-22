# Original assets and component credits

## Artwork inventory

| File | Source / role | Delivery |
| --- | --- | --- |
| `apps/web/public/artwork/command-sculpture.webp` | Original built-in ImageGen copper/silver hero | 1000×1000 WebP; ~66 KB; explicit image dimensions and alt text |
| `apps/web/public/artwork/syntax-map.svg` | Original hand-authored branching diagram | Vector; Bench figure; no external image request |
| `apps/web/app/icon.svg` | Original command-bracket mark | Vector favicon; header uses a matching native SVG |
| `docs/product/concepts/landing.webp` | Original built-in ImageGen design reference | Documentation only, never rendered as website UI |
| `docs/product/concepts/workbench.webp` | Original built-in ImageGen design reference | Documentation only, never rendered as website UI |

No stock media, reference-site art, scraped illustrations, hotlinked placeholders or
fake raster-generation claims. Generated PNG outputs were optimized locally with
Pillow into WebP; original generated outputs remain at the tool's saved destination.
The hero uses a soft edge mask to blend the studio backdrop, with no color overlay.
SVG illustrations are identified as code-authored, not AI raster artwork.

## Generation prompts

All three used the built-in `image_gen.imagegen` tool; no API key or CLI fallback.

**Hero asset:**

> Use case: product-mockup. Original ShellForge website hero artwork ONLY, no UI or text. A beautifully machined copper/bronze angle bracket sculpture combined with one diagonally suspended brushed silver slash, physical abstraction of Bash >_ syntax. Architectural triangular negative spaces, tiny etched machining lines, realistic subtly worn surfaces. One coherent precision instrument. Three-quarter camera front view, entire object visible with generous margin, square composition. Warm bone seamless studio background #eeeae2, soft dramatic natural side lighting, grounded soft shadow. Restrained industrial editorial art direction, tactile, expensive independent design magazine, quiet and sculptural, no sci-fi, no glows, no gradients or floating interface labels, no letters or logos. Art asset for a landing page with warm bone background. High quality realistic render.

**Landing concept:**

> Use case: ui-mockup. Create one crisp high-end desktop website design concept image for ShellForge — The Command Workshop, 1536x1024 landscape. Experimental technical editorial identity: warm bone #eeeae2, charcoal #232522, copper #a14f32, restrained sage. Distinctive enormous editorial serif headline 'Less guesswork. More command.' at left; understated navigation ShellForge / The Forge / X-Ray / Field Manual / The Bench at top. Right hero art is an original photoreal machined bronze angle bracket and silver slash assembly, a sculptural abstract Bash syntax object, on bone background with precision etchings. Hero supporting text 'Describe the operation. Understand the command. Inspect the consequences.' Primary dark rectangular button 'Enter the Forge ↗'. Bottom preview a black narrow command strip 'find . -type f -size +100M'. Make it feel like an independent industrial design publication. No pill badges, card grids or SaaS gradients. Show downstream continuation: a section called 'One character. A different consequence.' with plus-sign copper graphic; next concise verification strip with Syntax / Static policy / Your review. This is the visual spec for HTML/CSS code-native typography and controls, hero asset will be generated separately. Clear practical spacing, very large typographic hierarchy, airy asymmetric composition. All text sharp, readable. No fake metrics.

**Workbench concept:**

> Use case: ui-mockup. ShellForge — The Command Workshop complete desktop command workbench design specification, 1536x1024. Same coherent high-end technical editorial visual identity: warm bone #eeeae2, charcoal #232522, copper #a14f32, fine gray rules, large contrasting serif headings and readable small grotesk/monospace controls. No generic card grid, no pills, no gradients. Header ShellForge wordmark and The Forge / X-Ray / Field Manual / The Bench. Page large serif headline 'Put intent to work.' with small right text 'A proposal, never an execution.' Below a spacious natural-language text area, label '01 / Describe the operation', entered request 'Find files larger than 100 MiB in the current directory', OS dropdown 'GNU/Linux · Bash', rectangular dark 'Forge command ↗' button. Below a single dark editor region left 65% width and warm inspector right 35%. Editor header '02 / Command proposal' and 'Copy command'; command individual spaced tokens 'find . -type f -size +100M' in a beautiful light monospace, copper highlighted '+100M'. Bottom of editor show structured intent Operation Find / Target Regular files / Condition Greater than 100 MiB / Scope Recursive. Inspector label '03 / Understand & review'; selection heading '+100M'; clear plain text 'Greater than 100 MiB. GNU find rounds size up in 1 MiB blocks.' Below thin separated rows 'Bash syntax / Valid', 'Static policy / Allowlisted', 'Execution / Disabled'. Footnote 'Syntax does not prove intent. Review before running.' Spacious calm editorial instrument, angular layout no rounded cards. Show lower page clear assumptions accordion and new request link. High quality complete primary screen with readable UI and deliberate visual hierarchy. All controls will be code native.

## Components and licenses

- Chapter rail adapts the selection/spring pattern from
  [Rare UI Rail TOC](https://github.com/swamimalode07/rare-ui/blob/main/components/ui/rail-toc.tsx),
  Copyright (c) 2026 Swami Malode. The source attribution, full MIT + Commons Clause +
  Attribution license in `apps/web/licenses/rare-ui.txt`, and visible linked footer
  credit are retained. This is application use, not component resale/republication.
  Published registry requires Motion and a class utility; the reduced adaptation
  uses Motion alone and native CSS, avoiding a component framework installation.
- [Bencho](https://bencho.dev/blocks/resizable-panels) was an interaction reference.
  No source was copied. Full reuse terms/source access were not verified, so the
  resizing, token reveal and mobile controls are original implementations.
- Motion for React (MIT) is the single animation runtime. React/Next.js (MIT) provide
  the application. Package notices remain in the dependency distribution.
- Instrument Serif, Manrope and IBM Plex Mono are served from Fontsource packages.
  Their SIL Open Font License notices are retained under `apps/web/licenses/`.

See `DESIGN.md` for reference behavior actually inspected and original adaptations.

## Revision 3 assets

The user requested replacement of the first visual direction. Built-in ImageGen
produced three fresh, separately readable screen/section concepts, retained as
`concepts/landing-v3.webp`, `concepts/workbench-v3.webp`, and `concepts/precision-v3.webp`.
They specify graphite/acid kinetic typography, the command instrument and the
precision/transformation chapters. The prompts explicitly required native HTML
controls, the existing five-route information architecture, real GNU find semantics,
no invented metrics, no fake generation, and no generic card grids or glow effects.

The new production asset is `apps/web/public/artwork/graphite-material.webp`, generated
with the built-in tool, then resized/encoded locally. It is mapped onto independently
animated native command plates; no UI text is rasterized. The earlier sculpture is
retained as an unused historical asset.

Material prompt:
> Use case stylized-concept. Production texture asset for ShellForge kinetic command plates. Orthographic straight-on completely flat seamless surface sample of dark graphite anodized machined aluminum. Entire image filled with near-black #1c211c brushed aluminum, very fine horizontal machining grain, subtle realistic fine etched hairline scratches and metal microtexture, light catches irregular brushed grain at low contrast. Uniform neutral overhead lighting, no perspective, NO objects, NO borders, NO screws, NO text, NO logo, NO gradients, NO vignette, no strong speckles. This will be mapped onto separate CSS 3D typographic slabs, so make a tileable neutral material, sophisticated high fidelity industrial material texture, dark and restrained enough for white text overlay. Square1024x1024.

## Interactive laboratory studio direction (2026-10-22)

The user's Scribo screenshots were inspected as composition/palette references.
No Scribo photography, logo, illustration, HTML or source was copied.

Built-in ImageGen generated these original assets (no stock provider):

- `public/artwork/terminal-studio.webp`: transparent evergreen terminal sculpture,
  pink/yellow folders, cobalt paper orbit, ink loop and orange asterisk. Prompt:
  “Original ShellForge production artwork, transparent background. A beautiful
  tactile paper/ceramic 3D dark evergreen terminal sculpture with an inset >_
  glyph, behind it one pink and one golden yellow file folder, composition on a
  soft cobalt irregular oval paper cutout. Thin ink hand drawn orbital loop and
  small orange asterisk integrated. Sophisticated creative developer studio style,
  warm analogue grain, soft studio lighting, generous transparent margin, three
  quarter view, consistent palette #073F34 #096447 #F8CA39 #F277AD #7399F3. No
  keyboards, robot, human, logos or words; only >_ glyph.” Converted from RGBA PNG
  to 1100×733 WebP, approximately 114 KiB; alpha preserved.
- `concepts/studio-direction.webp`: complete landing and lab design study.
- `concepts/model-lab-direction.webp`: complete Model Studio, lab entrance and
  mobile focus study. Concepts are visual references, not research evidence.
  Their illustrative outputs and invented file trees were deliberately excluded.
- Favicon, file-token collage, permission-bit graphic, Gantt illustration and
  command fragments are original code-native graphics. Their interactive versions
  use real state. The fonts retain the existing OFL licensing.

Interaction research: Apple’s focused visual hierarchy, Francesca Marconi’s
editorial pacing, Rare UI’s spring-based hierarchy, and Bencho’s explicit
press/drag state changes informed original components. No new third-party code
or artwork was copied. The Onlines URL failed the current web fetch; earlier
inspection notes are retained. Existing Rare UI license notices remain for the
historical ChapterRail component, which is no longer rendered in the new landing.

Fidelity review checked cream/evergreen color, expressive heading/mono pairing,
terminal material and crop, asymmetric three-world composition, and native tool
readability. Intentional deviations from generated concepts: actual fixture
paths and counts, actual saved predictions, no “run with confidence” claims,
exact permission semantics, and a full 0–100% accuracy scale. Browser renders,
not the concept images, are the implementation evidence.

## Almost Right Lab (2026-10-22)

The current cream/evergreen visual language was retained. The new file artifacts,
dossier covers, command split, hypothesis tray, event loupe and witness controls
are original native HTML/CSS/Motion components. No third-party component source was
copied and no additional runtime package was installed. Existing MIT/OFL notices
and earlier source acknowledgments remain applicable.

Built-in ImageGen produced `public/artwork/almost-right-evidence.webp`, a transparent
1000×667 WebP. Original prompt:

> Original transparent production illustration for ShellForge The Almost Right Lab.
> Same tactile sculptural creative studio material family: deep evergreen ceramic
> folder open like a miniature evidence case, warm cream folded sheets, a golden
> yellow magnifying lens with a pink rim hovering over one tiny
> orange plus-shaped physical glyph on a strip of green paper. Subtle cobalt paper
> tab, thin dark ink curved connector. No text, no numbers, no logos, humans, robots
> or keyboard. Technical but playful, editorial museum of Linux mistakes, elegant
> high-quality soft studio light and fine paper grain, 3/4 isometric view, restrained
> organic composition, isolated on genuinely transparent background, generous margin.
> All critical command and file data will be native HTML outside this art.

Encoded locally from the generated RGBA PNG; transparency preserved. The artwork
is decorative; it contains no fabricated research or simulator evidence.

Current primary references inspected: [Onlines](https://onlines.com.ar/),
[Francesca Noemi Marconi](https://www.francescanoemimarconi.it/),
[Bencho](https://bencho.dev/), [Rare UI](https://rareui.com/),
[Motion shared-layout documentation](https://motion.dev/docs/react-layout-animations),
and [GSAP Flip documentation](https://gsap.com/docs/v3/Plugins/Flip/). Editorial
pacing, press/focus state changes and spatial continuity informed the design.
The existing Motion dependency implements transitions; GSAP was not added.
Onlines was accessible during this inspection, superseding the earlier failed fetch
note for this round. No reference artwork or restricted component source was copied.
