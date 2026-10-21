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
