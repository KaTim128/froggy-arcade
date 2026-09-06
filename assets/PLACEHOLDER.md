# Placeholder asset registry

PRD §11.5 / QFD A8. Every asset still rendered as flat rectangles, generated
geometry or synthesized audio. Art must never block Phases 1-6.

**Exception (PRD AR-7):** Froggy's V0 art is a Phase 2 deliverable, not a
placeholder. His wrongness is a mechanic; a grey rectangle cannot carry it.
He is drawn as resolution-independent vector paths in `src/froggy/froggy.ts`.

## Visual

| Asset | Intended dims | Currently | Phase |
|---|---|---|---|
| Arcade exterior (dusk) | 320x180 | generated rects, `src/art/exterior.ts` | 7 |
| Arcade exterior (night) | 320x180 | same painter + palette transform | 7 |
| Hub room / carpet / walls | 320x180 | generated rects, `src/art/hubRoom.ts` | 7 |
| Cabinet sprites x6 | 32x32 | rects + marquee text | 7 |
| Player character | 32x32 | 4 rects, `src/art/player.ts` | 7 |
| Prize icons x5 | 24x24 | rects | 7 |
| Kid NPC | 32x32 | rects | 7 |
| Basement frames 1-10 | 320x180 | generated geometry | 7 |
| Chase corridor textures | 512x512 | flat colours | 7 |
| Title logo | 190x30 | monospace text | 7 |
| Font | 8px bitmap | browser monospace | 7 |

## Audio

All ~45 sfx and both music loops are currently WebAudio-synthesized placeholders
in `src/core/audio.ts`. `audio.registerAsset(id, url, bus)` is the seam where
real files land. See PRD §12.2 for the full list.
