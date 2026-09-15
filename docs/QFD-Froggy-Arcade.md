# Quality Function Deployment — *Froggy Arcade*

**Document:** QFD-FA-001
**Revision:** 1.0
**Date:** 2026-09-07
**Owner:** KaTim128
**Product:** *Froggy Arcade* — browser game (Vite + TypeScript, Phaser 3, Three.js, Howler.js)
**Status:** Baseline — approved for Phase 1 entry

---

## Table of Contents

1. [Purpose & Method](#1-purpose--method)
2. [Voice of the Customer (VOC) Register](#2-voice-of-the-customer-voc-register)
3. [Affinity Grouping & Kano Classification](#3-affinity-grouping--kano-classification)
4. [Customer Requirements (WHATs) with Weights](#4-customer-requirements-whats-with-weights)
5. [Technical Characteristics (HOWs)](#5-technical-characteristics-hows)
6. [House of Quality — Relationship Matrix](#6-house-of-quality--relationship-matrix)
7. [Technical Importance & Priority Ranking](#7-technical-importance--priority-ranking)
8. [The Roof — Technical Correlations & Conflicts](#8-the-roof--technical-correlations--conflicts)
9. [Target Values & Verification Methods](#9-target-values--verification-methods)
10. [Competitive Benchmarking](#10-competitive-benchmarking)
11. [Phase 2 — Design Deployment (Froggy Dual-State Art Spec)](#11-phase-2--design-deployment-froggy-dual-state-art-spec)
12. [Phase 3 — Process Deployment (Build Order Mapping)](#12-phase-3--process-deployment-build-order-mapping)
13. [Phase 4 — Quality Control Deployment (Acceptance Trace)](#13-phase-4--quality-control-deployment-acceptance-trace)
14. [Design FMEA — Risk Register](#14-design-fmea--risk-register)
15. [Conflicts, Trade-offs & Decisions Log](#15-conflicts-trade-offs--decisions-log)
16. [Traceability Matrix](#16-traceability-matrix)
17. [Open Questions for the Customer](#17-open-questions-for-the-customer)

---

## 1. Purpose & Method

This document translates the customer brief (§0–§15 of the pitch) into measurable engineering characteristics, ranks those characteristics by how much customer value they carry, and traces each one forward to a build phase and an acceptance test.

**Method:** classical four-phase QFD (Akao).

| Phase | Translation | Section |
|---|---|---|
| 1 | Customer requirements → Technical characteristics | §4–§10 |
| 2 | Technical characteristics → Design/part characteristics | §11 |
| 3 | Design characteristics → Process (build order) | §12 |
| 4 | Process → Quality control & acceptance | §13 |

**Relationship symbols:** ● Strong = 9 · ○ Moderate = 3 · △ Weak = 1 · *(blank)* = none
**Correlation symbols (roof):** ++ strongly reinforcing · + reinforcing · − conflicting · −− strongly conflicting

**Weighting scale:** 1 (nice to have) → 5 (the product fails without it).

**Governing constraint from the customer, treated as non-negotiable:**
> *"Ask me before deviating on the tone rules: the pixel/non-pixel split for Froggy, and the total silence after the break-in. Those two carry the whole horror turn."*

These two are therefore modelled as **hard constraints**, not weighted trade-offs. They appear in the matrix at weight 5 and additionally as gate conditions in §13.

---

## 2. Voice of the Customer (VOC) Register

Verbatim customer statements, tagged to their source section in the brief.

| ID | Verbatim VOC | Source | Affinity |
|---|---|---|---|
| VOC-01 | "On the surface it's a cozy 2D pixel-art arcade… Underneath is a horror game that only unlocks if the player goes broke and then breaks the rules." | §0 | Tone |
| VOC-02 | "The tone flip is the entire point — nothing before the break should hint at the horror except in ways the player only recognizes on a second playthrough." | §0 | Tone |
| VOC-03 | "You're homeless. You found $10 on the street. You spend it all at an arcade hoping to win a prize you can sell to a kid outside for real cash." | §0 | Fantasy |
| VOC-04 | "Use a web stack so everything runs in the browser and is easy to test." | §1 | Platform |
| VOC-05 | "Only one renderer is active at a time; tear the other down on transition." | §1 | Platform |
| VOC-06 | "Pixel art must use `pixelArt: true` / NEAREST filtering." | §1 | Art |
| VOC-07 | "After each phase, the game should be runnable and playable up to that point. Commit at the end of each phase." | §2 | Delivery |
| VOC-08 | "Expose a dev-only debug panel… You will need this constantly while building." | §3.1 | Delivery |
| VOC-09 | "Tokens are the only currency; there is no way to buy more once the $10 is spent. That's the whole tension." | §3.2 | Economy |
| VOC-10 | "Every tier is a 2× on a win, so the expected value is negative unless the player wins more than half the time — which is exactly the pressure you want." | §3.2 | Economy |
| VOC-11 | "The point of the game is going broke." | §3.2 | Economy |
| VOC-12 | "Inside arcade (after break-in): *total silence.*… do not add a drone or a stinger, silence is scarier." | §3.3 | Audio |
| VOC-13 | "The manager crossfades over 800ms on scene change." | §3.3 | Audio |
| VOC-14 | "a wet hopping sound that gets louder as Froggy closes distance." | §3.3 | Audio |
| VOC-15 | "Froggy is the only non-pixel element — he is smooth, clean, vector-style 2D. He should look subtly *wrong*… Never explain this." | §6 | Tone / Art |
| VOC-16 | "Line 6 should have a half-second hold before and after, and Froggy's idle animation should stop completely during it. Then snap back to bouncy. That's the only foreshadowing." | §6 | Tone |
| VOC-17 | "Music cuts out. Cabinet bleeps stop. Lights dim by 30%… *(long pause, three seconds, no animation)* 'You can go now.'" | §6 | Tone |
| VOC-18 | "There's a small handbell and a sign: 'RING FOR SERVICE.' Ringing it does nothing. Ever." | §7 | Tone |
| VOC-19 | "Deduct the cost on launch, award the reward on win. Every game needs a `[Esc] Quit` that forfeits the entry cost." | §8 | Economy |
| VOC-20 | "AI plays a decent-but-beatable strategy… AI paddle tracks the puck with a deliberate reaction delay so it's winnable." | §8 | Minigames |
| VOC-21 | "roughly 1 in 20 frogs that pop up is the smooth non-pixel Froggy… he just stares at the player for a beat." | §8 | Tone |
| VOC-22 | "Call it something like 'CHOMP-MAN' to keep it clearly a homage rather than a copy… Don't reproduce Namco's assets." | §8 | Legal |
| VOC-23 | "Give the player a real chance to just walk away… The ones who do deserve to have been offered it." | §9 | Tone |
| VOC-24 | "No audio except the player's footsteps. The silence is the design." | §9 | Audio |
| VOC-25 | "Let the crossfade be slow. Let the player sit in each frame. The pacing *is* the horror." | §10 | Horror |
| VOC-26 | "Do not light it. Do not animate it… most players should not be sure they saw anything." | §10 | Horror |
| VOC-27 | "revealed only during the flicker frames — the words **TURN AROUND**." | §10 | Horror |
| VOC-28 | "**Froggy is filling the frame.** Full-screen, non-pixel, smooth-rendered, wrong." | §10 | Horror |
| VOC-29 | "Froggy's speed is 0.5 × W — exactly half, as specified. He never gets faster." | §11 | Horror |
| VOC-30 | "Because he's slower, the danger is *navigation*… Add a couple of forks that dead-end." | §11 | Horror |
| VOC-31 | "Keep him mostly out of the flashlight cone; let the audio do the work." | §11 | Horror |
| VOC-32 | "Keep the level short. Ninety seconds of tension beats five minutes of a maze." | §11 | Horror |
| VOC-33 | "Froggy stands in the doorway, not chasing, just watching, until the player is out of frame." | §12 | Horror |
| VOC-34 | "After 15 seconds, wipe localStorage game progress (keep settings) and return to the start screen." | §12 | Platform |
| VOC-35 | "The same palette desaturated ~70% and shifted blue. Reuse the same tiles so the player recognizes the space." | §13 | Art |
| VOC-36 | "32-color limit… Internal resolution 320×180, scaled ×4 to 1280×720." | §13 | Art |
| VOC-37 | "He should never be affected by the pixel-scale filter. In the horror sections, render him larger than his 2D-section scale." | §13 | Art |
| VOC-38 | "Build everything with flat colored rectangles and text labels first. Do not block Phase 1–6 on art." | §13 | Delivery |
| VOC-39 | *(reference image)* "above is the image of how froggy the frog should look like in 2D but during the chase scene it should be scary as hell." | Image | Art / Horror |
| VOC-40 | "Settings persist across a reload." | §14.1 | Platform |
| VOC-41 | "The back door route is only reachable via `route === 'ejected'`." | §14.6 | Systems |
| VOC-42 | "The 3D chase is escapable by a competent player and lethal to a lost one." | §14.8 | Horror |

---

## 3. Affinity Grouping & Kano Classification

| Affinity group | VOC IDs | Kano dominant class | Implication |
|---|---|---|---|
| **Tone & narrative turn** | 01, 02, 15, 16, 17, 18, 21, 23 | **Excitement** (with one Must: the horror gate) | Under-delivery is invisible to first-time players; over-delivery (telegraphing) *destroys* value. Restraint is the deliverable. |
| **Economy & pressure** | 03, 09, 10, 11, 19 | **Performance** | Player satisfaction scales with how *fair-but-doomed* the maths feels. Tunable. |
| **Minigames** | 19, 20, 22 | **Must-be** | Six working games are table stakes; nobody praises them, everybody notices a broken one. |
| **Horror sequences** | 25, 26, 27, 28, 29, 30, 31, 32, 33, 39, 42 | **Excitement** | The payoff. Pacing errors here waste every prior hour of build. |
| **Audio** | 12, 13, 14, 24 | **Must-be (silence) + Excitement (chase mix)** | Silence is a *specification*, not an absence — it must be asserted in test. |
| **Art & presentation** | 06, 35, 36, 37, 39 | **Must-be** | Consistency is the carrier for VOC-15's deliberate inconsistency. |
| **Platform & persistence** | 04, 05, 34, 40 | **Must-be** | Invisible when right, fatal when wrong. |
| **Delivery discipline** | 07, 08, 38 | **Must-be (internal customer)** | Protects the schedule; not player-facing. |

**Kano note on the reverse quadrant:** VOC-02 and VOC-15 are *reverse-quality* if implemented too strongly. A Froggy who reads as obviously sinister in Act 1 makes the product **worse**. This is captured in §14 as the highest-severity design risk (RPN 240).

---

## 4. Customer Requirements (WHATs) with Weights

34 requirements, weighted 1–5. Weight × relationship strength drives §7.

### 4.1 Tone & Narrative Turn

| ID | Customer requirement | Wt | Kano | Traces to VOC |
|---|---|---|---|---|
| **T1** | The cozy surface never leaks the horror | 5 | Reverse-risk | 01, 02 |
| **T2** | Froggy feels subtly *wrong* from first sight, without explanation | 5 | Excite | 15 |
| **T3** | Horror unlocks only by going broke **and** then trespassing | 5 | Must | 01, 41 |
| **T4** | A second playthrough reveals foreshadowing that was always there | 4 | Excite | 02, 16, 21 |
| **T5** | Post-break-in arcade is *totally* silent | 5 | Must (hard constraint) | 12, 24 |
| **T6** | The player is genuinely offered a way to walk away | 3 | Excite | 23 |

### 4.2 Economy & Pressure

| ID | Customer requirement | Wt | Kano | Traces to VOC |
|---|---|---|---|---|
| **E1** | Fixed 20-token bankroll; no way to top up, ever | 5 | Must | 03, 09 |
| **E2** | 2× on a win, total loss on a loss; EV negative overall | 4 | Perf | 10 |
| **E3** | Charity tokens fire exactly once per run | 5 | Must | §6, 14.3 |
| **E4** | Second bust ejects; the front door is then permanently locked | 5 | Must | §6, 14.4 |
| **E5** | The prize ("good") ending is reachable but hard | 3 | Perf | 11, 14.5 |
| **E6** | Token changes are immediately legible to the player | 3 | Perf | §7 |

### 4.3 Minigames

| ID | Customer requirement | Wt | Kano | Traces to VOC |
|---|---|---|---|---|
| **M1** | All six games are genuinely winnable *and* losable | 5 | Must | 14.2 |
| **M2** | Opponent AI is beatable but not trivial | 4 | Perf | 20 |
| **M3** | Cost deducted on launch, reward on win, `Esc` forfeits | 5 | Must | 19 |
| **M4** | Every game is an original homage; zero licensed assets | 5 | Must (legal) | 22 |
| **M5** | The Whack-a-Frog cameo unsettles and is never explained | 3 | Excite | 21 |

### 4.4 Horror Sequences

| ID | Customer requirement | Wt | Kano | Traces to VOC |
|---|---|---|---|---|
| **H1** | Basement pacing is slow, forward-only, unskippable | 5 | Perf | 25, 14.7 |
| **H2** | The corridor-5 figure is barely perceptible and never confirmed | 4 | Excite | 26 |
| **H3** | "TURN AROUND" appears only inside flicker frames | 4 | Excite | 27 |
| **H4** | The jumpscare lands: full-frame, smooth-rendered, loud, shaken | 5 | Perf | 28 |
| **H5** | The chase is escapable by a competent player, lethal to a lost one | 5 | Perf | 42 |
| **H6** | Froggy's chase speed is exactly 0.5× player, never faster | 4 | Must | 29 |
| **H7** | The chase is ~90 seconds of tension, not a five-minute maze | 4 | Perf | 32 |
| **H8** | Chase-Froggy is recognisably *the same frog*, made monstrous | 5 | Excite | 39 |

### 4.5 Presentation & Platform

| ID | Customer requirement | Wt | Kano | Traces to VOC |
|---|---|---|---|---|
| **P1** | 32-colour pixel world at 320×180 ×4 — Froggy excepted | 4 | Must | 06, 36, 37 |
| **P2** | Post-break palette is the *same tiles*, desaturated and blue-shifted | 4 | Perf | 35 |
| **P3** | Settings persist across reload; the manual is readable in-game | 4 | Must | 40, §5 |
| **P4** | Ambience crossfades over 800 ms on every scene change | 3 | Perf | 13 |
| **P5** | Runs in a desktop browser, letterboxed, integer-scaled, smooth | 5 | Must | 04 |

### 4.6 Delivery Discipline (internal customer)

| ID | Customer requirement | Wt | Kano | Traces to VOC |
|---|---|---|---|---|
| **D1** | Runnable and committed at the end of every phase | 4 | Must | 07 |
| **D2** | Debug panel reaches any scene or state instantly | 3 | Must | 08 |
| **D3** | Placeholder art never blocks Phases 1–6 | 4 | Must | 38 |
| **D4** | No backend; `localStorage` is the entire persistence layer | 4 | Must | 04, 34 |

---

## 5. Technical Characteristics (HOWs)

24 measurable engineering characteristics, grouped into three blocks (A/B/C) so the matrix stays legible.

### Block A — Architecture & Platform

| ID | Technical characteristic | Unit of measure | Direction |
|---|---|---|---|
| **A1** | Renderer lifecycle manager (Phaser ⇄ Three mount/teardown) | ms to swap; # leaked contexts | ↓ |
| **A2** | Scene graph + route-guard state machine | # illegal transitions reachable | ↓ (target 0) |
| **A3** | `GameState` store + versioned `localStorage` serializer | # fields round-tripped; schema version | ↑ |
| **A4** | Fixed 320×180 logical buffer + integer letterbox scaler | scale factor purity (integer only) | ↑ |
| **A5** | Frame & asset budget enforcement | fps floor; initial bundle MB | ↑ / ↓ |
| **A6** | Dev debug panel (backtick toggle) | % of scenes/states directly reachable | ↑ |
| **A7** | Phase-gate script (build + smoke run + commit) | # phases passing gate | ↑ |
| **A8** | Asset registry `assets/PLACEHOLDER.md` + placeholder renderer | % assets registered with target dims | ↑ |

### Block B — Systems, Economy & Minigames

| ID | Technical characteristic | Unit of measure | Direction |
|---|---|---|---|
| **B1** | Token ledger API (single writer, atomic debit/credit) | # unmediated token mutations | ↓ (target 0) |
| **B2** | Broke-detector + one-shot latches (`charityUsed`, `route`) | # times charity can fire per run | = 1 |
| **B3** | `Minigame` interface conformance harness | % of 6 games passing contract test | ↑ (100%) |
| **B4** | Per-game difficulty constants + win-rate instrumentation | measured win rate per game (%) | → target band |
| **B5** | Prize catalogue + redemption gate | # prizes; min threshold (tokens) | = spec |
| **B6** | Central input map (single source for the in-game manual) | # bindings duplicated in code | ↓ (target 0) |
| **B7** | Original-IP provenance checklist | # third-party assets shipped | ↓ (target 0) |
| **B8** | HUD feedback system (coin spin, low-token flash, cost badges) | ms from ledger event to visible feedback | ↓ |

### Block C — Audio, Art & Horror Sequencing

| ID | Technical characteristic | Unit of measure | Direction |
|---|---|---|---|
| **C1** | Three-bus Howler mixer with persisted gains | # buses honoured per scene (3) | ↑ |
| **C2** | Per-scene ambience declaration + 800 ms crossfade | crossfade duration (ms); deviation | → 800 |
| **C3** | Silence contract (asserted zero-source scenes) | peak dBFS in `ArcadeDark` (footsteps excepted) | ↓ (−∞ ambience) |
| **C4** | Distance-mapped chase audio (hop loudness ∝ proximity) | gain-vs-distance curve fidelity | ↑ |
| **C5** | Pixel pipeline (NEAREST, ≤32-colour palette, palette-shift) | # unique colours in world layer | ≤ 32 |
| **C6** | Froggy smooth-layer renderer + variant state machine | # variants; filter-bypass verified | = spec |
| **C7** | Slideshow engine (hotspots, 600 ms crossfade, forward-only, timed holds, flicker mask) | # skip paths; hold accuracy (ms) | ↓ / → |
| **C8** | Chase level graph + pursuit AI (0.5× speed, direct path, dead-end forks, fog/flashlight) | speed ratio; optimal-route seconds | = 0.5 / ≤ 90 |

---

## 6. House of Quality — Relationship Matrix

The full matrix is split into three column blocks sharing the same 34 WHAT rows. `Wt` = weight from §4.

### 6.1 Block A — Architecture & Platform

| WHAT | Wt | A1 | A2 | A3 | A4 | A5 | A6 | A7 | A8 |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| T1 Cozy never leaks | 5 | | ○ | | | | △ | | |
| T2 Froggy subtly wrong | 5 | | | | ○ | | | | |
| T3 Horror gated by broke+trespass | 5 | | ● | ○ | | | | | |
| T4 Replay reveals foreshadowing | 4 | | | △ | | | | | |
| T5 Total silence post-break | 5 | | | | | | | | |
| T6 Real chance to walk away | 3 | | ○ | | | | | | |
| E1 Fixed 20-token bankroll | 5 | | | ● | | | | | |
| E2 2× win / total loss, EV− | 4 | | | | | | | | |
| E3 Charity fires exactly once | 5 | | | ○ | | | | | |
| E4 Second bust ejects, door locks | 5 | | ● | ○ | | | | | |
| E5 Good ending reachable-but-hard | 3 | | | | | | | | |
| E6 Token changes legible | 3 | | | | | | | | |
| M1 Six games win/lose-able | 5 | | | | | ○ | | | |
| M2 AI beatable, not trivial | 4 | | | | | | | | |
| M3 Cost on launch / Esc forfeits | 5 | | | | | | | | |
| M4 Original homages only | 5 | | | | | | | | ○ |
| M5 Whack-a-Frog cameo unsettles | 3 | | | | | | | | |
| H1 Basement slow, forward-only | 5 | | ○ | | | | | | |
| H2 Corridor-5 figure barely there | 4 | | | | ○ | | | | |
| H3 TURN AROUND in flicker only | 4 | | | | | | | | |
| H4 Jumpscare lands hard | 5 | △ | | | | | | | |
| H5 Escapable / lethal | 5 | ○ | | | | ○ | | | |
| H6 Froggy speed exactly 0.5× | 4 | | | | | ○ | | | |
| H7 ~90 s of tension | 4 | | | | | △ | | | |
| H8 Same frog, made monstrous | 5 | | | | | | | | |
| P1 32-colour, 320×180 ×4 | 4 | | | | ● | | | | ○ |
| P2 Same tiles, desat + blue | 4 | | | △ | | | | | ○ |
| P3 Settings persist, manual readable | 4 | | | ● | | | | | |
| P4 800 ms ambience crossfade | 3 | | | | | | | | |
| P5 Browser, letterboxed, smooth | 5 | ○ | | | ● | ● | | | |
| D1 Runnable & committed per phase | 4 | | | | | | ○ | ● | ○ |
| D2 Debug panel reaches anything | 3 | | ○ | ○ | | | ● | | |
| D3 Placeholders never block | 4 | | | | | | | ○ | ● |
| D4 No backend, localStorage only | 4 | | | ● | | | | △ | |
| **Absolute technical importance** | | **35** | **138** | **179** | **108** | **91** | **44** | **52** | **87** |

### 6.2 Block B — Systems, Economy & Minigames

| WHAT | Wt | B1 | B2 | B3 | B4 | B5 | B6 | B7 | B8 |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| T1 Cozy never leaks | 5 | | ○ | | | | | | △ |
| T2 Froggy subtly wrong | 5 | | | | | | | | △ |
| T3 Horror gated by broke+trespass | 5 | ○ | ● | | | | | | |
| T4 Replay reveals foreshadowing | 4 | | | | | | | | △ |
| T5 Total silence post-break | 5 | | | | | | | | |
| T6 Real chance to walk away | 3 | | △ | | | ○ | | | |
| E1 Fixed 20-token bankroll | 5 | ● | | | | ○ | | | |
| E2 2× win / total loss, EV− | 4 | ● | | ○ | ● | | | | |
| E3 Charity fires exactly once | 5 | ○ | ● | | | | | | |
| E4 Second bust ejects, door locks | 5 | | ● | | | | | | |
| E5 Good ending reachable-but-hard | 3 | ○ | | | ○ | ● | | | |
| E6 Token changes legible | 3 | ○ | | | | | | | ● |
| M1 Six games win/lose-able | 5 | | | ● | ● | | | | |
| M2 AI beatable, not trivial | 4 | | | ○ | ● | | ○ | | |
| M3 Cost on launch / Esc forfeits | 5 | ● | | ● | | | ○ | | |
| M4 Original homages only | 5 | | | | | | | ● | |
| M5 Whack-a-Frog cameo unsettles | 3 | | | ○ | | | | | |
| H1 Basement slow, forward-only | 5 | | | | | | | | |
| H2 Corridor-5 figure barely there | 4 | | | | | | | | |
| H3 TURN AROUND in flicker only | 4 | | | | | | | | |
| H4 Jumpscare lands hard | 5 | | | | | | | | |
| H5 Escapable / lethal | 5 | | | | | | ○ | | |
| H6 Froggy speed exactly 0.5× | 4 | | | | | | | | |
| H7 ~90 s of tension | 4 | | | | | | | | |
| H8 Same frog, made monstrous | 5 | | | | | | | | |
| P1 32-colour, 320×180 ×4 | 4 | | | | | | | | |
| P2 Same tiles, desat + blue | 4 | | | | | | | | |
| P3 Settings persist, manual readable | 4 | | | | | | ● | | |
| P4 800 ms ambience crossfade | 3 | | | | | | | | |
| P5 Browser, letterboxed, smooth | 5 | | | | | | | | |
| D1 Runnable & committed per phase | 4 | | | ○ | | | | | |
| D2 Debug panel reaches anything | 3 | | | | | | | | |
| D3 Placeholders never block | 4 | | | | | | | | |
| D4 No backend, localStorage only | 4 | | | | | | | | |
| **Absolute technical importance** | | **174** | **153** | **135** | **126** | **51** | **78** | **45** | **41** |

### 6.3 Block C — Audio, Art & Horror Sequencing

| WHAT | Wt | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| T1 Cozy never leaks | 5 | | ○ | | | ○ | ● | | |
| T2 Froggy subtly wrong | 5 | | | | | ○ | ● | | |
| T3 Horror gated by broke+trespass | 5 | | | | | | | | |
| T4 Replay reveals foreshadowing | 4 | | △ | | | | ○ | ○ | |
| T5 Total silence post-break | 5 | ○ | ● | ● | | | | | |
| T6 Real chance to walk away | 3 | | | | | | | | |
| E1 Fixed 20-token bankroll | 5 | | | | | | | | |
| E2 2× win / total loss, EV− | 4 | | | | | | | | |
| E3 Charity fires exactly once | 5 | | | | | | | | |
| E4 Second bust ejects, door locks | 5 | | | | | | | | |
| E5 Good ending reachable-but-hard | 3 | | | | | | | | |
| E6 Token changes legible | 3 | △ | | | | | | | |
| M1 Six games win/lose-able | 5 | | | | | | | | |
| M2 AI beatable, not trivial | 4 | | | | | | | | |
| M3 Cost on launch / Esc forfeits | 5 | | | | | | | | |
| M4 Original homages only | 5 | | | | | △ | | | |
| M5 Whack-a-Frog cameo unsettles | 3 | | | | | ○ | ● | | |
| H1 Basement slow, forward-only | 5 | | ○ | | | | | ● | |
| H2 Corridor-5 figure barely there | 4 | | | | | ● | | ● | |
| H3 TURN AROUND in flicker only | 4 | | | | | ○ | | ● | |
| H4 Jumpscare lands hard | 5 | ○ | | | | | ● | ● | |
| H5 Escapable / lethal | 5 | | | | | | | | ● |
| H6 Froggy speed exactly 0.5× | 4 | | | | | | | | ● |
| H7 ~90 s of tension | 4 | | | | | | | | ● |
| H8 Same frog, made monstrous | 5 | | | | ○ | | ● | | ○ |
| P1 32-colour, 320×180 ×4 | 4 | | | | | ● | | | |
| P2 Same tiles, desat + blue | 4 | | | | | ● | | | |
| P3 Settings persist, manual readable | 4 | ● | | | | | | | |
| P4 800 ms ambience crossfade | 3 | ○ | ● | | | | | | |
| P5 Browser, letterboxed, smooth | 5 | | | | | | | | |
| D1 Runnable & committed per phase | 4 | | | | | | | | |
| D2 Debug panel reaches anything | 3 | | | | | | | | |
| D3 Placeholders never block | 4 | | | | | △ | | | |
| D4 No backend, localStorage only | 4 | | | | | | | | |
| **Absolute technical importance** | | **78** | **106** | **45** | **15** | **168** | **219** | **174** | **132** |

---

## 7. Technical Importance & Priority Ranking

Absolute importance = Σ (customer weight × relationship strength). Grand total = **2474**.

| Rank | ID | Technical characteristic | Absolute | Relative | Priority |
|---:|---|---|---:|---:|---|
| 1 | **C6** | Froggy smooth-layer renderer + variant state machine | 219 | 8.9% | **P0** |
| 2 | **A3** | GameState store + localStorage serializer | 179 | 7.2% | **P0** |
| 3 | **B1** | Token ledger API | 174 | 7.0% | **P0** |
| 3= | **C7** | Slideshow engine (hotspots, holds, flicker mask) | 174 | 7.0% | **P0** |
| 5 | **C5** | Pixel pipeline (NEAREST, ≤32 palette, palette shift) | 168 | 6.8% | **P0** |
| 6 | **B2** | Broke-detector + one-shot latches | 153 | 6.2% | **P0** |
| 7 | **A2** | Scene graph + route guard | 138 | 5.6% | **P1** |
| 8 | **B3** | Minigame interface conformance harness | 135 | 5.5% | **P1** |
| 9 | **C8** | Chase level graph + pursuit AI | 132 | 5.3% | **P1** |
| 10 | **B4** | Difficulty constants + win-rate instrumentation | 126 | 5.1% | **P1** |
| 11 | **A4** | 320×180 buffer + integer letterbox scaler | 108 | 4.4% | **P1** |
| 12 | **C2** | Ambience declaration + 800 ms crossfade | 106 | 4.3% | **P1** |
| 13 | **A5** | Frame & asset budget enforcement | 91 | 3.7% | **P2** |
| 14 | **A8** | Asset registry + placeholder renderer | 87 | 3.5% | **P2** |
| 15= | **B6** | Central input map | 78 | 3.2% | **P2** |
| 15= | **C1** | Three-bus mixer with persisted gains | 78 | 3.2% | **P2** |
| 17 | **A7** | Phase-gate script | 52 | 2.1% | **P2** |
| 18 | **B5** | Prize catalogue + redemption gate | 51 | 2.1% | **P2** |
| 19= | **C3** | Silence contract | 45 | 1.8% | **P0 (constraint)** |
| 19= | **B7** | Original-IP provenance checklist | 45 | 1.8% | **P0 (legal)** |
| 21 | **A6** | Debug panel | 44 | 1.8% | **P2** |
| 22 | **B8** | HUD feedback system | 41 | 1.7% | **P3** |
| 23 | **A1** | Renderer lifecycle manager | 35 | 1.4% | **P1 (enabling)** |
| 24 | **C4** | Distance-mapped chase audio | 15 | 0.6% | **P3** |

### 7.1 Reading the ranking

- **C6 tops the list by a clear margin (8.9%).** Froggy's rendering and his variant state machine touch tone, art, both jumpscares, the Whack-a-Frog cameo and the chase. He is not a sprite; he is a subsystem. Build him as one — see §11.
- **Three "boring" plumbing items (A3, B1, B2) hold 20.4% between them.** The narrative gate is an *economy* feature. If the ledger and the latches are loose, the horror unlocks at the wrong time and the entire product fails, regardless of art quality.
- **C3 (silence) and B7 (IP provenance) rank low numerically but are promoted to P0 by fiat.** Low absolute importance here is an artefact of each mapping to a single requirement; both are pass/fail gates, not sliders. *QFD ranks effort against value; it does not overrule constraints.*
- **C4 (chase audio) ranks last but is cheap.** Do not cut it — 0.6% of a matrix is not 0.6% of the felt experience, and it is roughly an afternoon of work.

---

## 8. The Roof — Technical Correlations & Conflicts

Only non-zero correlations are listed.

### 8.1 Reinforcing

| Pair | Corr | Note |
|---|:--:|---|
| A3 ⇄ B1 | ++ | The ledger is the store's principal client; one serializer, one writer. |
| A3 ⇄ B2 | ++ | Latches live in the persisted state; the reset in §12 must clear them. |
| A2 ⇄ B2 | ++ | Route guard reads the latch; a single `canEnter(scene)` predicate serves both. |
| C5 ⇄ A4 | ++ | Integer scaling is what makes NEAREST filtering look correct. |
| C5 ⇄ C6 | ++ | The smooth layer only reads as *wrong* because the pixel pipeline is strict everywhere else. |
| C1 ⇄ C2 ⇄ C3 | ++ | One mixer; silence is a declared ambience of "none", not a special case. |
| A8 ⇄ A7 | + | Phase gate can assert every referenced asset appears in `PLACEHOLDER.md`. |
| B3 ⇄ B4 | + | Conformance harness is the natural place to log win rates. |
| B6 ⇄ P3 manual | + | Rendering the manual from the input map keeps it true forever. |
| C7 ⇄ C6 | + | The slideshow's final frame *is* a Froggy variant render. |
| A1 ⇄ A5 | + | Clean teardown is most of the frame-budget story on the Phaser→Three swap. |

### 8.2 Conflicting

| Pair | Corr | Conflict | Resolution |
|---|:--:|---|---|
| **C5 ⇄ C6** | **−** | A strict global pixel filter will eat the one element that must escape it. | Render Froggy to a **separate, unfiltered canvas layer composited above** the scaled world buffer. Never route him through the 320×180 buffer. This is the single most important architectural decision in the project. |
| **C6 ⇄ A1** | − | Froggy exists in both Phaser scenes and the Three.js chase; two renderers, one character. | Author him as **resolution-independent source art (SVG/vector)** rasterised per-context: sprite atlas for Phaser, camera-facing textured plane or lightweight mesh for Three. One source of truth, two consumers. |
| **H1 (slow pacing) ⇄ H7 (short chase)** | − | Two opposite tempo requirements in adjacent scenes. | Intentional. The basement's slowness is what makes 90 s feel long. Do not "balance" them — the whiplash is the design. |
| **C3 (silence) ⇄ P4 (800 ms crossfade)** | − | A crossfade *to nothing* can read as a bug. | Crossfade the outgoing bed to zero over 800 ms **before** the scene's first footstep is possible; hold ≥1 s of true silence before player input is accepted. |
| **E5 (good ending reachable) ⇄ E1/E2 (doomed economy)** | −− | 20 tokens vs a 200-token prize is a near-impossible grind. | Accept the tension; it is the thesis (VOC-11). Ship the tiered prize list (200/250/350/500/750) and let the payout-scaling variant sit behind a debug flag for playtesting only. **Do not raise payouts in the shipped build without customer sign-off.** |
| **H2 (barely perceptible figure) ⇄ P5 (varied monitors)** | −− | A figure tuned "near background colour" may be invisible on one display and obvious on another. | Author the figure at a fixed ΔE from the background *in palette index space*, verify on a calibrated sRGB target, and clamp brightness/gamma post-processing to zero in the basement scenes. Accept that some players never see it — that is within spec. |
| **D3 (placeholders) ⇄ T2/H8 (Froggy must land)** | − | Froggy cannot be a grey rectangle; his wrongness *is* a mechanic. | Exception to the placeholder rule: **Froggy's cozy variant is a Phase 2 art deliverable, not a placeholder.** The reference image is the spec. Everything else stays rectangles. |
| **B7 (original IP) ⇄ M1 (recognisable homages)** | − | The games must read as Pac-Man/Tekken without being them. | Homage at the level of *mechanics and layout language*, never assets, names, sounds or maze geometry. Checklist in §13.4. |

---

## 9. Target Values & Verification Methods

| ID | Characteristic | Target | Verification |
|---|---|---|---|
| A1 | Renderer swap | ≤ 400 ms; 0 leaked WebGL contexts across 20 swaps | Manual swap loop + `WEBGL_lose_context` counter |
| A2 | Route guard | 0 reachable illegal transitions | Unit test enumerating all scene pairs vs `route` values |
| A3 | State persistence | 100% of `GameState` fields round-trip; schema `v1` with migration stub | Round-trip unit test + manual reload |
| A4 | Scaler | Integer factors only (×1…×6); letterbox bars, never stretch | Resize sweep 800→2560 px, assert integer scale |
| A5 | Performance | ≥ 60 fps sustained on a 2020 mid-range laptop; ≤ 5 MB initial bundle | `performance.now()` histogram; `vite build` report |
| A6 | Debug panel | 100% of scenes + token/route/key setters reachable from `` ` `` | Manual checklist |
| A7 | Phase gate | 7/7 phases build clean and are playable to that point | CI script per phase tag |
| A8 | Asset registry | 100% of referenced assets listed with intended dimensions | Script diffs asset refs vs `PLACEHOLDER.md` |
| B1 | Token ledger | 0 token mutations outside the ledger API; balance never < 0 | `grep`-based lint + property test |
| B2 | Latches | Charity fires exactly 1× per run; 2nd bust always ejects | Scripted playthrough test |
| B3 | Minigame contract | 6/6 games pass launch/complete/forfeit contract | Automated contract test per game |
| B4 | Win rates | TTT 45–60%, Hockey 45–60%, Hoops 40–55%, Whack 40–55%, Pinball 30–45%, Poker 30–45%, Fighter 30–45% | 200 scripted/AI-vs-AI runs per game |
| B5 | Prizes | 5 prizes; min 200 tokens; redemption blocked below cost | Unit test |
| B6 | Input map | 0 duplicated bindings; manual rendered from the map | Manual renders from map object; visual check |
| B7 | IP provenance | 0 third-party or licensed assets; 0 trademarked names | Asset audit checklist signed per phase |
| B8 | HUD feedback | ≤ 100 ms ledger-event → visible change; red flash at ≤ 3 tokens | Frame capture |
| C1 | Mixer | 3 buses honoured in 100% of scenes; gains persist across reload | Per-scene audio assertion + reload test |
| C2 | Crossfade | 800 ms ± 50 ms on every scene change | Instrumented gain log |
| C3 | **Silence** | `ArcadeDark` + basement: **0 non-footstep sources instantiated** (not merely muted) | Assert the scene's source list length is 0; peak-meter capture |
| C4 | Chase audio | Hop gain monotonically increasing as distance decreases; audible at 20 m, dominant at 3 m | Distance sweep with meter |
| C5 | Pixel pipeline | ≤ 32 unique colours in the world layer; NEAREST on all world textures; post-break = same tiles, −70% sat, hue-shifted blue | Palette-count script on rendered frames |
| C6 | Froggy | 3 variants (cozy / uncanny / predator); composited **outside** the pixel buffer; verified un-filtered at every scale | Zoom test — his edges must stay smooth while tiles stay blocky |
| C7 | Slideshow | 10 frames; 600 ms crossfade; 0 forward-skip paths; 4.0 s ± 100 ms forced hold on frame 9; TURN AROUND visible only in flicker frames | Frame-by-frame capture; input fuzzing for skip paths |
| C8 | Chase | Speed ratio exactly 0.500 and constant; optimal route ≤ 90 s; ≥ 2 dead-end forks; Froggy in flashlight cone < 20% of the run | Telemetry over 20 playtest runs |

---

## 10. Competitive Benchmarking

Rated 1–5 against the customer requirements that matter most. "Us (target)" is where this build intends to land.

| Requirement | *FNAF* | *Doki Doki Literature Club* | Generic itch.io "cursed arcade" jam game | **Us (target)** |
|---|:--:|:--:|:--:|:--:|
| T1 Cozy surface never leaks | 2 | **5** | 2 | **5** |
| T2 Mascot reads subtly wrong | 4 | 4 | 3 | **5** |
| T3 Horror earned by player choice | 2 | 3 | 1 | **5** |
| E1/E2 Economic pressure is real | 3 | 1 | 1 | **5** |
| M1 Minigames are actually good | 1 | 2 | 2 | **4** |
| H4 Jumpscare craft | **5** | 4 | 3 | 4 |
| H5 Chase design | 3 | n/a | 2 | **4** |
| P1 Art consistency | 4 | 4 | 2 | **5** |
| Audio restraint / use of silence | 3 | 3 | 1 | **5** |

**Read:** the differentiators are **T3 (horror the player has to earn through economic failure)** and **audio restraint**. Nothing in the comparison set makes the player *go broke* to unlock the turn. That is the product's competitive position, and it is carried by B1/B2/A2 — the plumbing — far more than by the jumpscare itself. Note also that we deliberately do **not** try to out-jumpscare *FNAF*: one well-placed scare beats six.

---

## 11. Phase 2 — Design Deployment (Froggy Dual-State Art Spec)

C6 is the top-ranked characteristic, so it gets a full deployment table. The reference image (four cozy poses) is the **normative** spec for the 2D state.

### 11.1 Palette — cozy Froggy (from the reference image)

| Role | Hex (approx.) | Notes |
|---|---|---|
| Body / limbs | `#3FE39B` | Spring green, flat fill, no dithering |
| Body drop-shadow | `#12B26B` | Hard-edged offset shadow, down-right |
| Belly | `#FCDC3C` | Wide yellow oval covering the lower two-thirds |
| Belly rim | `#F5C46B` | Soft peach outline, 2–3 px equivalent |
| Eye ring | `#F5C46B` | Same peach as the belly rim |
| Pupil | `#111111` | Large in poses 1–3; a tiny dot in pose 4 |
| Mouth interior | `#E01B1B` | Open-mouth pose only |
| Tongue | `#F55BB0` | Pink, glossy |

**Non-negotiable cozy-state rules**
- Vector/smooth rendering only: clean gradients permitted, **no dithering, no pixel grid, no NEAREST filtering**.
- Silhouette: wide dome head fused to a rounded body, two arms out to the sides, feet splayed. Readable as a single blob at 32 px.
- Four poses map to the four cozy animation states: **idle A**, **idle B (arm shift)**, **talking (open mouth)**, **blank stare (tiny pupils)**.
- The blank-stare pose is the uncanny lever. Use it for VOC-16 (line 6 of the tutorial), VOC-17 ("You can go now"), and the Whack-a-Frog cameo. **Never comment on it.**

### 11.2 Variant state machine

| Variant | Where used | Transform from cozy |
|---|---|---|
| **V0 — Cozy** | Tutorial, hub dialogue, charity | Reference image, unmodified. Bouncy idle, ~2 Hz. |
| **V1 — Uncanny** | Tutorial line 6, second bust, Whack-a-Frog cameo, basement frame 5 | *Identical art.* Only the **animation stops** and the pupils shrink to pose 4. Zero geometry change. The wrongness is behavioural, not visual. |
| **V2 — Predator** | Basement frame 10 jumpscare, the 3D chase, the outro doorway | Full monstrous render. Spec below. |

The customer's tone rules mean **V1 must never borrow anything from V2.** If a player can tell V1 from V0 by looking at a still frame, the foreshadowing has leaked.

### 11.3 V2 — Predator Froggy (the chase state)

VOC-39: *"during the chase scene it should be scary as hell."* The design constraint is that he must still be **the same frog** (H8, weight 5). Recognition is what makes it frightening; a generic monster is not scary here, it is just a different game.

**Keep (identity anchors — do not modify):**
- The overall silhouette proportions: dome head, fused body, splayed limbs.
- The yellow belly mass and its peach rim.
- The two-lobed eye placement, wide-set and high on the head.
- The smooth, non-pixel rendering — **more** conspicuous here, not less (VOC-37: render larger than his 2D scale).

**Transform (the horror):**

| Attribute | Cozy | Predator |
|---|---|---|
| Body hue | `#3FE39B` spring green | Same hue, −60% saturation, −35% value → sickly `#2A7D5C`; add a wet specular sheen |
| Belly | Clean flat yellow | Same yellow, mottled and jaundiced `#C9A62E`; the peach rim now reads as a seam |
| Eye ring | Peach ring | Ring becomes **exposed sclera** — the peach retreats into a thin bloodshot rim |
| Pupils | Big and friendly | Blown fully black, edge-to-edge, no highlight; or the pose-4 pinprick, held unblinking |
| Mouth | Small red arc with a pink tongue | Opens **past the width of the head**, hinged too far back; same `#E01B1B` interior, same `#F55BB0` tongue — now wet, stringing, over-long |
| Shadow | Flat cartoon offset shadow | A real cast shadow with contact darkening |
| Scale | Fits the dialogue box | Fills the frame; in 3D, ~1.4× player height |
| Animation | Bouncy 2 Hz idle | Wet hopping; no idle at all — he only ever approaches |

**The design principle:** *every element of the friendly design stays, and each one is pushed one step too far.* The pink tongue is the same pink. The yellow belly is the same yellow. That is why it works — the player recognises the mascot they were just laughing at.

### 11.4 Rendering deployment

| Design characteristic | Requirement |
|---|---|
| Source format | Vector (SVG) — resolution-independent, one source for both engines |
| Phaser consumption | Rasterised to a high-res atlas at load; drawn to an **unfiltered overlay canvas**, never the 320×180 buffer |
| Three.js consumption | Camera-facing textured plane (V2) with alpha; or low-poly mesh if budget allows — **must not** inherit scene fog tint enough to lose the green |
| Filter bypass test | At every window scale, tiles are blocky and Froggy's edges are smooth. Automated screenshot diff. |
| Scale rule | V2 renders at ≥ 1.3× his largest 2D on-screen size (VOC-37) |

---

## 12. Phase 3 — Process Deployment (Build Order Mapping)

Each build phase from §2 of the brief carries the technical characteristics it must deliver, and the exit gate that lets you commit and move on.

| Phase | Delivers (HOWs) | Exit gate |
|---|---|---|
| **1 — Skeleton** | A1, A2, A3, A4, A5, A6, A8, C1, D4 | Boot → StartScreen → walkable empty Arcade. Settings persist across reload. Debug panel opens. All art is rectangles. |
| **2 — Economy + hub** | B1, B2, B5, B6, B8, C2, **C6 (V0 + V1 only)** | Tokens spend and award through the ledger only. Tutorial plays once, with the line-6 freeze. Prize counter opens. Bell does nothing. |
| **3 — Minigames** | B3, B4, B7, C5 | 6/6 games pass the contract test and sit inside the §9 win-rate bands. Palette count ≤ 32. IP audit signed. |
| **4 — Broke path** | B2 (latches complete), A2 (route guard complete), C2, **C3** | Charity fires once. Second bust ejects. `route==='ejected'` is the only key to the back door. Post-break arcade instantiates zero ambience sources. |
| **5 — Basement** | C7, **C6 (V2 debut)** | 10 frames, correct hotspots, no skip path, 4 s hold, flicker-masked text, jumpscare hard-cuts to black. |
| **6 — 3D chase** | C8, C4, A1 (second renderer live) | Speed ratio exactly 0.5. Optimal route ≤ 90 s. Escapable by a competent player, lethal to a lost one over 20 playtests. |
| **7 — Ending + polish** | A5, A7, A8 closeout, full audio and art pass | Outro plays, "End" card, 15 s reset that wipes progress and keeps settings. `PLACEHOLDER.md` is empty or explicitly deferred. |

**Process rule carried from VOC-07:** a phase is not done because the code exists; it is done when the game is *playable from Boot to that point* and committed. A7 automates that check.

---

## 13. Phase 4 — Quality Control Deployment (Acceptance Trace)

The customer's ten acceptance criteria (§14 of the brief), mapped to the characteristics that satisfy them and the test that proves it.

| AC | Criterion | HOWs | Test |
|---|---|---|---|
| 1 | Start, read manual, adjust volume, settings persist | A3, C1, B6, P3 | Set all three sliders to distinct values, reload, assert restored |
| 2 | All six games winnable/losable, tokens correct | B1, B3, B4 | Contract test + 200-run win-rate sample per game |
| 3 | Charity fires exactly once per run | B2, A3 | Scripted: broke → charity → broke → assert no second charity |
| 4 | Second bust ejects; front door permanently locked | B2, A2 | Post-ejection, assert front door interaction returns `locked` in all states |
| 5 | 200+ tokens redeems a prize; the kid buys it | B1, B5, A2 | Debug-set 200 tokens, redeem, exit, sell — assert non-horror ending reached |
| 6 | Back door reachable **only** via `route === 'ejected'` | A2, B2 | Enumerate all routes; assert back door blocked for `normal`, `basement`, `chase`, `ended` |
| 7 | Basement plays fully; no forward skip except arrows | C7 | Input fuzz (keyboard mash, rapid clicks, double-click) on all 10 frames |
| 8 | Chase escapable by the competent, lethal to the lost | C8, C4 | 20 playtests: ≥ 80% of informed players escape; ≥ 70% of blind players die at least once |
| 9 | Outro → "End" → 15 s reset | A2, A3 | Timed test; assert progress wiped, settings retained |
| 10 | Audio buses respected everywhere, **including silence** | C1, C2, **C3** | Per-scene assertion: bus gains applied; `ArcadeDark` source count == 0 |

### 13.1 Additional gates not in the customer's list

| Gate | Rationale |
|---|---|
| **Tone leak audit** | Before each commit from Phase 2 on: does any pre-break asset, sound or line hint at the horror in a way a *first-time* player would catch? If yes, it is a defect. (VOC-02) |
| **Froggy filter audit** | Screenshot at ×1 through ×6: tiles blocky, Froggy smooth, every time. (VOC-15, VOC-37) |
| **IP provenance sign-off** | Per phase: zero third-party assets, zero trademarked names, original maze geometry and fighter designs. (VOC-22) |
| **Walk-away path check** | The `LEAVE` exit works, ends quietly, and is never punished or mocked. (VOC-23) |
| **Bell check** | The handbell still does nothing. It will be tempting to make it do something. Do not. (VOC-18) |

---

## 14. Design FMEA — Risk Register

Severity (S) / Occurrence (O) / Detection difficulty (D), each 1–10. RPN = S×O×D.

| # | Failure mode | Effect | S | O | D | RPN | Mitigation |
|---|---|---|:-:|:-:|:-:|:-:|---|
| 1 | **The horror is telegraphed early** (art, sound, or a too-sinister Froggy in Act 1) | The tone flip — the entire product thesis — is destroyed | 10 | 6 | 4 | **240** | V1 uses V0's exact art; per-commit tone leak audit (§13.1); blind first-time playtests |
| 2 | Froggy gets caught by the global pixel filter | He reads as part of the world; VOC-15 fails silently | 9 | 5 | 5 | **225** | Separate unfiltered composite layer (§11.4); automated zoom screenshot diff |
| 3 | Token mutations bypass the ledger | Wrong balances, charity misfires, horror gate opens at the wrong time | 8 | 5 | 5 | **200** | B1 single-writer API; lint rule banning direct `state.tokens` writes |
| 4 | The basement's slow pacing reads as "broken/loading" | Players click through or quit before the payoff | 7 | 6 | 4 | **168** | Footstep sfx on every click confirms input; visible arrow hotspot; playtest the 4 s hold specifically |
| 5 | Chase is either trivially escapable or unfair | H5 fails both ways; the climax deflates or enrages | 8 | 5 | 4 | **160** | Fixed 0.5× ratio; ≤ 90 s optimal route; 20-run telemetry against the §9 band |
| 6 | Post-break "silence" ships with a leftover ambience source | The single strongest horror device is neutered | 9 | 4 | 4 | **144** | C3 asserts **source count == 0**, not just muted gain |
| 7 | Corridor-5 figure invisible on all displays (or blatant) | The best-planted clue lands as nothing, or as a cheap tell | 6 | 6 | 4 | **144** | Fixed palette-index ΔE; no post gamma in basement; verify on 3 displays |
| 8 | Renderer swap leaks a WebGL context | Frame drops or a black screen at the highest-tension moment | 8 | 4 | 3 | **96** | A1 teardown contract; 20-swap leak test |
| 9 | A minigame is unwinnable or unloseable | AC-2 fails; the economy stops meaning anything | 8 | 3 | 3 | **72** | B3 contract test + B4 win-rate sampling |
| 10 | Third-party/licensed asset ships | Legal exposure; takedown | 9 | 2 | 3 | **54** | B7 checklist signed per phase; original names, art, audio, maze |
| 11 | 15 s reset wipes settings along with progress | Minor but visible regression against AC-9 | 4 | 4 | 3 | **48** | Separate `settings` namespace in `localStorage` from run state |
| 12 | Placeholder art blocks a phase | Schedule slip | 5 | 3 | 2 | **30** | A8 registry; rectangles-first rule, Froggy V0 the sole exception |

**Top three by RPN are all tone/architecture, not content.** Budget review time accordingly: the risk in this project is not that a minigame is boring, it is that the twist is spoiled or that Froggy renders wrong.

---

## 15. Conflicts, Trade-offs & Decisions Log

| # | Issue | Customer's position | Resolution in this QFD |
|---|---|---|---|
| 1 | Medium tier "5 in / 3 out" vs "3 in / 6 out" | Customer already corrected to **3 in / 6 out** (§15) | **Adopted.** Every tier is a 2× on a win. Encoded in B1/B4. |
| 2 | 20 starting tokens vs a 200-token prize floor | Customer chose tiered prizes and accepts most players never redeem (§3.2, recommended option) | **Adopted.** Prizes 200/250/350/500/750. The payout-scaling alternative is a **debug-only** flag; shipping it would require sign-off (see §8.2). |
| 3 | Pac-Man / Tekken homages | Original art, names, sounds, layouts (§15) | **Adopted and hardened** into B7 with a per-phase audit. |
| 4 | Walk-away exit | Customer added it explicitly (§9, §15) | **Adopted.** Added as T6 (wt 3) with its own acceptance gate. |
| 5 | Pixel/non-pixel split for Froggy | Flagged non-negotiable without consultation | **Hard constraint.** Drives the architecture in §11.4. Any change requires customer approval. |
| 6 | Total silence after the break-in | Flagged non-negotiable without consultation | **Hard constraint.** C3 promoted to P0 despite a low matrix score. |
| 7 | Cozy Froggy visual identity | Supplied as a reference image, four poses | **Treated as normative spec**, transcribed to a palette and pose set in §11.1 rather than left as a mood reference. |
| 8 | "Scary as hell" chase Froggy | One sentence of direction | **Interpreted as a transform, not a replacement** (§11.3). Every friendly feature is retained and pushed too far, because recognition is the source of the fear. Flagged in §17 for confirmation. |
| 9 | Basement pacing vs chase brevity | Both specified | **Kept in deliberate opposition** — the contrast is the effect. No balancing. |

---

## 16. Traceability Matrix

VOC → requirement → characteristic → build phase → acceptance test. Condensed to the load-bearing chains.

| VOC | WHAT | HOW | Phase | AC / Gate |
|---|---|---|---|---|
| 01, 02 | T1, T4 | C6, C5, A2, C2 | 2–5 | §13.1 Tone leak audit |
| 15, 37, 39 | T2, H8, P1 | **C6**, C5, A4 | 2, 5, 6 | §13.1 Froggy filter audit |
| 12, 24 | T5 | **C3**, C2, C1 | 4 | AC-10 |
| 09, 10, 19 | E1, E2, M3 | **B1**, B4, B3 | 2–3 | AC-2 |
| §6 charity, §6 bust | E3, E4, T3 | **B2**, A2, A3 | 2, 4 | AC-3, AC-4, AC-6 |
| 41 | T3 | A2, B2 | 4 | AC-6 |
| 11, §3.2 prizes | E5 | B5, B1 | 2 | AC-5 |
| 20 | M2 | B4, B3 | 3 | AC-2 |
| 22 | M4 | **B7** | 3 | §13.1 IP sign-off |
| 21 | M5, T4 | C6 (V1), B3 | 3 | §13.1 Tone leak audit |
| 25 | H1 | **C7** | 5 | AC-7 |
| 26 | H2 | C7, C5 | 5 | §9 C5 palette test |
| 27 | H3 | C7, C5 | 5 | AC-7 |
| 28 | H4 | C7, **C6 (V2)**, C1 | 5 | AC-7 |
| 29, 30, 32, 42 | H5, H6, H7 | **C8**, A5 | 6 | AC-8 |
| 14, 31 | H8 | C4, C8 | 6 | §9 C4 sweep |
| 23 | T6 | A2, B5 | 4 | §13.1 Walk-away check |
| 18 | T1 | *(content rule)* | 2 | §13.1 Bell check |
| 13 | P4 | C2, C1 | 1–7 | AC-10 |
| 35, 36, 06 | P1, P2 | **C5**, A4, A8 | 3, 4 | §9 C5 palette test |
| 40, 34, 04 | P3, P5, D4 | A3, C1, A4, A5 | 1, 7 | AC-1, AC-9 |
| 07, 08, 38 | D1, D2, D3 | A7, A6, A8 | all | Phase exit gates §12 |

---

## 17. Open Questions for the Customer

Answers are needed before the phase noted; none block Phase 1.

| # | Question | Needed by | Default if no answer |
|---|---|---|---|
| 1 | **Predator-Froggy direction** (§11.3): the approach is "same frog, every friendly feature pushed one step too far" — same green, same yellow belly, same pink tongue, all corrupted — rather than a new creature design. Confirm? | Phase 5 | Proceed as specified in §11.3 |
| 2 | Should the **uncanny variant (V1)** ever appear outside the three specified moments (tutorial line 6, second bust, Whack-a-Frog)? More sightings raise the payoff but raise leak risk (FMEA #1). | Phase 2 | Three moments only |
| 3 | Does the **kid NPC** react differently to different prizes, or is any prize a flat cash-out? | Phase 4 | Flat cash-out; prize name mentioned in the line |
| 4 | Is the **walk-away ending** a true ending (card + reset) or a soft exit back to the exterior? | Phase 4 | True ending: "you went home" card + reset |
| 5 | On **death in the chase**, does the run reset fully (tokens back to 20) or resume at the basement? | Phase 6 | Full reset to Boot, per §11 of the brief |
| 6 | Should the **debug payout-scaling variant** (easy 5 / medium 12 / hard 25) ever ship as an accessibility or "easy" mode? | Phase 7 | Debug-only; not shipped |
| 7 | Any **content warning** on the start screen? A cozy-looking game that turns into a chase-horror has a real argument for one, but it also spoils the twist. | Phase 7 | None on-screen; a line in the store/page description instead |

---

*End of QFD-FA-001.*
