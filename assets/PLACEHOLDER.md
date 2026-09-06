# Placeholder asset registry

PRD §11.5 / QFD A8. Everything below is currently generated geometry, flat
colour, or synthesized audio. Art never blocked Phases 1–6, which is the point.

**Exception (PRD AR-7):** Froggy's art is *not* a placeholder. His wrongness is
a mechanic and a grey rectangle cannot carry it. He is drawn as
resolution-independent vector paths in [`src/froggy/froggy.ts`](../src/froggy/froggy.ts)
and consumed by both engines from that one source — a Phaser overlay canvas in
2D, a `CanvasTexture` in Three. He is finished, not deferred.

---

## Visual

| Asset | Intended dims | Currently | Where |
|---|---|---|---|
| Arcade exterior, dusk | 320×180 | generated rects | `src/art/exterior.ts` |
| Arcade exterior, night | 320×180 | same painter + `nightify()` | `src/art/exterior.ts` |
| Hub room, carpet, walls | 320×180 | generated rects, seeded scatter | `src/art/hubRoom.ts` |
| Hub room, dark | 320×180 | same painter, `night: true` | `src/art/hubRoom.ts` |
| Cabinet ×7 | 32×48 | rects + tweened marquee | `src/art/cabinet.ts` |
| Player character | 32×32 | 4 rects | `src/art/player.ts` |
| Prize icons ×5 | 24×24 | flat colour swatches | `src/scenes2d/PrizeCounter.ts` |
| Kid NPC | 32×32 | 3 rects | `src/scenes2d/ExteriorNight.ts` |
| Basement frames 1–10 | 320×180 | generated perspective geometry | `src/art/basementFrames.ts` |
| Chase corridor textures | 512×512 | flat Lambert colours | `src/scenes2d/Chase3D.ts` |
| Outro street | — | primitive boxes | `src/scenes2d/OutroCutscene3D.ts` |
| Title logo | 190×30 | browser monospace | `src/scenes2d/StartScreen.ts` |
| Pixel font | 8px bitmap | browser monospace at `resolution: 1` | `src/core/ui.ts` |

**Note on the 32-colour limit (AR-3):** the palette in
[`src/render/palette.ts`](../src/render/palette.ts) defines exactly 32 world
colours and every painter draws from it. Alpha blending in the placeholder art
produces intermediate values on screen, so the automated palette-count check
(PRD DV-4) is deferred to the art pass, when flat sprites replace the blends.

## Audio

All ~23 sfx and both music loops are WebAudio-synthesized in
[`src/core/audio.ts`](../src/core/audio.ts). They are real enough to test the
three buses, the 800 ms crossfade and — most importantly — the silence
contract, which is asserted as *zero instantiated sources* rather than a
volume of zero.

`audio.registerAsset(id, url, bus, loop)` is the seam: register a real file
against an id and the placeholder for that id is never constructed again.

| Bus | Ids |
|---|---|
| music | `theme_arcade`, `hub_lofi` |
| sfx (ambience) | `street_dusk`, `neon_buzz`, `cabinet_bleeps`, `crowd_hum`, `crickets`, `wind_low`, `car_passby` |
| sfx (one-shots) | `ui_blip`, `ui_hover`, `dialogue_blip`, `coin_spin`, `coin_drop`, `buzzer`, `chime`, `bell_ding`, `footstep_carpet`, `footstep_concrete`, `door_open`, `door_shut`, `lock_click`, `door_rattle`, `door_creak`, `drip`, `bulb_flicker`, `vault`, `whack`, `stinger`, `death_stinger`, `hop_wet`, `ticket_machine` |

Two placeholders stand in for sounds that need real recordings: the chase's
heavy breathing currently borrows `footstep_carpet`, and `hop_wet` is filtered
noise rather than anything actually wet.
