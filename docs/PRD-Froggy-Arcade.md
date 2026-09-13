# Product Requirements Document — *Froggy Arcade*

**Document:** PRD-FA-001
**Revision:** 1.0
**Date:** 2026-09-07
**Owner:** KaTim128
**Derived from:** [QFD-FA-001](QFD-Froggy-Arcade.md)
**Status:** Approved for Phase 1

> **How to read this with the QFD.** The QFD decides *what matters and why*. This PRD decides *what gets built*. Every requirement below carries a `[QFD: …]` tag pointing at the customer requirement or technical characteristic it satisfies. If the two documents ever disagree, the QFD's two hard constraints win: **Froggy is the only non-pixel element**, and **the post-break-in arcade is totally silent**.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Goals, Non-Goals & Success Criteria](#2-goals-non-goals--success-criteria)
3. [Audience & Player Personas](#3-audience--player-personas)
4. [Design Pillars](#4-design-pillars)
5. [The Player Journey (Full Gameplay Walkthrough)](#5-the-player-journey-full-gameplay-walkthrough)
6. [Core Systems](#6-core-systems)
7. [Scene Specifications](#7-scene-specifications)
8. [Froggy — Character Specification & Full Script](#8-froggy--character-specification--full-script)
9. [Minigame Specifications](#9-minigame-specifications)
10. [Economy Design & Simulation](#10-economy-design--simulation)
11. [Art Direction](#11-art-direction)
12. [Audio Direction & Asset List](#12-audio-direction--asset-list)
13. [Technical Architecture](#13-technical-architecture)
14. [Dev Instrumentation](#14-dev-instrumentation)
15. [Edge Cases & Failure Handling](#15-edge-cases--failure-handling)
16. [Milestones & Phase Gates](#16-milestones--phase-gates)
17. [Acceptance Criteria](#17-acceptance-criteria)
18. [Out of Scope](#18-out-of-scope)
19. [Open Questions](#19-open-questions)

---

## 1. Product Overview

**Froggy Arcade** is a single-player browser game, roughly **25–40 minutes** for a full run, that presents itself as a cozy 2D pixel-art arcade sim and is actually a horror game.

The player has **$10**, converted to **20 froggy-tokens**. They spend those tokens on six arcade minigames, hoping to accumulate the tokens needed for the cheapest prize — which they intend to sell to a kid outside for real cash. There is no way to earn more money. When the tokens run out, the arcade's cheerful mascot gives them ten more. When those run out too, he stops smiling and has them removed.

The horror unlocks only if the player, now outside and broke at night, chooses to break back in through the alley door.

**Platform:** desktop browser (Chrome / Firefox / Edge / Safari, current − 1).
**Resolution:** 320×180 internal, integer-scaled and letterboxed to 1280×720 and beyond.
**Stack:** Vite + TypeScript · Phaser 3 (all 2D) · Three.js (two 3D sections) · Howler.js (audio) · no backend, `localStorage` only.

**Player fantasy:** *You're homeless. You found $10 on the street. You spend it all at an arcade hoping to win a prize you can sell to a kid outside for real cash.*

---

## 2. Goals, Non-Goals & Success Criteria

### 2.1 Goals

| # | Goal | QFD trace |
|---|---|---|
| G1 | Deliver a tone flip a first-time player does not see coming | T1, T4 |
| G2 | Make economic failure the mechanism that unlocks the story | T3, E1, E4 |
| G3 | Ship six minigames that are genuinely playable, not vignettes | M1, M2 |
| G4 | Make the mascot the source of unease *before* he is the source of fear | T2, H8 |
| G5 | Use silence, not stingers, as the primary horror instrument | T5 |
| G6 | Give the player a real, unpunished way to walk away | T6 |
| G7 | Ship a complete non-horror "good" ending for players who beat the economy | E5 |

### 2.2 Non-Goals

- **No multiplayer, no accounts, no backend, no leaderboards.**
- **No procedural generation.** Every scene is authored.
- **No difficulty settings.** The economy *is* the difficulty. Payout scaling exists behind a debug flag only (§10.4).
- **No mobile or touch support** in v1. Desktop keyboard + mouse.
- **No branching dialogue.** Froggy talks; the player listens.
- **No inventory system** beyond `prizesOwned: string[]`.
- **We are not trying to out-jumpscare *FNAF*.** One planned scare, plus one death scare. That is the entire budget. `[QFD: §10 benchmarking]`

### 2.3 Success Criteria

| # | Criterion | Measure |
|---|---|---|
| S1 | Blind playtesters do not predict the horror turn | ≥ 80% of first-time testers report surprise at the second bust |
| S2 | Players sense something is off about Froggy without being able to name it | ≥ 50% mention Froggy unprompted afterwards; < 20% correctly identify "he isn't pixel art" |
| S3 | The chase is fair | ≥ 80% of players who know the route escape; ≥ 70% of blind players die at least once |
| S4 | The economy bites | Median run reaches the first bust in 4–8 minutes |
| S5 | Nobody quits during the basement | < 10% quit rate across frames 1–10 |

---

## 3. Audience & Player Personas

**Primary audience:** players of short narrative horror and "cozy game that isn't" itch.io / Steam titles. Comfortable with mouse + keyboard, expects a 30-minute sitting, plays with sound on.

| Persona | Behaviour | Design implication |
|---|---|---|
| **The Grinder** (~20%) | Plays every minigame carefully, tries to reach the shelf | The prize path must be *real* and the kid must actually pay out (§7.11) |
| **The Rusher** (~45%) | Mashes the expensive cabinets, goes broke in three minutes | The hub must not require exploration to find cabinets; the tutorial must be short |
| **The Reader** (~25%) | Reads every line, rings the bell, clicks everything | The bell, the unattended counter and the blank stare pay off for this player and nobody else |
| **The Coward** (~10%) | Takes the `LEAVE` exit | Their ending must be quiet and unmocked — no "are you sure?", no shaming |

---

## 4. Design Pillars

Four pillars, inherited from the QFD's weighted requirements. Any feature that serves none of them is cut.

### P1 — *Nothing before the break hints at the horror.* `[QFD: T1, T4, FMEA #1]`

Cheerful music, warm palette, friendly mascot, working games. Only five pieces of foreshadowing are permitted: (a) Froggy's non-pixel rendering, (b) his idle animation stopping on tutorial line 6, (c) the Whack-a-Frog cameo, (d) the bell nobody answers, (e) the unattended counter. All five are invisible on a first pass and obvious on a second. **Nothing else.**

### P2 — *The economy is the story.* `[QFD: E1–E4, T3]`

Going broke is not a fail state, it is the plot. The token ledger and the broke-latches are narrative devices with a numeric interface, and they get the same engineering rigour as the chase.

### P3 — *Froggy is the only wrong thing.* `[QFD: T2, H8, C6 — rank #1]`

The world is strictly 32-colour, 320×180, NEAREST-filtered. Froggy is smooth vector art on an unfiltered overlay. He is the same character in the tutorial and in the chase — recognition is the horror. `[QFD: §11.3]`

### P4 — *Silence carries the second half.* `[QFD: T5, C3]`

After the break-in there is no music, no drone, no ambience. Footsteps only. Zero audio sources are *instantiated*, not merely muted. Adding atmosphere here would make the game worse.

---

## 5. The Player Journey (Full Gameplay Walkthrough)

The intended minute-by-minute experience of a median blind player. Times are targets, not limits.

### Act I — The Arcade (0:00 – 8:00)

**0:00 — Start screen.** Arcade exterior at dusk. Neon frog sign buzzing and flickering, warm light spilling onto a wet sidewalk, a moth looping the sign, two parked cars. `START` / `SETTINGS`. The player either dives in or opens Settings and reads the controls manual.

**0:20 — Intro cutscene.** A short side-on walk: the player character crosses the sidewalk, pauses at the door, pushes in. A `$10 → 20 TOKENS` transaction plays as a small pixel animation at the change machine. This is the only money the game will ever give them.

**0:50 — Tutorial.** Froggy hops in. He is smooth, clean, and slightly too well-drawn for the room. He walks the player past the six cabinets, the token counter and the prize case in seven lines. On line 6 — *"One rule, friend. Don't lose all your tokens."* — his idle animation stops dead, with half a second of hold on either side. Then he bounces away, cheerful again. `[QFD: T4, FMEA #1]`

**1:30 — First game.** Almost always an Easy cabinet (1 token). Win or lose, the HUD coin-spins. They play again.

**2:00–6:00 — The grind.** With 20 tokens and a 2× payout on every tier, most players trend downward. The Rusher tries a Hard cabinet early and loses a quarter of their bankroll in ninety seconds. The Grinder farms Tic-Tac-Toe at 1-in/2-out. The prize case shows a keyring at forty tokens and a Stuffed Bunny at a hundred, which by now looks like a long afternoon.

**~5:00 — Somewhere in here:** the player rings the handbell at the unattended prize counter. Nothing happens. They ring it again. Nothing happens. Ever. `[QFD: VOC-18]`

**~5:30 — Possibly:** a Whack-a-Frog session throws up one smooth, non-pixel Froggy among the pixel frogs. Whacking him does nothing — he stares for 1.2 seconds and goes back down, and the hit doesn't count. The player assumes it's a bug. `[QFD: M5]`

**6:00 — First bust.** Tokens hit 0. Froggy appears: *"Aw, tapped out already? Don't sweat it. Ten tokens, on the house. Because I like your face."* `+10 tokens`, cheerful chime. The player feels lucky. `[QFD: E3]` (Five was the original figure and it bought a single medium go: one loss and the player was back on zero and out of the building, which made the second chance a formality. Ten is a few goes, so what happens next is something they did.)

**7:00 — Second bust.** Ten tokens buys a handful of Easy games or three Mediums. It still goes.

The music **cuts** — not fades. The cabinet bleeps stop. The lights drop 30%.

> "Oops. Looks like you're all out of froggy-tokens."
>
> *(three seconds of nothing — no animation, no sound)*
>
> "You can go now."

The player character is walked to the door by nothing visible. The door shuts. Cut to black. `[QFD: E4, T1]`

### Act II — Outside (8:00 – 10:00)

**8:00 — Exterior, night.** The same illustration as the start screen, transformed: sign dead, windows black, `CLOSED` hanging in the door, streetlight buzzing, rain stopped, palette desaturated ~70% and shifted blue. Crickets, and a car passing every twenty seconds or so. No music. `[QFD: P2]`

Four things to try:

- **Front door** — a locked-handle rattle, three times, then the character mutters something small and sad. It will never open again. `[QFD: AC-4]`
- **The kid** — under the streetlight, holding crumpled bills. With a prize: *"…is that a real one? …Okay. Okay, yeah."* Cash, and the **good ending**. Without: *"You didn't win anything? …I'll wait."*
- **`LEAVE`** — an exit arrow on the left edge. Ends the game quietly with a "you went home" card. No punishment, no mockery, no achievement. `[QFD: T6]`
- **The alley** — right edge, barely lit. Dumpster, fire escape, and a **back door, ajar, a sliver of black behind it.**

**9:30 — The choice.** Nothing pushes the player through that door. No prompt escalates, no NPC suggests it. They go in because they're broke and they want the prize.

### Act III — Inside, Dark (10:00 – 12:00)

**10:00 — The silence.** The hub layout the player spent eight minutes in, now unlit. Cabinets are silhouettes. Moonlight through the front windows. **No music, no ambience, no hum. Footsteps only.** `[QFD: T5, P4]`

The front door won't open from the inside either. The prize case is locked glass: `IT NEEDS A KEY.` The player can now **climb over the cashier counter** — the interaction that was never offered while the arcade was open.

Behind the counter, a door marked `STAFF`. Unlocked. It leads down.

### Act IV — The Basement (12:00 – 15:00)

Ten static pixel images, advanced by clicking arrow hotspots. A footstep-on-concrete on every click, a 600 ms crossfade between frames. No HUD. No music. The pacing is deliberately, uncomfortably slow. `[QFD: H1]`

Stairs. Corridor. Corridor again, subtly longer. A room with one wooden chair facing away. A door.

**Frame 5:** another corridor. Far down it, maybe twelve pixels tall, near the background colour: **a frog-like shape with a single visible eye.** Unlit. Unanimated. Most players will not be sure they saw anything. `[QFD: H2]`

**Frame 6:** the end of the corridor. A plain door. The figure is gone. The game never acknowledges it.

**Frame 7:** a small empty room. A dim bulb on a cord, and a **key hanging from the cord.**

**Frame 8:** on pickup, `hasKey = true`, and the bulb flickers hard. On the back wall, visible **only** in the flicker frames: **TURN AROUND.** `[QFD: H3]`

**Frame 9:** the view reverses. Nothing is there. Just the door. Input is taken away and the game holds for **four full seconds.**

**Frame 10:** the camera snaps back. **Froggy fills the frame** — full-screen, smooth, non-pixel, rendered too large and too clean for anything else in the game. Hard cut, loud stinger, three-frame shake. `[QFD: H4]`

Black for half a second.

### Act V — The Chase (15:00 – 17:00)

First-person 3D. The slideshow corridors, now real geometry, run in reverse. Fog at 12 m, a flashlight cone, headbob, heavy breathing.

Froggy moves at **exactly half the player's speed** and never stops, never accelerates. He cannot outrun the player. He can only outlast a player who gets lost — and there are two dead-end forks that look like the right way. The route is ~110 m; a clean run is under 30 seconds, a panicked one 60–90. `[QFD: H5, H6, H7]`

He stays out of the flashlight cone. The player mostly knows where he is from the **wet hopping sound**, which grows as he closes. `[QFD: C4]`

Up the stairs, through the dark arcade, out the front door.

**If he touches the player:** death jumpscare, `YOU WERE EATEN`, full reset.

### Act VI — Out (17:00 – 17:45)

Third-person 3D. The player bursts through the front door and sprints down the street. The camera does not follow — it holds on the arcade entrance.

**Froggy stands in the doorway. He does not chase. He watches** until the player is out of frame, and then for three more seconds. `[QFD: VOC-33]`

Cut to black. Large centred pixel text: **End**

Fifteen seconds later the run's progress is wiped (settings kept) and the game returns to the start screen — where the arcade is warm and lit and the neon frog sign is buzzing again.

### 5.1 The other endings

| Ending | Trigger | Content |
|---|---|---|
| **Good — "The Sale"** | Redeem a prize (200+ tokens), leave, sell it to the kid | The kid pays cash. Card: *"You ate that night."* Reset after 15 s. The player never learns the arcade has a basement. |
| **Quiet — "You Went Home"** | Take the `LEAVE` exit on the night exterior | Fade to a plain card: *"You went home."* Reset after 15 s. No score, no judgement. |
| **Death** | Froggy touches the player in the chase | Death jumpscare → `YOU WERE EATEN` → full reset to Boot |

---

## 6. Core Systems

### 6.1 Game state `[QFD: A3 — rank #2, 7.2%]`

Single store, single writer, persisted under **two separate namespaces** so the 15-second reset can wipe progress and keep settings. `[QFD: FMEA #11]`

```ts
// localStorage "froggy.run"   — wiped on reset
// localStorage "froggy.prefs" — survives reset
type GameState = {
  schemaVersion: 1;
  tokens: number;                        // 0..n, never negative
  charityUsed: boolean;                  // one-shot latch
  prizesOwned: string[];                 // prize ids
  gamesPlayed: Record<GameId, number>;   // launches, not wins
  route: 'normal' | 'ejected' | 'basement' | 'chase' | 'ended';
  hasKey: boolean;
  seenIntro: boolean;
  settings: {
    master: number;                      // 0..100
    music: number;                       // 0..100
    sfx: number;                         // 0..100
  };
};

type GameId =
  | 'tictactoe' | 'fallingblocks' | 'airhockey'
  | 'hoops' | 'whack'
  | 'chompman' | 'grudge';
```

| # | Requirement |
|---|---|
| ST-1 | All reads and writes go through the store. No scene mutates `GameState` fields directly. `[QFD: FMEA #3]` |
| ST-2 | Writes debounce to `localStorage` at 250 ms; a scene transition forces an immediate flush. |
| ST-3 | Missing or corrupt `froggy.run` yields a fresh default state, never a crash. |
| ST-4 | `schemaVersion` mismatch → discard run state, keep prefs, log a warning. |
| ST-5 | Reset deletes `froggy.run` and leaves `froggy.prefs` untouched. `[QFD: AC-9]` |

### 6.2 Token ledger `[QFD: B1 — rank #3, 7.0%]`

The only path by which `tokens` changes. Narrative gating depends on it being exact.

```ts
interface TokenLedger {
  balance(): number;
  canAfford(n: number): boolean;
  debit(n: number, reason: LedgerReason): boolean;  // false if insufficient
  credit(n: number, reason: LedgerReason): void;
  onChange(cb: (next: number, prev: number, reason: LedgerReason) => void): void;
}

type LedgerReason =
  | 'seed'          // the $10 -> 20 tokens at intro
  | 'game.cost'     // minigame launch
  | 'game.reward'   // minigame win
  | 'game.refund'   // a tie: the entry cost handed straight back (MG-9)
  | 'charity'       // Froggy's five
  | 'prize';        // redemption
```

| # | Requirement |
|---|---|
| TK-1 | Balance can never go below 0. `debit` returns `false` and changes nothing if unaffordable. |
| TK-2 | Cost is debited **on launch**, before the minigame scene starts, except at a free-to-enter fixture (MG-10) where it is raised inside the game instead. Reward is credited **on win**, in the completion callback. `[QFD: M3]` |
| TK-3 | `Esc` quit forfeits the entry cost. The only refund in the API is `api.draw()` (MG-9), which is not a quit path: it hands the stake back once, for a game that ended level, and is unreachable from the quit button. Where nothing was staked — a free fixture walked away from — there is nothing to forfeit and nothing to refund. |
| TK-4 | Every `onChange` drives the HUD animation within 100 ms. `[QFD: B8]` |
| TK-5 | A lint rule forbids `state.tokens =` outside `TokenLedger`. `[QFD: FMEA #3]` |
| TK-6 | The ledger emits `broke` when the balance transitions to exactly 0. |

### 6.3 Broke detector & one-shot latches `[QFD: B2 — rank #6, 6.2%]`

```
balance === 0  AND  route === 'normal'
  ├─ charityUsed === false → FroggyCharity: credit(5,'charity'), charityUsed = true
  └─ charityUsed === true  → SecondBust → EjectionCutscene: route = 'ejected'
```

| # | Requirement |
|---|---|
| BR-1 | The check fires on the `broke` event **and** on entry to `ArcadeHub` — covering the case where the last token went on a game the player then quit. |
| BR-2 | Charity fires **exactly once per run**, guaranteed by the latch, not by scene bookkeeping. `[QFD: E3, AC-3]` |
| BR-3 | The check never fires while a minigame is active; it defers until the player is back in the hub, so no cutscene interrupts play. |
| BR-4 | Once `route === 'ejected'`, the hub is unreachable for the rest of the run. |

### 6.4 Route state machine & guards `[QFD: A2 — rank #7, 5.6%]`

`canEnter(scene, state)` is a single pure predicate. There is no other gate. `[QFD: AC-6]`

| Scene | Enterable when |
|---|---|
| `StartScreen` | always |
| `IntroCutscene` | `route === 'normal' && !seenIntro` |
| `ArcadeHub` | `route === 'normal'` |
| any `Minigame` | `route === 'normal' && canAfford(cost)` |
| `PrizeCounter` | `route === 'normal'` |
| `ExteriorNight` | `route === 'ejected'` |
| `BackDoor` / `ArcadeDark` | **`route === 'ejected'`** |
| `BasementSequence` | `route === 'basement'` |
| `Chase3D` | `route === 'chase'` |
| `OutroCutscene3D` / `EndCard` | `route === 'ended'` |

Advances: `normal → ejected` (ejection) → `basement` (STAFF door) → `chase` (jumpscare) → `ended` (escape).

**RG-1:** a unit test enumerates every (scene × route) pair and asserts zero illegal transitions are reachable. `[QFD: §9 A2]`

### 6.5 Scene manager & renderer lifecycle `[QFD: A1, A4]`

| # | Requirement |
|---|---|
| SM-1 | One Phaser instance and one Three.js renderer, both mounting into `#game-root`. Exactly one is active. `[QFD: VOC-05]` |
| SM-2 | On transition the outgoing renderer is fully torn down — contexts released, RAF cancelled, listeners removed — before the incoming one is constructed. Swap ≤ 400 ms, 0 leaked contexts over 20 swaps. |
| SM-3 | Phaser runs a fixed 320×180 logical canvas scaled by an **integer factor only** (×1…×6) with letterbox bars. Never stretched, never fractional. `[QFD: P1, P5]` |
| SM-4 | Froggy renders to a **separate, unfiltered overlay canvas above the scaled buffer**, never through the 320×180 target. `[QFD: §8.2 — the C5⇄C6 conflict, the single most important architectural decision in the project]` |
| SM-5 | Transitions are fade out (300 ms) → teardown → build → fade in (300 ms), except the two hard cuts (jumpscare, death), which are single-frame. |

### 6.6 Audio manager `[QFD: C1, C2, C3]`

Three Howler buses — `master`, `music`, `sfx` — each 0–100, persisted to `froggy.prefs`, wired to the settings sliders.

```ts
type SceneAudio = {
  music?: string;        // loop id, or omitted
  ambience?: string[];   // loop ids
  // A scene declaring neither is silent — and instantiates nothing.
};
```

| # | Requirement |
|---|---|
| AU-1 | Every scene declares its `SceneAudio`; the manager crossfades between declarations over **800 ms ± 50 ms**. `[QFD: P4]` |
| AU-2 | **Silence contract.** In `ArcadeDark` and all basement frames the scene's audio source list length is **0** — not muted, not created. Asserted in test. `[QFD: T5, C3, AC-10, FMEA #6]` |
| AU-3 | Crossfading *into* silence completes before input is accepted, plus a ≥ 1 s hold of true silence. `[QFD: §8.2]` |
| AU-4 | Chase hop-audio gain is monotonic in Froggy's distance: audible at 20 m, dominant at 3 m. `[QFD: C4]` |
| AU-5 | Bus gains apply in every scene, including cutscenes and both 3D sections. `[QFD: AC-10]` |
| AU-6 | Slider changes apply live, without a scene reload. |

### 6.7 Input map `[QFD: B6]`

One exported object is the single source of truth; the in-game manual is **rendered from it**, so it can never drift. `[QFD: §8.1]`

| Action | Input | Context |
|---|---|---|
| Move | `WASD` / arrows | Arcade hub, dark arcade, 3D chase |
| Interact / select | `Left click` or `E` | Hub, exterior, dark arcade |
| Basketball charge | Hold `Spacebar` | Hoops |
| Fighter move / jump / crouch | `A` `D` / `W` / `S` | Grudge |
| Fighter punch / kick / block | `J` / `K` / `L` | Grudge |
| Fighter special | `I` | Grudge |
| Chomp-Man movement | Arrow keys | Chomp-Man |
| Advance basement frame | `Left click` on hotspot | Basement |
| Pause / back / quit game | `Esc` | Everywhere |
| Debug panel | `` ` `` | Dev builds only |

**IN-1:** no binding appears in more than one place in code.
**IN-2:** `Esc` inside a minigame forfeits the entry cost and returns to the hub with no confirmation dialogue.

### 6.8 HUD `[QFD: B8]`

Present in `ArcadeHub` and all minigames. **Absent in every Act III–VI scene.**

| Element | Behaviour |
|---|---|
| Token counter | Top-left; coin-spin animation on change, within 100 ms of the ledger event |
| Low-token state | At **≤ 3 tokens** the counter pulses red at 1 Hz |
| Cabinet cost badge | Floats over each cabinet: `1` / `3` / `5`; greys out when unaffordable |
| Interact prompt | `[E] PLAY — 3 TOKENS` on approach; greyed when unaffordable, and pressing `E` plays a buzzer |
| Minigame HUD | Score / timer / lives per game, plus a persistent `[ESC] QUIT` |

### 6.9 Debug panel `[QFD: A6]`

Toggle `` ` ``. Dev builds only; stripped from production by a Vite define.

- Set tokens · set `route` · toggle `hasKey`, `charityUsed`, `seenIntro`
- Jump to any scene, including individual basement frames
- Skip the basement · force win / force loss in the active minigame
- Toggle the **payout-scaling variant** (§10.4) · print state as JSON
- Chase debug view: draw Froggy's position and path through the fog

**DB-1:** 100% of scenes and every state field must be reachable from this panel.

---

## 7. Scene Specifications

Each scene lists purpose, entry, layout, interactions, audio and exits. Audio entries are the literal `SceneAudio` declaration.

### 7.1 Boot

| | |
|---|---|
| **Purpose** | Load the core atlas, wire the audio buses, hydrate state |
| **Entry** | App start, or a reset from `EndCard` |
| **Visual** | Black; a small frog silhouette and a pixel progress bar |
| **Audio** | *(none)* |
| **Exit** | `StartScreen` when loading completes and ≥ 800 ms have elapsed |

### 7.2 StartScreen `[QFD: §5]`

| | |
|---|---|
| **Purpose** | Establish the warm tone the second half destroys |
| **Visual** | Full-screen pixel illustration: arcade exterior at **dusk**. Neon frog sign, warm light on a wet sidewalk, two parked cars |
| **Animation** | Sign flicker (irregular, 0.1–4 s gaps) · a moth looping the sign on a lazy figure-eight · optional light rain |
| **UI** | Title **FROGGY ARCADE** in chunky pixel type with the mascot · `START` and `SETTINGS` buttons with a hover bounce and a bleep |
| **Audio** | `music: 'theme_arcade'`, `ambience: ['street_dusk','neon_buzz']` |
| **Exits** | `START` → `IntroCutscene` (or `ArcadeHub` if `seenIntro`) · `SETTINGS` → modal |

### 7.3 SettingsModal `[QFD: P3, AC-1]`

Two tabs, openable from `StartScreen` and from `Esc` in the hub.

- **AUDIO** — three sliders: Master / Music / SFX, 0–100, live-applied, persisted to `froggy.prefs`.
- **CONTROLS** — the §6.7 table rendered as a **pixel-art keycap diagram**, generated from the input map so it can never go stale.

**SET-1:** all three values survive a page reload. `[QFD: AC-1]`

### 7.4 IntroCutscene

| | |
|---|---|
| **Purpose** | Establish the fantasy and hand over the only money in the game |
| **Beats** | 1. Side-on street, the player character walks in from the left, stops under the sign, looks up. 2. Pushes the door; a bell jingles; interior warmth washes over the frame. 3. At the change machine: a `$10` bill goes in, **20 tokens** clatter out, the HUD counter fills to `20` with a coin-spin. |
| **Ledger** | `credit(20, 'seed')` — the only `seed` call that ever exists `[QFD: E1]` |
| **Audio** | Crossfade `theme_arcade` → `music: 'hub_lofi'`, `ambience: ['cabinet_bleeps','crowd_hum']` |
| **Skippable** | `Esc` skips to the end of the cutscene (still credits the tokens) |
| **Exit** | `ArcadeHub`, which immediately runs the tutorial if `!seenIntro` |

### 7.5 ArcadeHub `[QFD: §7]`

The main loop. A single room, 3/4 view, walked with WASD.

**Layout**

```
        ┌──────────────────────────────────────────┐
        │  [PRIZE CASE - glass]   [COUNTER + BELL] │   back wall
        │                                          │
        │  ▣ TIC-TAC-TOE (1)          ▣ HOOPS (3)  │
        │                                          │
        │            · player spawn ·              │
        │                                          │
        │  ▣ FALLING BLOCKS (3)      ▣ WHACK (3)   │
        │                                          │
        │  ▣ AIR HOCKEY (1)      ▣ CHOMP-MAN (5)   │
        │                                          │
        │  [change machine]        ▣ GRUDGE (5)    │
        │  ══════════ FRONT DOOR ══════════        │
        └──────────────────────────────────────────┘
```

| Element | Spec |
|---|---|
| **Cabinets** | Each is a box with side art in its own colour, a bezelled screen carrying a **motif** unique to that game (a grid, a maze, a ladder, reels…), a marquee with the machine's own letters on it, a control deck with a stick and three buttons, a coin slot, a speaker grille, a plinth, and a floating cost badge |
| **Dressing** | Hanging PLAY/WIN signs on chains, posters taped to the panelled back wall, wall vents and a sagging cable run, a strip light down the ceiling, a bin, a plant, carpet seams, scuffs and a painted ring on the floor — hung wherever the counter and the change machine are not |
| **Approach** | Entering a cabinet's trigger zone shows `[E] TITLE — n TOKENS`. Unaffordable → the badge greys, but the machine still opens: what a cabinet costs is on its how-to-play card, which is free to read, and PLAY is what charges (MG-2/MG-8). The two casino bet fixtures are the exception (MG-11) |
| **Prize counter** | Interactable; opens `PrizeCounter` (§7.6) |
| **The bell** | A small handbell with a sign: `RING FOR SERVICE`. Interacting plays a clean *ding* and **nothing else happens. Ever.** No variation, no eventual response — the line is now *"he does not look up"*, because there is somebody there to ignore it. `[QFD: VOC-18, §13.1 bell check]` |
| **The counter** | **Froggy stands behind it**, drawn on the unfiltered overlay (FR-1) and clipped to the counter's front edge so the wood cuts him off at the waist. He stands down while the dialogue box has him, since they share one canvas. The counter itself is **staff-side**: the player is pushed back out on the frame they enter the strip between it and the prize case, from either end, and the interact range still reaches across it from the customer's side. Climbing over it is **not** offered here — only in `ArcadeDark` |
| **Front door** | Interacting: *"…nah. Not yet."* The player cannot voluntarily leave during Act I |
| **Lighting** | Warm amber key, magenta neon rim, teal carpet with a chaotic 90s pattern |
| **Audio** | `music: 'hub_lofi'`, `ambience: ['cabinet_bleeps','crowd_hum']` |
| **On entry** | Run the broke check (BR-1) → tutorial if `!seenIntro` |

### 7.6 PrizeCounter `[QFD: B5, E5]`

**A shelf, not a spreadsheet.** Three shelves of three behind the glass, with
the thing itself standing on each one — a duck is a duck, a guitar is a guitar
— its price on the shelf edge above it and its name on the board below. The
whole slot is the button; there is no REDEEM column.

**Redeemed prizes leave the shelf.** The moment one is bought its slot empties:
bare board, no price, a gap where the thing was, and the same gap appears in
the case out on the hub's back wall. A counter that keeps showing what you
already own is lying about what it has.

**And the shelf refills.** When the last prize on it goes, the back room sends
out a fresh lot — different toys, different colours, the same price curve — so
a player who clears the counter has something to keep playing for instead of a
wall of OWNED. The wave is a number on the save (`prizeWave`) and the stock is
generated from it (`prizesForWave`), with each prize's id carrying the wave and
slot it came from, so anything in the bag can be rebuilt from its id and the
man outside will buy it. **The ending still counts the opening nine**
(`allPrizesSold`): the restock keeps the loop alive, it does not move the
finish line.

The cheap end stays cheap — a keyring at forty against a starting bankroll of twenty, so the counter is somewhere a player can actually reach — and then it climbs hard. Everything above the duck is a decision to keep playing rather than something you happen to be able to afford, and the whole shelf is **2,930 tokens**, which nobody clears by accident. Halving the list in an earlier pass made the shelf reachable but made clearing it a formality; this curve keeps the doorway and puts the far end back out of sight. The man outside still pays half of the counter's price (`cashFor`), so the sell-and-rechange loop keeps its shape at every rung.

| Prize | Cost | Notes |
|---|---|---|
| Frog Keyring | 40 | The cheapest thing in the room, and reachable in one good run |
| Sticker Pack | 70 | |
| Rubber Duck | 120 | |
| Bunny | 180 | The kid's target |
| Lava Lamp | 260 | |
| Skateboard | 360 | |
| Headset | 480 | |
| Guitar | 620 | |
| PS5 | 800 | Still the one at the end of the shelf; it exists to be looked at |

| # | Requirement |
|---|---|
| PC-1 | A prize is redeemable only when `balance ≥ cost`; otherwise its price and name go grey |
| PC-4 | A redeemed prize is removed from the shelf and from the hub's prize case; clearing the shelf restocks it with a fresh generated wave at the same prices |
| PC-2 | Redemption: `debit(cost,'prize')`, push the id to `prizesOwned`, play a slow ticket-machine animation |
| PC-3 | Owning a prize does **not** end the game. The player keeps playing until they leave or go broke |
| PC-4 | With a prize owned, the front door now reads `[E] LEAVE` and exits to the **good ending** path (§7.11) |

### 7.7 FroggyCharity `[QFD: E3]`

Fires once, on the first zero balance. Froggy hops into frame; the dialogue box slides up.

> "Aw, tapped out already? Don't sweat it. **Ten tokens, on the house.** Because I like your face."

`credit(5,'charity')` · `charityUsed = true` · cheerful chime · coin-spin to `5`. Returns to `ArcadeHub`. Total duration ~6 s.

### 7.8 SecondBust `[QFD: E4, T1 — the hinge of the whole game]`

Fires on the second zero balance. Sequenced precisely:

| t | Event |
|---|---|
| 0.0 s | The music **cuts** — a hard stop, not a fade. `[QFD: T1]` |
| 0.0 s | Cabinet bleeps and crowd hum stop in the same frame |
| 0.2 s | Room lighting drops by 30% over 400 ms |
| 0.6 s | Froggy enters. **He uses the V0 art exactly** — no new sprite, no expression change `[QFD: §11.2, FMEA #1]` |
| 1.0 s | Line 1: "Oops. Looks like you're all out of froggy-tokens." |
| ~3.5 s | **Three seconds of nothing.** No animation on Froggy, no sfx, no typewriter blips, no HUD motion |
| 6.5 s | Line 2: "You can go now." |
| 8.0 s | → `EjectionCutscene` |

**SB-1:** the three-second hold is a hard requirement, not a suggestion. Do not let a polish pass shorten it.

### 7.9 EjectionCutscene

The player character walks to the door **without input**, at a constant pace, dragged by nothing visible. Camera locked. The door opens, they cross the threshold, it shuts. A single lock-click. Cut to black, 1.5 s.

`route = 'ejected'` is committed here. `[QFD: AC-4, AC-6]`

### 7.10 ExteriorNight `[QFD: §9, P2]`

The `StartScreen` illustration, **reusing the same tiles**, transformed: neon sign dead, windows black, `CLOSED` hanging in the door, streetlight buzzing, rain stopped. Palette desaturated ~70% and hue-shifted blue. `[QFD: P2, C5]`

| Hotspot | Position | Behaviour |
|---|---|---|
| **Front door** | Centre | Locked-handle rattle ×3, then a quiet mutter. Permanently locked; no state ever changes this `[QFD: AC-4]` |
| **The kid** | Under the streetlight | See §7.11 |
| **`LEAVE`** | Left edge, a plain arrow | → the quiet ending (§7.19). No confirmation prompt, no commentary `[QFD: T6]` |
| **Alley** | Right edge, barely lit | → `BackAlley` |

**Audio:** `ambience: ['crickets','wind_low','car_passby']` — **no music** `[QFD: §3.3]`

### 7.11 The kid NPC

| Condition | Dialogue | Result |
|---|---|---|
| `prizesOwned.length > 0` | "…is that a real one? …Okay. Okay, yeah." | Cash exchange animation → **good ending** card: *"You ate that night."* → 15 s reset |
| otherwise | "You didn't win anything? …I'll wait." | Nothing. He is still there if the player comes back |

**KID-1:** the kid never suggests the alley, never hints at the back door, and never comments on the arcade being closed. `[QFD: P1]`

### 7.12 BackAlley

A narrow vertical slice: dumpster, fire escape, a puddle reflecting nothing useful, and the **back door — ajar, a sliver of black behind it.**

| # | Requirement |
|---|---|
| BA-1 | The door is the only interactable. No prompt escalates or flashes; it is a plain `[E]` like every other |
| BA-2 | The player can walk back out to `ExteriorNight` at any time, including after standing at the door |
| BA-3 | Entering requires `route === 'ejected'` `[QFD: AC-6]` |

### 7.13 ArcadeDark `[QFD: T5, §9 — the silence scene]`

The exact `ArcadeHub` layout, unlit. Cabinets are silhouettes; the only light is moonlight through the front windows.

| # | Requirement |
|---|---|
| AD-1 | **Audio declaration is empty.** Zero sources instantiated. Footsteps are the only sound, played as one-shots on the `sfx` bus `[QFD: AC-10, FMEA #6]` |
| AD-2 | Cabinets are dead — no marquee, no bleeps, not interactable |
| AD-3 | The front door will not open from inside either |
| AD-4 | The prize case reads `IT NEEDS A KEY.` With `hasKey`, it opens (§7.18) |
| AD-5 | The **cashier counter** is now interactable: `[E] CLIMB OVER` — a short vault animation |
| AD-6 | Behind the counter, a door marked `STAFF`, unlocked. Entering sets `route = 'basement'` |
| AD-7 | No Froggy. No sounds that aren't the player. No movement anywhere on screen |

### 7.14 BasementSequence `[QFD: C7 — rank #3, 7.0%]`

A clickable image sequence, **not** a movement scene. No HUD, no music, no pause menu beyond `Esc` → quit-to-title confirm.

**Global rules**

| # | Requirement |
|---|---|
| BS-1 | Each click plays a footstep-on-concrete and crossfades to the next image over **600 ms** |
| BS-2 | Only the specified hotspot advances the frame. Keyboard mashing, double-clicks and rapid clicks cannot skip a frame `[QFD: AC-7]` |
| BS-3 | No back navigation. The way behind is always dark |
| BS-4 | Input is locked during a crossfade |
| BS-5 | Frames are static: **no ambient animation anywhere in the sequence** except the frame-8 flicker |

**The ten frames**

| # | Image | Interaction | Notes |
|---|---|---|---|
| 1 | Concrete stairs descending into black; a bare bulb at the top behind the player | Arrow ↓ | The only light source is behind you |
| 2 | A long narrow corridor; the far end simply becomes dark; pipes on the ceiling | Arrow → | |
| 3 | Another corridor, near-identical to #2 but **subtly longer** | Arrow → | Reuse #2's tiles, extend by ~20% |
| 4 | A small room; one wooden chair **facing away**; a door on the far wall | Click the **door** — 1.5 s creak | Never explain the chair |
| 5 | A long corridor. Far down it, **a frog-like shape with a single visible eye** | Arrow → | ~12 px tall, near background colour, **unlit and unanimated**. Fixed palette-index ΔE; most players must be unsure they saw it `[QFD: H2, FMEA #7]` |
| 6 | End of the corridor; a plain door. The figure is gone | Click the **door** | **Never acknowledged, ever** |
| 7 | A small empty room; a dim bulb on a cord, **a key hanging from the cord** | Click the **key** | |
| 8 | On pickup: `hasKey = true`; the bulb flickers hard; on the back wall, **visible only in the flicker frames: TURN AROUND** | Click the **turn-around arrow** | Text must not be readable in any non-flicker frame `[QFD: H3]` |
| 9 | The view reverses. **Nothing is there.** Just the door you came through | *(none — forced 4.0 s hold)* | Input disabled; no skip; ± 100 ms tolerance |
| 10 | The camera auto-snaps back. **Froggy fills the frame** — full-screen, non-pixel, smooth, wrong | *(none)* | Hard cut, loud stinger, 3-frame shake `[QFD: H4]` |

Then: black, 0.5 s → `route = 'chase'` → `Chase3D`. `[QFD: §10]`

### 7.15 Chase3D `[QFD: C8 — rank #9, 5.3%]`

First-person Three.js. A rough low-poly reconstruction of the §7.14 corridors so the player recognises the route in reverse.

**Tuning**

| Parameter | Value |
|---|---|
| Player walk speed `W` | 4.0 m/s |
| **Froggy speed** | **2.0 m/s — exactly `0.5 × W`, constant, never scaled** `[QFD: H6, AC-8]` |
| Froggy head start | Spawns 8 m behind the player |
| Optimal route length | ~110 m (≈ 28 s of clean running) |
| Dead-end forks | 2, each ~8 m deep (≈ 4 s round trip) — both look like the correct turn |
| Catch radius | 1.1 m |
| Fog | Exponential, full occlusion beyond 12 m |
| Flashlight | 35° cone, 10 m range, mounted to the camera |
| Headbob | 1.6 Hz, 0.04 m amplitude |
| Target completion | 60–90 s for a blind player `[QFD: H7]` |

**Rules**

| # | Requirement |
|---|---|
| CH-1 | Froggy pathfinds directly toward the player and **never stops**. No teleporting, no shortcuts, no rubber-banding |
| CH-2 | He is kept mostly **out of the flashlight cone** — in-cone < 20% of the run. The audio does the work `[QFD: VOC-31]` |
| CH-3 | Audio: heavy breathing (player), running footsteps, and a **wet hopping sound** whose gain rises as he closes `[QFD: C4]` |
| CH-4 | Because he is slower, the danger is **navigation**, not speed. Difficulty comes from the forks, not from the chase maths |
| CH-5 | Contact → death jumpscare → `YOU WERE EATEN` card → full reset to `Boot` |
| CH-6 | Route: corridors → stairs → `ArcadeDark` (3D) → front door → escape → `route = 'ended'` |
| CH-7 | Keep the level **short**. Ninety seconds of tension beats five minutes of a maze `[QFD: VOC-32]` |

**The key payoff:** if the player took the key, the prize case in the 3D dark arcade is open and the Stuffed Bunny is gone. It is never mentioned. `[QFD: T4 — second-playthrough material]`

### 7.16 OutroCutscene3D `[QFD: §12]`

Third person, camera pulled back and locked.

| t | Beat |
|---|---|
| 0.0 s | The player bursts out the front door and sprints down the street |
| 0.5 s | The camera stops following and **holds on the arcade entrance** |
| 1.5 s | **Froggy steps into the doorway. He does not chase.** He watches |
| — | He watches until the player is out of frame, and then for **3 more seconds** |
| — | Cut to black |

### 7.17 EndCard & reset `[QFD: AC-9]`

Black screen, large centred pixel text: **End**

After **15.0 s**: delete `froggy.run`, keep `froggy.prefs`, return to `Boot`. A click does not skip the wait.

### 7.18 The key path (optional flourish)

If the player carries `hasKey` back up during the chase and survives, the prize case in `ArcadeDark` can be opened for a Stuffed Bunny — which the kid outside will still buy after the escape. This is a **stretch item for Phase 7** and is cut without ceremony if the schedule slips.

### 7.19 Quiet ending — "You Went Home" `[QFD: T6]`

Triggered by the `LEAVE` arrow on `ExteriorNight`. Fade to black over 2 s. Plain centred text: *"You went home."* Hold 5 s → 15 s reset. No music, no sting, no score, **no commentary of any kind.** The player who walks away is not the loser of this game.

---

## 8. Froggy — Character Specification & Full Script

### 8.1 Rendering rules `[QFD: C6 — rank #1, 8.9%]`

| # | Requirement |
|---|---|
| FR-1 | Froggy is **the only non-pixel element in the entire game**: smooth vector art, clean gradients, no dithering, no pixel grid `[QFD: T2 — hard constraint]` |
| FR-2 | He renders to an **unfiltered overlay canvas above the scaled world buffer** and never passes through the 320×180 target `[QFD: SM-4]` |
| FR-3 | Source art is resolution-independent SVG, rasterised per-context: an atlas for Phaser, a camera-facing textured plane for Three `[QFD: §8.2]` |
| FR-4 | In horror sections he renders at **≥ 1.3× his largest 2D on-screen size** `[QFD: VOC-37]` |
| FR-5 | **The game never explains this.** No character comments on it; no UI acknowledges it `[QFD: VOC-15]` |
| FR-6 | Verification: at every window scale, tiles are blocky and Froggy's edges are smooth. Automated screenshot diff `[QFD: §13.1 filter audit]` |

### 8.2 Variants `[QFD: §11.2]`

| Variant | Where | Definition |
|---|---|---|
| **V0 — Cozy** | Tutorial, hub dialogue, charity | The reference image, unmodified. Bouncy idle ~2 Hz |
| **V1 — Uncanny** | Tutorial line 6, second bust, Whack-a-Frog cameo, basement frame 5 | **Identical art to V0.** Only the animation stops and the pupils shrink to the reference image's fourth pose. Zero geometry change — the wrongness is behavioural |
| **V2 — Predator** | Basement frame 10, the 3D chase, the outro doorway | Full monstrous render (§11.3 of the QFD): same green desaturated to sickly, same yellow belly gone jaundiced, same pink tongue now wet and over-long, mouth hinged past the width of the head |

**FR-7:** V1 must never borrow anything from V2. If a player can tell V1 from V0 in a still frame, the foreshadowing has leaked and it is a defect. `[QFD: FMEA #1 — RPN 240, highest in the project]`

### 8.3 Dialogue box

Bottom third of the screen. Froggy's portrait on the left, text on the right, typewriter reveal at **28 characters/second** with a soft blip per character (blip pitch varies ±5% to avoid a machine-gun feel). `Left click` or `E` completes the current line instantly; a second press advances.

### 8.4 Full script

**Intro tutorial** — fires once, on first arcade entry. Froggy hops in and walks the player around, highlighting each area as he talks.

| # | Line | Direction |
|---|---|---|
| 1 | "Well well well! A new face. Welcome to my arcade, friend." | Hops in from the right, bouncy |
| 2 | "See these? **Froggy-tokens.** Little gold coins with my handsome face on 'em. They're how you play." | Token icon pops on the HUD |
| 3 | "Cheap games take one token. The tough ones take five — but they pay out big." | Cabinet marquees pulse in sequence |
| 4 | "Win a game, win tokens. Simple." *(pause)* "Lose a game… well." | 0.4 s pause at the marked point; no other change |
| 5 | "Cash 'em in at the counter for prizes. The good stuff starts at two hundred." | The prize case highlights |
| 6 | **"One rule, friend. Don't lose all your tokens."** | **Leans in. 0.5 s hold before. Idle animation stops COMPLETELY. Typewriter slows to 18 c/s. 0.5 s hold after.** `[QFD: VOC-16]` |
| 7 | "…Have fun!" | Snaps back to bouncy in a single frame; bounces off-screen |

**SCR-1:** line 6 is the only foreshadowing in Act I. It works because it is *cheerful advice* on a first read and *an instruction* on a second. Do not add a music cue, a colour shift, or a camera move to it. The stillness is the entire effect.

**Charity** (first zero balance):

> "Aw, tapped out already? Don't sweat it. **Ten tokens, on the house.** Because I like your face."

**Second bust** (second zero balance) — timing in §7.8:

> "Oops. Looks like you're all out of froggy-tokens."
>
> *(3.0 s — nothing)*
>
> "You can go now."

**Everywhere after that:** Froggy has **no dialogue at all.** He does not speak in the basement, the chase, or the outro. He never speaks again. `[QFD: P1]`

---

## 9. Minigame Specifications

### 9.0 Shared interface `[QFD: B3 — rank #8, 5.5%]`

```ts
interface Minigame {
  id: GameId;
  cost: number;
  reward: number;
  launch(onComplete: (result: { won: boolean }) => void): void;
}
```

| # | Requirement |
|---|---|
| MG-1 | The hub knows nothing of a game's internals — only this interface `[QFD: VOC-19]` |
| MG-2 | **Nothing is charged for walking up to a machine.** The room opens the shell with the game unbuilt behind its how-to-play card; the cabinet's `cost` is debited by the shell at the moment the player presses **PLAY**, once, in one place. LEAVE, `ESC` at the card, or a balance that cannot cover the price all end the visit with the player's tokens untouched. A fixture that charges inside the game (MG-10) is not debited even then. |
| MG-3 | `onComplete({won:true})` credits `reward`; `{won:false}` credits nothing |
| MG-4 | Every game has `[ESC] QUIT`, which **forfeits the entry cost** and calls `onComplete({won:false})` |
| MG-5 | Every game shows a result card (`YOU WIN +6` / `YOU LOSE`) for 2 s before returning to the hub |
| MG-6 | All six pass an automated contract test: launch → complete → return, and launch → quit → return `[QFD: AC-2]` |
| MG-7 | All art, names, audio and layouts are **original**. No licensed assets, no trademarked names, no reproduced maze geometry `[QFD: M4, B7, §13.1 IP sign-off]` |
| MG-8 | Every game shows a **how-to-play card** before it is built, and it is free to read: the objective, **this cabinet's own controls and no other cabinet's**, what a go costs, and two buttons — **PLAY** (the only thing in the game that takes tokens, latched so five clicks pay for one play) and **LEAVE** (back to the room, nothing charged). A player who cannot afford the cabinet still sees the card, with PLAY dark and the shortfall spelled out. The controls sit on their own panel, darker than the card, so they read at a glance over whatever the cabinet is painting underneath. The module is not constructed until PLAY, so nothing under the card is playable and no key pressed at it reaches the game. The contract is enforced by the type: `MinigameModule.tutorial` is not optional. |
| MG-9 | **A tie is not a loss.** A game that can end level calls `api.draw()`, and the shell hands the stake back **once**, through the ledger, as `game.refund`. No reward, no high score, no "+n" — the player has bought nothing and sold nothing. Applies wherever a tie is reachable: tic-tac-toe, bowling, air hockey, frog vs lizard, and a dance-off match that ends level on rounds. Blackjack's push is the same rule inside a hand and pays the stake back at 1× on the spot. |
| MG-10 | **A fixture that charges for the go does not charge at PLAY either.** Froggy's blackjack table and the wheel take a bet, not a price: their `cost` is the smallest bet they will take, and the first token moves when the player deals or spins (`api.raise`). Marked in the cabinet table as `freeToEnter`. |
| MG-11 | **The two bet fixtures are barred to a player who cannot cover a go.** Blackjack and the wheel are the only places in the building where the money changes hands inside the game, so a broke player would be sat at a machine they cannot make a move on. The casino refuses them at the fixture, out loud, with the number they are short (`NO MONEY, NO CARDS — THE MINIMUM IS 1`). Every other cabinet lets anyone walk up and read (MG-8). Tokens and cash stay separate currencies throughout: nothing here spends cash. |

### 9.0.1 A note on "six"

The brief says **six** minigames throughout and then enumerates **seven**
(3 easy, 2 medium, 2 hard). All seven are built — dropping one would narrow the
scope the customer actually described, and no single game is obviously the
spare. The hub therefore has seven cabinets. If the count matters more than the
list, say which one goes.

### 9.1 Tuning targets `[QFD: B4 — rank #10]`

Measured over 200 automated runs per game (scripted competent player).

| Game | Tier | Cost | Reward | Target win rate | Typical length |
|---|---|---:|---:|---|---|
| Tic-Tac-Toe | Easy | 1 | 2 | 45–60% | 25 s |
| Falling Blocks | Medium | 3 | 6 | 40–55% | 45 s |
| Air Hockey | Hard | 5 | 10 | 45–60% | 70 s |
| Basketball Hoops | Medium | 3 | 6 | 40–55% | 60 s |
| Whack-a-Frog | Medium | 3 | 6 | 40–55% | 40 s |
| Bowling | Medium | 3 | 6 | 40–55% | 150 s |
| Battleship | Medium | 3 | 6 | 40–55% | 90 s |
| Chomp-Man | Hard | 7 | 15 | 30–45% | 100 s |
| Barrel Climb | Hard | 7 | 15 | 30–45% | 120 s |
| Grudge (Fighter) | Hard | 5 | 10 | 30–45% | 90 s |
| Frog vs Lizard | Hard | 5 | 10 | 40–55% | 120 s |
| Dance Off | Hard | 7 | 15 | 40–55% | 90–135 s |

Air Hockey moved to the back room and the hard tier when the floor was sorted
by price; the two seven-token climbs and the two versus cabinets are explained
under §10.2. Frog Cross and Car Chase pay a formula, not a constant, and are
not in this table.

### 9.2 Tic-Tac-Toe — Easy, 1 → 2

- 3×3 grid, player is `X` and moves first, click to place.
- **AI:** 30% of turns a uniformly random legal move; otherwise full minimax. This makes it decently strong but reliably beatable. `[QFD: VOC-20]`
- **A draw refunds the token** (MG-9). It is neither a win nor a loss: the entry cost goes back exactly once and nothing is paid on top of it. The board says so before a move is made (`YOU ARE X — A DRAW REFUNDS`), the result card says `DRAW — TOKEN BACK`, and the shell's card reads `A TIE — 1 BACK`. This replaces the original "a draw is a loss", which charged a token for a game nobody won.
- Win: three in a row for the player. Lose: AI three in a row.

### 9.3 Falling Blocks — Medium, 3 → 6

A shaft with a ledge at the top of it and **45 seconds** to be standing on that
ledge. Blocks fall down the shaft the whole time and they are the only way up:
jump onto one in the air, it carries you down while you line up the next, and
you leave it before it costs you more height than it gave.

- Eight columns, 20×14 blocks, a block dropped every 430 ms into a column near the player so there is always one in reach.
- **A block that reaches the bottom stays there** — it lands on the floor or on whatever is already in its column and becomes terrain. A fall is therefore recoverable, and the ground builds itself into a staircase while the player works above it.
- The goal is 360 px up. Standing still and being lifted by the stack is worth about 280 px in 45 seconds: enough that a fall is not the end, not enough to win on.
- **The clock is the only way to lose.** A block landing on the frog shoves him out from under it; nothing here kills.
- Left/right and jump (`A`/`D`/arrows, `SPACE`/`W`/`UP`). Custom tune (`game_fallingblocks`) and sfx for the jump, the landing, a block coming to rest and the summit.

### 9.4 Air Hockey — Hard, 5 → 10

- Mouse-controlled paddle, constrained to the player's half. First to **5**.
- Puck: max speed 520 px/s, elastic wall bounces, restitution 0.98 on paddles, speed inherited from paddle motion.
- **AI:** tracks the puck's predicted intercept with a **140 ms reaction delay** and ±18 px aim error, and only commits to an attacking shot when the puck is in its half. Beatable by feints. `[QFD: VOC-20]`
- 180 s cap; on timeout the higher score wins, and **a tie is a loss.**

### 9.5 Basketball Hoops — Medium, 3 → 6

- **Hold `Spacebar`** to charge a power meter (0→100 over 1.2 s, then it bounces back down — no infinite hold); release to shoot. `W`/`S` tilt the shot, and an arrow at the ball shows the direction and the charge.
- Projectile arc with gravity.
- The hoop **slides left–right**, starting at 60 px/s and speeding up **15% per made shot**.
- **Win: 5 points in 60 seconds.** A miss costs only time.
- Rim and backboard have real collision — bank shots must be possible.
- **Three variations sit on top of the plain shot**, and each one is readable from the screen without being explained:
  - **The rim tightens.** Every score narrows the mouth by 1.6 px, down to a floor of 14 px, on top of the 15% speed-up. The last point of a run is the hardest one.
  - **On fire.** Two makes in a row light the ball — it burns, it trails, and while it is lit **every make is worth two**. One miss puts it out, which is what makes the second shot of a streak worth more than the first.
  - **The bonus ring.** A small gold ring drifts across above the hoop every ~13 s and stays for 7 s, blinking out at the end. Threading it is **worth two and lights the ball**, and it is a harder shot than the hoop beneath it.

### 9.6 Whack-a-Frog — Medium, 3 → 6

- Nine holes in a 3×3 grid; frogs pop up, click to whack.
- **Win: 25 hits in 40 seconds.**
- Frog up-time ramps 1.10 s → 0.65 s across the round; spawn interval ramps 0.75 s → 0.45 s. Up to 3 frogs up at once late in the round.
- **The cameo** `[QFD: M5, VOC-21]`: **1 in 200** occupants that pop up is **Froggy V1** — the customer raised the rarity from the original 1 in 20 so that most players never meet him at all, and the roll gates the **spawn decision itself** rather than hiding him after the fact. The odds are never shown, said or hinted at in game — smooth, non-pixel, out of place. Clicking him:
  - does **not** count as a hit,
  - does **not** cost anything,
  - plays **no sound at all**,
  - he **stares at the player for 1.2 s** and goes back down.
  - The game never comments. There is no achievement, no dialogue, no follow-up.
  - He occupies a hole for the full 1.2 s, so he mildly hurts the player's score. That is the only mechanical consequence.

### 9.7 Chomp-Man — Hard, 7 → 15

An original homage. Original maze, original frog-themed ghosts, original sounds and name. **No Namco assets, geometry or names.** `[QFD: VOC-22, B7]`

- Single maze, 3 lives, 141 pellets, 4 power pellets.
- **Win:** clear the maze. **Lose:** all three lives.
- Speeds: player 5.5 tiles/s, ghosts 4.6, frightened 3.0. Frightened lasts 6 s with a 1.5 s flashing warning.
- **The maze is a lattice, not four quadrants.** 21×15, corridors every three tiles both ways, **29 independent ways round, 46 junctions and no dead ends** (the board it replaced had 16, 30 and 6). Every corridor meets another within a few tiles, so a player being followed can turn, loop and come out behind the ghost that was on them — which is the skill of the game and was impossible on long straight runs. Asserted in `tools/games.mjs`, which floods the maze from the player's start and fails if one pellet is unreachable.
- **The ghosts live in a box** in the middle of it with a single door in the top. They are let out one at a time (0 / 1.8 / 3.6 / 5.4 s), the door is a wall to the player so the box is never a bolt-hole, and losing a life puts all four back in it on the same staggered clock.
- **An eaten ghost is off the board for 10 seconds**, sitting in the box dimmed, before it comes out again. A power pellet buys real time rather than a lap of the maze, and clearing the last corner becomes a thing you can plan.
- **The hunters path properly.** `direct` and `ambush` take the shortest route (breadth-first over the maze) to the player and to four tiles ahead of them; a greedy straight-line step circles a block forever on a lattice. `random` and the frightened flight stay deliberately dumb — a frightened ghost that pathed its way out of trouble would make the power pellets worthless. The ghost speed came down from 5.0 to 4.6 tiles/s to pay for the better pathing.
- **Four ghosts, distinct behaviours** `[QFD: §8 of the brief]`:

| Ghost | Behaviour |
|---|---|
| **Direct** | Targets the player's current tile |
| **Ambush** | Targets 4 tiles ahead of the player's facing |
| **Random** | Picks a random legal direction at each junction |
| **Patrol** | Loops a fixed corner circuit, ignoring the player until they enter its quadrant |

- A 4 s scatter phase every 20 s sends all ghosts to their corners — this is the player's breathing room and is what keeps the game at a 30–45% win rate rather than 10%.

### 9.8 Grudge (Fighter) — Hard, 5 → 10

An original 1v1 side-view fighter. Original characters and art. `[QFD: VOC-22]`

- **A frog against a lizard, both on two legs.** The frog is round and
  low-slung; the lizard is taller, has a snout, a crest and a tail. They are
  built out of posable parts — legs, torso, head, arm, shin, aura — so what
  they are doing is drawn rather than implied.
- **Three attacks, and each looks like itself.** `J` is a HIGH strike: a
  straight arm at head height. `K` is a LOW sweep: a crouch and a leg along the
  floor. `I` is the SPECIAL: a wound-up lunge with a ring of light off it.
  Every attack is drawn through all three phases — the wind-up (cocked back,
  white head), the active frame, the droop — and the fighter throwing it names
  it in a word over their head, so a player can read what is coming.
- **Getting hit looks like it.** The target snaps backwards, whites out,
  loses whatever they were throwing, and cannot act for 170–340 ms depending on
  the blow. A burst of shards and an expanding ring go off where it landed, and
  the camera shakes — harder for the special.
- **The special has a visible cooldown.** A bar under each health bar, 8 s,
  with `SPECIAL READY` in gold when it is back and a chime the moment it
  returns. Pressing it early is refused with a buzz and `NOT READY` rather than
  silently ignored.
- Blocking cuts damage to 20%, and a low sweep goes under a standing block.
- The AI runs a readable three-beat pattern — approach, low, high-high — with a
  deliberate 0.6 s opening after a whiffed sweep. A player who learns the
  pattern wins; a masher loses.

### 9.9 Frog vs Lizard — Hard, 5 → 10

A one-round, turn-based throwing match over a garden fence. You are the frog on the left;
the lizard is on the right and plays by exactly the same rules. Five in, ten out, like every
other five-token cabinet on the floor.

- **Throwing** is the Hoops mechanic with a target instead of a hoop: `W`/`S` aim, **hold `Spacebar`** for power, release to throw. An arrow shows the direction and charge, and a dotted arc shows the flight **in still air only** — the wind is deliberately *not* baked into the preview, because reading the preview against the wind bar is the game.
- **Wind** is rolled fresh **every turn** and shown as a two-sided bar in the middle of the screen. It accelerates anything in the air sideways at up to 88 px/s², so a stronger wind bends the flight further and the throw that landed last turn does not land this one. The draw is squared (keeping its sign), so gentle days are common and a gale is occasional.
- **The fence** is real: an item that hits it is stopped and does nothing.
- **Items** — one ordinary, three special, **and the lizard has the same four and the same stock**:

| Item | Damage | Effect | Stock per round |
|---|---:|---|---:|
| **Rock** | 14 | the baseline | unlimited |
| **Heal** | 4 | heals **the thrower** 16 on contact, and still hurts the opponent | 1 |
| **Dynamite** | 28 | exactly double | 1 |
| **Poison** | 8 | **5 chip damage at the top of the opponent's next three turns**, applied once per turn, then it stops | 1 |

- **Rounds:** 80 HP a side, **one round**. It ends when somebody's bar is empty: empty his and the cabinet pays, empty yours and it does not. There is no second go, which is what makes holding a special worth doing and throwing one at nothing a real loss. (`ROUNDS` is a constant and the scoring still handles a longer match — a split going on total damage dealt, a dead heat paying nothing, as the bowling lane does — so the number can be retuned without rewriting the end of the game.)
- **The lizard's AI** searches its own throws against the wind actually blowing, keeps the arc that would land, then throws it with a small two-uniform wobble on both angle and power — so it aims like an opponent and misses like one. Its item choice is the same reasoning a player uses off the same stock: heal when hurt, dynamite to finish, poison early while there is time for it to work, rock otherwise.
- **HUD:** both health bars, the round and round score, the poison counter on each side, the wind bar, the item bar with the key for each item and how many are left, and the control line.

### 9.10 Wheel of Fortune — casino, 45 a spin

Not a cabinet: a painted wheel on a post in the corner of the casino, with a
pointer over the top of it. **Free to walk up to and read** (MG-8) but barred
to a player who cannot cover a spin (MG-11). Every spin is raised through the
shell as it is taken; LEAVE settles up. Prizes are paid the moment the wheel
stops, and **a spin pays exactly one face** — there is no second prize and
nothing that can stack two payouts onto one go.

**The odds are the geometry.** Each face is cut to the width of its own chance
and a spin picks a uniformly random stopping angle — nothing weights the draw
afterwards. A player who counts the faces gets the truth.

| Face | Share of the rim |
|---|---|
| 500 | **1%** — one 3.6° splinter |
| 200 | **5%** |
| 70 | **10%** — two faces |
| 60 | **10%** — two faces |
| 50 | **10%** — two faces |
| 40 | **15%** — three faces |
| 1, 2, 3, 5, 7, 10, 15 | **39%** — a seventh of it each |
| the blank | **10%** — two faces |

**The percentages are no longer printed.** The board beside the wheel names
what it can pay and says that the big money is on the thin slices; the honesty
lives in the rim, where anyone who wants the odds can count them, rather than
in a table that turns a fairground wheel into a prospectus. The exact shares
are asserted in `tools/games.mjs` by sampling the geometry, precisely because
nothing on screen would show them drifting.

**The price, and why it is forty-five.** These faces average **41.4 tokens a
spin**. The wheel was 20 a go against a rim averaging 17.7; at 20 against this
one it would hand the player twenty-one tokens a spin, for ever, and the prize
shelf and every other cabinet would stop meaning anything inside a minute. At
45 the house keeps about **8%**. The faces are exactly the ones that were
asked for; the price of a go is the one number that had to move.

### 9.11 Dance Off — Hard, 7 → 15, in the back room

A step battle against a rival on the next mat. Arrows climb two lanes of four
to the receptors at the top; press the matching key as yours reaches the line.
`A` left, `S` down, `W` up, `D` right — the same hand position as walking.

- **A match, best of three.** Each round is **45 seconds** and the higher score takes the round; the first to two rounds takes the match and the fifteen. Three rounds with the rounds level is a draw, and a draw refunds the seven (MG-9).
- **Every round is a different song and a different chart.** The tune steps up a tempo each round — 128 → 140 → 152 bpm, each with its own preset (`game_danceoff`, `game_danceoff_2`, `game_danceoff_3`) — and the chart is cut fresh to that tempo, with the off-beat rate climbing 20% → 32% → 44%. The seed is taken off the clock, so no two rounds and no two matches are the same sequence. (The original fixed seed made rounds two and three a replay of round one, which is the opposite of a rival who gets harder.)
- **Scoring:** 100 a hit, plus 10 per consecutive hit up to +100. A press into an empty lane costs 100 and breaks the combo, so mashing loses.
- **The rival steps up every round you take off him.** He gets the same arrows at the same moments; what changes is how many he lands and whether he strings them: **62%** and no combo to start, **76%** with a 6-hit combo cap once you are one round up, **88%** with a 10-hit cap once you are two. Lose a round and he does not improve for it — he steps up when you do.
- Timing: ±145 ms to hit, ±55 ms for a PERFECT, and past 190 ms the arrow is gone.
- Original characters, original chart, original name (MG-7).

### 9.12 Chamber — casino, 5 in, up to 15 out

The arcade's russian-roulette cabinet, and it **is** a cabinet: a cylinder
diagram, a lever and six chambers with one live round in them. Nothing is
pointed at anybody — what is at stake is the five tokens, and the whole deal is
printed on the machine's face before a token moves.

- **Five tokens to sit down. Three a clean pull. Five pulls, and no sixth.**
- **The pot is not yours until you walk.** It sits on the machine, pull by pull; `WALK AWAY` is available from the first moment and pays exactly what is on it. The live round zeroes it and the run ends with nothing.
- **The warning is in plain words and clear of the machine**: `IF YOU GET SHOT, YOU LOSE ALL YOUR TOKENS`, in its own panel below the cylinder. It replaced "THE LIVE ONE TAKES THE LOT", which was a card-room turn of phrase for the one rule a player has to understand — and which sat across the bottom of the cylinder while it said it. Nothing is printed over the cylinder, the hammer or the lever.
- The cylinder is spun between pulls, so every pull is an independent **1 in 6** and nothing about the run so far changes the next one. The machine says so.
- **The arithmetic, because the machine states it:** surviving all five is (5/6)⁵ = 40%, paying 15 against the 5 it cost — about a token of expected value a play. Stopping early is worse than going on at every single step, which is the joke: the machine is honest, and the honest play is to keep pulling.

### 9.13 Froggy Car Chase — Hard, 5 in, 10 and up

A four-lane road from above. Traffic ahead is slower than you and has to be
threaded; the police behind are faster and have to be shaken. Cash sits on the
road in bundles of twenty and the run ends on a crash, on being caught, or on
`ENTER` — pull over and take what you have.

- **Nitro refills itself**, a burst every 11 s, up to two in the tank; blue jars fill it the rest of the way. A burst runs for 2.2 s and, while it does, the police **cannot** gain: the road moves at the player's speed, so every chaser slides backwards down the screen and the player comes out of it with room to pick a lane.
- They close at 15 px/s over the road speed rather than 20, and gain with the clock more slowly. The chase still shuts on a mistake; it no longer turns every mistake into an arrest.
- **They can be juked.** A chaser steers at the lane it last *saw* you in and only looks every 460 ms (down to 200 ms as the heat climbs), so a late swerve leaves it committed to your old line. That lag is how you shake one without nitro.
- **They can be crashed.** A chaser locked onto the lane you just left drives into the back of the traffic in it, spins out, drops its siren and falls back down the road for ~2.8 s. The road is a weapon, not only an obstacle.
- **The chase is as heavy as the bag:** one car until 200 cash, then **one more for every further 200**, up to six. The first three of those notches also speed the police up, thicken the traffic and quicken the road.
- **From 600 cash they lay spike strips** across the road with a gap to thread, coming quicker the longer you stay out. A strip takes a police car out exactly the way it would take you.
- Nitro jars are spread rather than clustered: never twice in the same lane, never behind a car already at the top of the road, and always a lane or two off your line.

---

## 10. Economy Design & Simulation

### 10.1 Starting position `[QFD: E1]`

**$10 → 20 froggy-tokens** at 50¢ each. This is the only injection of currency in the game apart from Froggy's five. There is **no purchase flow, no ad, no top-up, no secret stash.** That absence is the design. `[QFD: VOC-09]`

### 10.2 Payout table `[QFD: E2, §15 decision #1]`

**One rule, and the reward is the TOTAL handed back on a win** — the stake is
already gone, so 3 in and 6 out is three tokens of profit, and nothing
re-deducts the entry cost when it pays:

| Cost | Win | Profit |
|---:|---:|---:|
| 1 | 2 | +1 |
| 3 | 6 | +3 |
| 5 | 10 | +5 |
| 7 | 15 | +8 |

| Tier | Games | Cost | Win | Loss |
|---|---|---:|---:|---:|
| Easy | Tic-Tac-Toe | 1 | 2 | 0 |
| Medium | Falling Blocks, Basketball Hoops, Whack-a-Frog, Bowling, Battleship | 3 | 6 | 0 |
| Hard | Air Hockey, Grudge, Frog vs Lizard | 5 | 10 | 0 |
| Hard (long) | Chomp-Man, Barrel Climb, Dance Off | 7 | 15 | 0 |

Everything up to the five-token row is a **2× on a win**, so expected value is
negative unless the player wins more than half the time. That pressure is the
point. The brief's original "5 in / 3 out" medium tier was a guaranteed loss
even on a win, and was corrected to 3/6 in the QFD. `[QFD: §15 decision #1]`
The easy tier used to pay 1 → 3, which was the one corner of the floor paying
triple; it is 1 → 2 now. The seven-token row pays a little over 2× because
those three are the longest games in the building — a 7-in cabinet you can
lose on the last screen after four minutes has to be worth the walk — and
fifteen is the top of the standard table rather than a cabinet-by-cabinet
exception. `STANDARD_REWARD` in `game/content.ts` is the table, and
`tools/games.mjs` asserts every normal cabinet against it.

**The fixtures that run their own economy** say so on the machine, and are the
only things exempt:

| Fixture | Cost | Pays | Why |
|---|---:|---|---|
| Froggy Slots | 2 a spin | its own paytable | §9.x, and it does not print its odds |
| Wheel of Fortune | 45 a spin | 0 to 500, averaging 41.4 | §9.10 |
| Chamber | 5 in | 3 a clean pull, up to 15 | §9.12 |
| Blackjack | 1 minimum | 2× the bet, hand by hand | §9.x |
| Frog Cross | 7 | 50 points (five crossings) for 15, +1 every 50 after | a formula, not a constant |
| Car Chase | 5 | 200 cash for 10, +1 every 200 after | as above |

### 10.3 Expected-value model

Net EV per play = `(p_win × reward) − cost`, where the break-even win rate is **50%** at every tier.

| Game | p_win (target midpoint) | Cost | EV | Net per play |
|---|---:|---:|---:|---:|
| Tic-Tac-Toe | 0.525 | 1 | 1.05 | **+0.05** |
| Falling Blocks | 0.475 | 3 | 2.85 | **−0.15** |
| Basketball Hoops | 0.475 | 3 | 2.85 | **−0.15** |
| Whack-a-Frog | 0.475 | 3 | 2.85 | **−0.15** |
| Grudge | 0.375 | 5 | 3.75 | **−1.25** |
| Chomp-Man | 0.375 | 7 | 5.63 | **−1.37** |
| Dance Off | 0.475 | 7 | 7.13 | **+0.13** |

**Read:** the Easy tier is a coin flip that pays for itself and no more, and the Hard tier bleeds badly. This is deliberate and load-bearing:

- **The Rusher** goes for the big payouts and busts in 3–5 minutes.
- **The Grinder** who farms Tic-Tac-Toe at +0.05/play would need thousands of winning plays to reach 200 tokens. Technically possible; nobody will do it. (At the old 1 → 3 it was +0.58 a play and ~310 plays — a grind, but a real one, and the only route through the arcade that did not depend on the game being kind.)
- Both outcomes are correct. Most players go broke, which is the thesis. `[QFD: VOC-11, E5]`

**EC-1:** ship the tiered prize list as specified and accept that most players never redeem.
**EC-2:** the median run must reach the first bust in **4–8 minutes**; if playtests come in outside that band, adjust the target *win rates* in §9.1, **never** the payout table. `[QFD: §8.2 conflict resolution]`

### 10.4 The payout-scaling variant (debug only)

An alternative table — easy 1→5, medium 3→12, hard 5→25 — makes the good ending reachable in one sitting. It exists **behind a debug flag for playtesting only** and does not ship. Shipping it requires explicit customer sign-off, because it dissolves the pressure the whole first act depends on. `[QFD: §15 decision #2]`

### 10.5 Sample run trace

A representative Rusher run from 20 tokens:

| Play | Game | Cost | Result | Balance |
|---|---|---:|---|---:|
| — | seed | — | — | 20 |
| 1 | Tic-Tac-Toe | 1 | Win +3 | 22 |
| 2 | Chomp-Man | 5 | Lose | 17 |
| 3 | Grudge | 5 | Lose | 12 |
| 4 | Hoops | 3 | Win +6 | 15 |
| 5 | Chomp-Man | 5 | Lose | 10 |
| 6 | Grudge | 5 | Lose | 5 |
| 7 | Hoops | 3 | Lose | 2 |
| 8 | Tic-Tac-Toe | 1 | Lose | 1 |
| 9 | Tic-Tac-Toe | 1 | Lose | **0** |
| — | **CHARITY +10** | — | — | 10 |
| 10 | Hoops | 3 | Lose | 2 |
| 11 | Air Hockey | 1 | Lose | 1 |
| 12 | Tic-Tac-Toe | 1 | Draw = token back | 1 |
| 13 | Tic-Tac-Toe | 1 | Lose | **0** |
| — | **SECOND BUST → EJECTED** | | | |

Elapsed: ~7 minutes. This is the intended shape of a first run.

---

## 11. Art Direction

### 11.1 Global rules `[QFD: C5 — rank #5, 6.8%]`

| # | Requirement |
|---|---|
| AR-1 | Internal resolution **320×180**, scaled ×4 to 1280×720; integer scaling only, letterboxed |
| AR-2 | `pixelArt: true` / `NEAREST` on every world texture. No smoothing, no bilinear, anywhere |
| AR-3 | **32-colour palette limit** for the world layer, verified by a palette-count script on rendered frames |
| AR-4 | Sprites: **32×32** for the player and props, **16×16** for tiles |
| AR-5 | **Froggy is exempt from all of the above** and renders on the unfiltered overlay `[QFD: FR-2]` |

### 11.2 Palettes

**Normal (Act I):** warm — amber key light, magenta neon, teal carpet, cream highlights. 32 colours.

**Post-break (Acts II–VI):** the *same palette* desaturated ~70% and hue-shifted blue. **The same tiles are reused** so the player recognises the space. `[QFD: P2, VOC-35]`

**AR-6:** implement the post-break look as a **palette transform on the same tileset**, not as a second set of art. If a player can't tell it's the same room, the effect has failed.

### 11.3 Froggy palette (from the reference image) `[QFD: §11.1]`

| Role | Hex | Notes |
|---|---|---|
| Body / limbs | `#3FE39B` | Spring green, flat fill, no dithering |
| Body drop-shadow | `#12B26B` | Hard-edged offset shadow, down-right |
| Belly | `#FCDC3C` | Wide yellow oval covering the lower two-thirds |
| Belly rim | `#F5C46B` | Soft peach outline |
| Eye ring | `#F5C46B` | Same peach as the belly rim |
| Pupil | `#111111` | Large in poses 1–3; a tiny dot in pose 4 |
| Mouth interior | `#E01B1B` | Open-mouth pose only |
| Tongue | `#F55BB0` | Pink, glossy |

**Poses** (the four in the reference image) map to the four cozy states: **idle A**, **idle B (arm shift)**, **talking (open mouth)**, **blank stare (tiny pupils)**. The blank stare is the uncanny lever — used for tutorial line 6, the second bust and the Whack-a-Frog cameo, and never commented on.

### 11.4 Predator Froggy `[QFD: §11.3]`

Every element of the friendly design stays, and each one is pushed one step too far. The pink tongue is the same pink; the yellow belly is the same yellow. That is *why* it works — the player recognises the mascot they were laughing at ten minutes ago.

| Attribute | Cozy | Predator |
|---|---|---|
| Body | `#3FE39B` spring green | Same hue, −60% saturation, −35% value → sickly `#2A7D5C`, wet specular sheen |
| Belly | Clean flat yellow | Same yellow, mottled and jaundiced `#C9A62E`; the peach rim now reads as a seam |
| Eye ring | Peach ring | Becomes exposed sclera; the peach retreats to a thin bloodshot rim |
| Pupils | Big and friendly | Blown edge-to-edge black with no highlight, or the pose-4 pinprick held unblinking |
| Mouth | Small red arc, pink tongue | Opens **past the width of the head**, hinged too far back; same red, same pink, now wet and stringing |
| Shadow | Flat cartoon offset | A real cast shadow with contact darkening |
| Scale | Fits the dialogue box | Fills the frame; ~1.4× player height in 3D |
| Animation | Bouncy 2 Hz idle | Wet hopping; **no idle at all** — he only ever approaches |

### 11.5 Placeholder strategy `[QFD: D3, A8]`

Build everything with **flat coloured rectangles and text labels first**. Do not block Phases 1–6 on art. Maintain `assets/PLACEHOLDER.md` listing every asset still needing replacement, with intended dimensions, and diff it against asset references in the phase gate.

**AR-7 — the one exception:** **Froggy's V0 art is a Phase 2 deliverable, not a placeholder.** His wrongness is a mechanic; a grey rectangle cannot carry it. `[QFD: §8.2, FMEA #12]`

---

## 12. Audio Direction & Asset List

### 12.1 Per-scene declarations `[QFD: §3.3]`

| Scene | Music | Ambience |
|---|---|---|
| StartScreen | `theme_arcade` | `street_dusk`, `neon_buzz` |
| ArcadeHub / minigames | `hub_lofi` (calm lo-fi chiptune loop) | `cabinet_bleeps`, `crowd_hum` (low) |
| SecondBust | **hard cut to none** | **none** |
| ExteriorNight / BackAlley | **none** | `crickets`, `wind_low`, `car_passby` (occasional) |
| **ArcadeDark** | **none** | **none — zero sources instantiated** |
| **BasementSequence** | **none** | **none** — footsteps, door creaks and an occasional far-off drip as one-shots only |
| Chase3D | **none** | breathing, running footsteps, wet hopping (distance-mapped) |
| Outro / EndCard | **none** | wind only |

**AU-7:** the post-break silence is a **hard constraint** — no drone, no stinger, no low-frequency bed. Silence is scarier. Changing this requires customer sign-off. `[QFD: P4, VOC-12]`

### 12.2 Asset list

**Music (2):** `theme_arcade`, `hub_lofi`.

**Ambience loops (7):** `street_dusk`, `neon_buzz`, `cabinet_bleeps`, `crowd_hum`, `crickets`, `wind_low`, `car_passby`.

**SFX:** UI bleep · hover bounce · coin spin · coin drop · buzzer (unaffordable) · cheerful chime (charity) · dialogue blip · ticket machine · **handbell ding** · door open / door shut / lock click · door rattle (locked) · footstep-carpet · footstep-concrete · counter vault · door creak (1.5 s) · far-off drip · bulb flicker · **jumpscare stinger** · **death stinger** · breathing loop · running footsteps · **wet hop** (distance-mapped) · per-game sfx sets (whack, hoop swish, puck hit, chomp, hit/block/special).

**Total ≈ 45 assets.** All original or licence-clear. `[QFD: B7]`

---

## 13. Technical Architecture

### 13.1 Stack

Vite + TypeScript · Phaser 3 (all 2D) · Three.js (chase + outro only) · Howler.js (audio) · no backend.

### 13.2 File layout

```
src/
  main.ts                 // bootstrap, mounts #game-root
  core/
    state.ts              // GameState store + localStorage (§6.1)
    ledger.ts             // TokenLedger (§6.2)
    broke.ts              // broke detector + latches (§6.3)
    routes.ts             // canEnter() guards (§6.4)
    sceneManager.ts       // Phaser/Three lifecycle (§6.5)
    audio.ts              // 3-bus Howler manager (§6.6)
    input.ts              // single input map (§6.7)
    debug.ts              // dev panel (§6.9)
  render/
    pixelPipeline.ts      // 320x180 buffer, integer scaler, palette transform
    froggyLayer.ts        // UNFILTERED overlay canvas — Froggy only (§FR-2)
  scenes2d/
    Boot.ts StartScreen.ts SettingsModal.ts IntroCutscene.ts
    ArcadeHub.ts PrizeCounter.ts FroggyCharity.ts SecondBust.ts
    EjectionCutscene.ts ExteriorNight.ts BackAlley.ts ArcadeDark.ts
    BasementSequence.ts EndCard.ts
  scenes3d/
    Chase3D.ts OutroCutscene3D.ts
  minigames/
    index.ts              // registry, shared Minigame interface (§9.0)
    tictactoe/ fallingblocks/ airhockey/ hoops/ whack/ chompman/ grudge/
  froggy/
    froggy.ts             // variant state machine V0/V1/V2 (§8.2)
    script.ts             // all dialogue (§8.4)
assets/
  PLACEHOLDER.md          // every unfinished asset + intended dimensions
```

### 13.3 Performance budget `[QFD: A5]`

| Metric | Target |
|---|---|
| Sustained frame rate | ≥ 60 fps on a 2020 mid-range laptop |
| Initial bundle | ≤ 5 MB |
| Renderer swap | ≤ 400 ms, 0 leaked WebGL contexts over 20 swaps |
| Ledger event → visible HUD change | ≤ 100 ms |

---

## 14. Dev Instrumentation

| # | Requirement |
|---|---|
| DV-1 | Win-rate logging per game, dumpable as CSV from the debug panel, used to verify the §9.1 bands over 200 runs `[QFD: B4]` |
| DV-2 | Chase telemetry: completion time, deaths, wrong turns taken, % of run Froggy spent inside the flashlight cone `[QFD: CH-2]` |
| DV-3 | Audio assertion harness: for each scene, log the instantiated source count — **must be 0 for `ArcadeDark` and the basement** `[QFD: AC-10]` |
| DV-4 | Palette-count script over rendered frames, failing the build above 32 colours in the world layer `[QFD: AR-3]` |
| DV-5 | Screenshot-diff harness at ×1…×6 asserting tiles are blocky and Froggy is smooth `[QFD: FR-6]` |
| DV-6 | Phase-gate script: build, boot, play to the current phase's end, commit `[QFD: A7]` |

**No analytics leave the machine.** All instrumentation is local and dev-only.

---

## 15. Edge Cases & Failure Handling

| # | Case | Handling |
|---|---|---|
| EC-1 | Player quits a minigame with `Esc` after paying | Cost forfeited, no refund, return to hub. If that leaves them at 0, the broke check fires on hub entry (BR-1) |
| EC-2 | Player reaches 0 tokens *during* a minigame | No interruption. The bust triggers on return to the hub `[QFD: BR-3]` |
| EC-3 | Reload mid-run | State restores to the last flushed value; the player resumes in `ArcadeHub` (or `ExteriorNight` if `route === 'ejected'`). Reloading mid-basement resumes at frame 1 of the basement, not mid-sequence |
| EC-4 | Reload during the chase | Resume at the start of the chase with Froggy respawned 8 m back. Never resume mid-pursuit |
| EC-5 | Corrupt `localStorage` | Fresh default state, prefs preserved if parseable, no crash `[QFD: ST-3]` |
| EC-6 | Player owns a prize and then goes broke | The ejection still fires. They keep the prize, and the kid still buys it after ejection — the good ending survives a bust `[QFD: E5]` |
| EC-7 | Player clicks the bell 50 times | Nothing, 50 times. No counter, no easter egg, no eventual response `[QFD: VOC-18]` |
| EC-8 | Player mashes during the frame-9 hold | Input is disabled for the full 4 s; presses are swallowed, not queued `[QFD: BS-2]` |
| EC-9 | Browser blocks audio until first interaction | Boot shows a `CLICK TO BEGIN` gate before `StartScreen`; the audio context resumes there |
| EC-10 | Window resized mid-scene | Recompute the integer scale factor and re-letterbox; never stretch, never re-layout |
| EC-11 | Player wins a game after the second bust somehow | Impossible by construction — `canEnter` blocks every minigame when `route !== 'normal'` `[QFD: RG-1]` |
| EC-12 | Tab loses focus | Pause the game loop and duck all buses to 0; resume on focus. In the chase, pause Froggy too |

---

## 16. Milestones & Phase Gates

Each phase ends with a **runnable, playable, committed** build. `[QFD: §12]`

| Phase | Scope | Exit gate |
|---|---|---|
| **1 — Skeleton** | Vite + TS + Phaser scaffold; scene manager; state store; save/load; audio buses; debug panel; Boot → StartScreen → walkable empty Arcade. All art is rectangles | Settings persist across reload; debug panel opens; integer scaling verified |
| **2 — Economy + hub** | Token ledger; HUD; six clickable cabinets; prize counter; Froggy dialogue system; intro tutorial; **Froggy V0 + V1 art** | Tokens move only through the ledger; the tutorial plays once with the line-6 freeze; the bell does nothing |
| **3 — Minigames** | All six, one at a time, behind the shared interface | 6/6 pass the contract test and sit inside the §9.1 win-rate bands; palette ≤ 32; IP audit signed |
| **4 — Broke path** | Charity; second bust; ejection; exterior night; kid; `LEAVE`; alley; back door; dark arcade | Charity fires exactly once; second bust ejects; back door requires `route === 'ejected'`; **`ArcadeDark` instantiates zero audio sources** |
| **5 — Basement** | The ten-frame sequence; the key; TURN AROUND; the jumpscare; **Froggy V2 debut** | Correct hotspots; no skip path under input fuzzing; 4 s hold accurate; flicker-masked text |
| **6 — 3D chase** | Three.js first-person escape; pursuit AI; fog; flashlight; distance-mapped audio | Speed ratio exactly 0.5; optimal route ≤ 90 s; escapable by the competent, lethal to the lost over 20 playtests |
| **7 — Ending + polish** | Outro cutscene; "End" card; 15 s reset; full audio pass; full art pass; `PLACEHOLDER.md` closeout | AC-1…AC-10 all pass; `PLACEHOLDER.md` empty or explicitly deferred |

---

## 17. Acceptance Criteria

The customer's ten criteria, each mapped to the PRD sections that implement it. `[QFD: §13]`

| AC | Criterion | Implemented by | Test |
|---|---|---|---|
| 1 | Start, read the manual, adjust volume; settings persist across reload | §7.3, §6.6, §6.7 | Set three distinct slider values, reload, assert restored |
| 2 | All six minigames winnable and losable; tokens deducted and awarded correctly | §9 | Contract test + 200-run win-rate sample per game |
| 3 | Going broke once triggers charity exactly once per run | §6.3, §7.7 | Scripted: broke → charity → broke → assert no second charity |
| 4 | Going broke twice ejects; the front door is permanently locked afterwards | §7.8, §7.9, §7.10 | Post-ejection, assert the front door returns `locked` in all states |
| 5 | Enough tokens redeems a prize and the kid buys it — a complete non-horror ending | §7.6, §7.11 | Debug-set the balance, redeem, leave, sell; assert the good ending |
| 6 | The back door route is only reachable via `route === 'ejected'` | §6.4, §7.12 | Enumerate all routes; assert blocked for `normal`/`basement`/`chase`/`ended` |
| 7 | The full basement plays with correct hotspots and no forward skip except arrows | §7.14 | Input fuzz all ten frames (mash, double-click, rapid click) |
| 8 | The 3D chase is escapable by a competent player and lethal to a lost one | §7.15 | 20 playtests against the S3 band |
| 9 | The outro plays, shows "End," and resets after 15 seconds | §7.16, §7.17 | Timed test; assert run wiped, prefs retained |
| 10 | Audio buses respect the sliders in every scene, including silence post-break | §6.6, §12.1 | Per-scene assertion; `ArcadeDark` source count == 0 |

### 17.1 Additional gates `[QFD: §13.1]`

| Gate | Check |
|---|---|
| **Tone leak audit** | Per commit from Phase 2 on: does any pre-break asset, sound or line hint at the horror in a way a *first-time* player would catch? If yes, it is a defect |
| **Froggy filter audit** | Screenshots ×1…×6: tiles blocky, Froggy smooth, every time |
| **IP provenance sign-off** | Per phase: zero third-party assets, zero trademarked names, original maze and fighter designs |
| **Walk-away check** | The `LEAVE` exit works, ends quietly, and is never punished or mocked |
| **Bell check** | The handbell still does nothing. It will be tempting to make it do something. Do not |

---

## 18. Out of Scope

Explicitly not in v1, listed so they are not re-litigated mid-build:

- Mobile, touch and gamepad input
- Localisation (English only)
- Achievements, statistics screens, run history
- A second basement route or alternate chase layout
- Any Froggy dialogue after "You can go now"
- Making the bell do something
- Difficulty options, assist modes, or a shipped payout-scaling variant
- Saving mid-basement or mid-chase progress
- A soundtrack beyond the two music loops

---

## 19. Open Questions

Carried forward from the QFD, with build-order deadlines. None block Phase 1.

| # | Question | Needed by | Default if unanswered |
|---|---|---|---|
| 1 | **Predator-Froggy direction:** "same frog, every friendly feature pushed one step too far" — same green, same yellow belly, same pink tongue, all corrupted — rather than a new creature. Confirm? | Phase 5 | Proceed as §11.4 |
| 2 | Should **V1 (uncanny)** ever appear outside its three specified moments? More sightings raise the payoff and raise leak risk | Phase 2 | Three moments only |
| 3 | Does the **kid** react differently to different prizes, or is any prize a flat cash-out? | Phase 4 | Flat cash-out; the prize is named in his line |
| 4 | Is the **walk-away ending** a true ending (card + reset) or a soft exit back to the exterior? | Phase 4 | True ending: *"You went home."* + reset |
| 5 | On **death in the chase**, does the run reset fully or resume at the basement? | Phase 6 | Full reset to Boot |
| 6 | Should the **payout-scaling variant** ever ship as an easy mode? | Phase 7 | Debug-only; not shipped |
| 7 | Any **content warning** on the start screen? A cozy game that becomes chase-horror has an argument for one, but it also spoils the twist | Phase 7 | None on-screen; a line in the store description instead |
| 8 | **Reload-mid-basement** currently restarts the sequence at frame 1 (EC-3). Acceptable, or should it resume at the exact frame? | Phase 5 | Restart at frame 1 — the pacing matters more than the convenience |

---

*End of PRD-FA-001. Companion document: [QFD-FA-001](QFD-Froggy-Arcade.md).*
