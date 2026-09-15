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
| Cabinet ×21 | 26×36 | rects: side art, bezel, motif, marquee letters, stick and buttons | `src/art/cabinet.ts` |
| Player character | 32×32 | 4 rects | `src/art/player.ts` |
| Prize models ×14 shapes | 24×24 | rectangles per shape (duck, bear, lamp, guitar, console…) | `src/scenes2d/PrizeCounter.ts` |
| Cabinet screen motifs ×16 | 18×14 | rectangles per motif, one per game | `src/art/cabinet.ts` |
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

All the sfx and every music loop are WebAudio-synthesized in
[`src/core/audio.ts`](../src/core/audio.ts). They are real enough to test the
three buses, the 800 ms crossfade and — most importantly — the silence
contract, which is asserted as *zero instantiated sources* rather than a
volume of zero.

`audio.registerAsset(id, url, bus, loop)` is the seam: register a real file
against an id and the placeholder for that id is never constructed again.

| Bus | Ids |
|---|---|
| music | one preset per room and per cabinet in [`src/core/tracks.ts`](../src/core/tracks.ts) — `theme_arcade`, `hub_lofi`, `room_hub`, `room_annex`, `room_casino`, and a `game_*` tune for every cabinet. **Dance Off carries three**: `game_danceoff`, `game_danceoff_2` and `game_danceoff_3`, one per round of the match, each a tempo up on the last — the chart is cut to the round's bpm, so replacing one of these with a recording means matching its tempo. The Flood has `game_flood`, and the four newest cabinets have `game_pinball`, `game_findthefrog`, `game_frograce` and `game_poker`. |
| sfx (ambience) | `street_dusk`, `neon_buzz`, `cabinet_bleeps`, `crowd_hum`, `crickets`, `wind_low`, `car_passby` |
| sfx (one-shots) | `ui_blip`, `ui_hover`, `dialogue_blip`, `coin_spin`, `coin_drop`, `buzzer`, `chime`, `bell_ding`, `footstep_carpet`, `footstep_concrete`, `door_open`, `door_shut`, `lock_click`, `door_rattle`, `door_creak`, `drip`, `bulb_flicker`, `vault`, `whack`, `stinger`, `death_stinger`, `hop_wet`, `ticket_machine` |
| sfx (the throwing match) | `throw_whoosh`, `item_thud`, `boom`, `heal_up`, `poison_hiss`, `fence_thunk` |
| sfx (the casino wheel) | `wheel_tick` |

Two placeholders stand in for sounds that need real recordings: the chase's
heavy breathing currently borrows `footstep_carpet`, and `hop_wet` is filtered
noise rather than anything actually wet.
