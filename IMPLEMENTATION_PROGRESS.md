# Implementation progress

The working record for the Froggy Arcade backlog. Read this first in every session, then check the real state with `git status`, `git log --oneline origin/master..HEAD` and the open pull requests.

**Status: PLAN ONLY. Waiting for the user to say "DO IT". No batch has started under this plan.**

---

## 1. Last verified checkpoint (audited 2026-10-27)

| Item | State |
|---|---|
| `origin/master` | `d3a2f60` (Vercel base path). PR #122 is merged (`31e7260`), and so is PR #121. |
| Working branch | `claude/confident-tesla-w6j9t8` at `f94e5f8`, which master already contains. The branch has to be restarted from `origin/master` (same name) before any new commit. |
| Uncommitted work (kept, not lost) | `src/scenes2d/PoliceEscape3D.ts`, `src/three/policeBuilding.ts`, `src/three/policeOfficer.ts`: +490 / −119 lines. This is the in-flight police batch (Batch 1). |
| Temporary files | `tools/ai_tmp.mjs`, `tools/cine_tmp.mjs`, `tools/face_tmp.mjs`. These are scratch test scripts: delete them before committing. |
| Last green test runs | games 215/215; practice 8/8; stealth 28/28; stairwell 8/8; horror 144/147 (master's baseline is 141/147, and the same 3 tests also fail on master); police 45/45 before the uncommitted changes. |

### Already done and merged (not repeated)
These went out in PRs #121 and #122:
- **Arcade, hide room 3:** sharp textures; the torch dims at the glass doors; darker aluminium frame; chain wound round the push bars; a smooth jointed hand and arm for the key grab.
- **Grudge practice:** Froggy walks past the bag; LEAVE in the pause menu.
- **Creature Clash:** melee FX (bite, punch, claw, blade and others); element-themed shots; the golem punches (FROST FIST) and the bat bites (DUSK BITE); no "PX" in any text.
- **Disguise:** glasses drawn on two rows; caught before the disguise is complete means back to $200 with nothing kept.
- **2D stairwell:** walled in like the lift shaft; doors at x 82; floor numbers on white squares; a climb that never sticks; no 612 plate.

### Audit: the backlog items below are NOT in the code yet
I searched `src` for each one:
- **New content that does not exist:** no Pad Battles, Croaked or Story Mode; no zebra or porcupine; no "BADGE UNLOCKED" notice; no INVENTORY key binding; no `frog-04` secret.
- **Creature Clash still has the old rules:** level cap 3 (`creatureLevel.ts`), a free starter creature, and left/right-handed controls.
- **Old text is still there:**
  - "NO REFUND, AND NO PRIZE." (`CreatureArena.ts:3340`);
  - "THIS WEEK" tab (`Goals.ts:67`).
- **Badges:** 9 in total, all story badges; none for the arcade games.
- **Still to verify:** old task #48 (street stealth batch) is marked in progress. Vision cones and suspicion exist; the remaining parts need checking in Batch 11.

---

## 2. Conflicts (decisions in **bold**; C6–C8 use my defaults unless the user says otherwise)

| # | Conflict | Proposed default |
|---|---|---|
| C1 | Creature level cap. | **DECIDED (user, 2026-10-27): max level 20.** Story zones run 1–20; Ladder runs 15–19, then the level-20 boss. |
| C2 | Story prices. | **DECIDED (user):** first play of a location in world 1 costs 2 and pays 5 on a win. Replay in world 1 costs 1 and pays 2. Each later world adds 1 (user example: world 2 costs 3, pays 6). *My reading, awaiting confirmation:* first play of world N costs N+1 and pays N+4; replay of world N costs N and pays N+1. *Open:* does item 45 (reward drops to 3 when you are ≥3 levels over) still apply? |
| C3 | Ladder price. | **DECIDED (user): 20 tokens per run, 100 on a win.** |
| C4 | Achievements. | **DECIDED (user): the most recent prompt, item 35. Achievements get harder; badges stay hard.** |
| C5 | Police speeds and behaviour. | **DECIDED (user):** every officer is fast at the start (2× en route to floors 6, 3 and 1), then searches at 1.4×. If the player runs, officers in hearing range hear the footsteps, know where the player is and start a chase. Walking or crouching stays quiet. |
| C6 | Item 15 says "no artificial floor restrictions"; the mid-turn police prompt says "do not change floor assignments". | **Each officer keeps his assigned starting floor, and none is blocked from following you to another floor.** |
| C7 | Creature Clash mobile controls. Item 19 says ability buttons with icons. Item 32 says tap to activate, with no attack joystick. Item 2 says remove handedness. | **One move stick, plus tap ability buttons with icons and names. No attack stick, no handedness.** |
| C8 | Recruiting. Item 3 says no starter creature and recruiting costs 25 tokens. The current code gives a free starter. | **Remove the starter. The first recruit costs 25.** |

## 3. Missing information — I will NOT guess these

| # | Item | What is missing |
|---|---|---|
| M1 | 5: arcade chained door locks | The reference image, and which alley's [E] ALLEY prompt to hide. |
| M2 | 31: room 4 machines | The image with the "marked spots" (where the machines and Bog Ball go). |
| M3 | 41: default wardrobe layout | The layout image. |
| M4 | 24: mobile errors ("broken image") | Which screen or asset is broken, and on which device. |
| M5 | 24: "eerie staircase scene with tap-to-enter doors and chair" | Which scene this is: a new scene, or the 2D Stairwell? Where is the chair, and what do the doors lead to? |
| M6 | 10: Frog Cross invincibility exploit | How to reproduce it. I will look for it myself; if I can't find it, I'll report back. |
| M7 | 21 / 20: "arcade mastery", "secret discoverer" | The exact conditions. My proposal: mastery = win every arcade game once; secret discoverer = find all secrets. |
| M8 | 30: "stacked bodies with blood" | Where they are: the turn-around scare corridor? |
| M9 | 1: Midnight Condo Run | How much prices should go up. My proposal: furniture ×2, clothing ×1.5, haircut ×2. The improvement suggestions will be text only. |

---

## 4. Batches (in order, with dependencies)

Rules for every batch:
- Make no unrelated changes.
- Run `npx tsc --noEmit` and `npm run build`, plus the batch's own tests and the regression tests it lists.
- Restore `tools/shots`, delete `tools/*_tmp.mjs`, then commit and push to `claude/confident-tesla-w6j9t8`.
- Update this file.

### Batch 0 — Continuity (no dependencies)
- Restart the branch from `origin/master` and carry over the 3 uncommitted police files.
- **Acceptance:** `git log origin/master..HEAD` contains only new work; the tree compiles.

### Batch 1 — Finish the in-flight police work (tasks 62–66). Depends on B0.
- **Speeds:** 2× en route, 1.4× on arrival (per C5).
- **Flashlights in the jump cinematic:** smooth, no pops, clipped at the ceiling.
- **Textures:** hotel, rooms, river, the outside window view, sky.
- **Officer models:** eyes visible from every angle, brows, nose, proportions, uniform.
- **AI:** officers get into the stairwell even when you stand by a doorway; they repath when blocked and never stay idle. Fix scenario H: you on the flight above a landing.
- **Do not change** the chase sequence, routes or floor assignments.
- **Tests:**
  - `test:police` 45/45 or more;
  - `tools/ai` scenarios A–H all caught (this becomes a permanent `tools/policeai.mjs`);
  - screenshots of the eyes and the cinematic.

### Batch 2 — Police overhaul (items 14, 15, 32-police, 41-police). Depends on B1.
- **Target tracking:** keep the target when close; a 2–3 s last-known-position buffer.
- **Search:** door checks, roaming search, noise; no overlapping or stuck officers. A documented state machine: patrol → alert → chase → lost → search → patrol.
- **Hiding:** fair rules, documented here.
- **Officers:**
  - less dialogue;
  - Bog-Ball-quality models;
  - never enter the elevator or the player's apartment.
- **Geometry:**
  - polish the lobby stair door;
  - remove the decorative doors in the condo lobby backgrounds (2D and 3D);
  - floor 1 redesigned like the others, not protruding into floor 2;
  - a larger toilet.
- **Rendering:** flashlight occlusion (walls block the beam); 3D performance work.
- **Tests:**
  - police, stealth, chase;
  - a new state-transition test;
  - FPS sampled at LOW and HIGH quality before and after.

### Batch 3 — 2D stairwell (tasks 61, 67; item 24 once M5 is answered). Depends on B0.
- Remove the basement cage.
- Add a G floor below floor 1; floor 1 moves up one, and the doors and signs are renumbered.
- Add a rooftop above floor 6, reachable from the top flight.
- **Tests:** `test:stairwell` extended for G, 1–6 and the roof; `test:story`, `test:stealth`.

### Batch 4 — Shared arcade-machine framework (items 9, 10-exit, 11, 18, 24-mobile, 27, 31-button, 32-interface, 34, 36, 39). Depends on B0.
- **Exit labels:**
  - LEAVE before the game starts (no "break even" text), QUIT GAME after;
  - Chamber: CASH OUT, and LEAVE with no loss before the trigger is pulled.
- **Buttons:**
  - button text centred everywhere;
  - a uniform "PLAY — N TOKENS" button.
- **Money:** a red floating "-N" next to the tokens and cash counters on every deduction.
- **Pause and resume:**
  - switching tabs pauses the game and opens Settings;
  - after a refresh, the game resumes paused, then counts down 3-2-1, with no second charge.
- **Controls:**
  - a Controls page before every arcade game;
  - an INVENTORY binding (default G);
  - desktop-only key rebinding.
- **Per-game screens:**
  - a tutorial for every game, desktop or mobile (Barrel Climb has none today), with GIF-style animated demos;
  - high scores per game.
- **Mobile:**
  - prompt labels that name the action (PLAY / OPEN / HIDE …), in the 3D scenes too;
  - iPhone fullscreen, plus the landscape fullscreen issue.
- **Text:**
  - no text overflowing its box (the closing dialog and others);
  - remove "NO REFUND, AND NO PRIZE.";
  - replace "Step" with "Tile".
- **Tests:**
  - games, text, mobile, profiles;
  - a new `tools/frame.mjs` (labels, floaters, pause on tab switch, resume after refresh, no double charge).

### Batch 5 — Badges and achievements (items 10-badges, 20, 21, 22, 26, 35). Depends on B4.
- **Badges:**
  - badges for every game (e.g. Frog Cross: 5, 10, 15 crossings);
  - hard badges: Fence Wars with no damage taken, Grudge every animal in a row, Chamber 10 rounds, arcade mastery, secret discoverer;
  - secret badges: "lazy hiding", "error frog-04" in Whack-a-Frog;
  - a unique icon for each badge;
  - a queued "BADGE UNLOCKED" drop-down notice.
- **Badge screen:** readable boxes; it scrolls.
- **Achievements:** rebalanced per C4; the list scrolls; the "THIS WEEK" tab is removed.
- **Tests:** a new `tools/badges.mjs`; profiles.

### Batch 6 — Creature Clash core (items 2, 3, 4-balance/content/arenas/UI, 6, 16, 19, 23, 25, 32-cc, 36, 46, 48). Depends on B4.
- **Controls:**
  - no handedness;
  - desktop keybinds, default J/K/L, with the Controls section shown on desktop only;
  - on mobile, tap ability buttons with icons and names (C7) and a description area.
- **Team and recruiting:**
  - fainted creatures stay in their slot;
  - no starter; the first recruit costs 25;
  - you can go back before picking a card in a recruit pack.
- **Content:**
  - level cap per C1;
  - 40 new non-boss creatures and 80 new abilities;
  - 5 new bosses (15 in total), each with 1 common attack and 3 specials, multi-phase and unique;
  - better boss ability animations.
- **Balance:**
  - every creature rebalanced with distinct tradeoffs;
  - weak creatures buffed;
  - all melee creatures balanced; ranged attacks not unfair against melee.
- **Arenas:** themed structures (e.g. a buried ship in Sunken Ruins), at Bog Ball's quality.
- **Abilities:**
  - wall abilities always use the creature's own textures;
  - ability icons redesigned, with no black boxes over them.
- **Screens:**
  - the stats panel doesn't overlap anything;
  - each ability shows its type, duration, cooldown and effect; damage shows only once selected;
  - specialties and weaknesses shown on creature select;
  - zone opponents matched to the player's level;
  - no text overlap in the hub, better creature visuals, less clutter.
- **Tests:**
  - games (Clash part);
  - a new `tools/clash.mjs`: roster counts, balance sim (win-rate spread), no overlapping text, recruit flow.

### Batch 7 — Creature Clash Story and Ladder (items 7, 33, 45, 32-ladder, 4-badges). Depends on B6.
- **Story Mode:** 5 zones, each with 4 battles and a boss, at the levels and bosses in the table below.
  | Zone | Levels | Boss |
  |---|---|---|
  | Mosswood Frontier | 1–4 | Mossback Guardian |
  | Sunken Ruins | 5–8 | Abyssal Dreadfin |
  | Emberfall Crater | 9–12 | Cindermaw |
  | Shattered Crystal Depths | 13–16 | Prism Warden |
  | The Void Citadel | 17–20 | The Hollow Sovereign |
  - Zones unlock in order; prices and rewards per C2.
  - The map has circular path markers, a hop animation and animated zone transitions.
  - VS screens before each battle.
  - A Story completion badge.
- **Ladder:**
  - unlocks after the final Story boss;
  - levels 15–19, then a level-20 boss; price per C3;
  - a climb animation;
  - a creature lock, with release or abandon options.
- **Boss badges:** 3 badges, for 5, 10 and 15 unique bosses beaten.
- **Tests:** `tools/clash.mjs` story and ladder flows, prices, locking.

### Batch 8 — Per-game fixes (items 8, 9-blackjack, 10-games, 12, 13, 19-bog/crane, 21-whack, 28, 32-fence, 38, 47, 49). Depends on B4.
- **Fence Wars:**
  - better frog and lizard models; a smaller, higher overlay; no extra win text;
  - 10 tokens to play, 20 for a win;
  - Confusion Ball: affects the next throw only; a miss splits into 4 pink mini balls doing 1 self-damage each; the wind bar is locked and greyed while confused.
- **Frog Race:** polish; LEAVE before the start, QUIT GAME after.
- **Wheel of Fortune:**
  - visuals and celebrations;
  - extra and bonus spins, special segments, streaks and jackpots, balanced;
  - layout fixes.
- **Blackjack:** a squarer Froggy.
- **Grudge chooser:** the practice button sits between PLAY and PRACTICE with the costs shown; the redundant screen is removed.
- **Frog Cross:** fix the invincibility exploit (M6).
- **Air Hockey:**
  - a heavier puck, nothing else changed;
  - the AI serves at varied angles.
- **Dance Off:** better dancers, a new dancer each round, a cash-out between rounds.
- **Car Chase:** lane merges, splits and blocks, safe spacing, never impassable.
- **Mini Duels:** the MENU button no longer overlaps the title; textured hands.
- **Tic Tac Toe:** a drop animation.
- **Bowling:** a nicer ball.
- **Bog Ball:** a 3-step turn (pick the frog, aim the direction, set the power bar), with pulls remaining shown.
- **Crane:** fix the Oddity and Froggy Grab freezes after a prize.
- **Frog Pond Hunt:** marks showing which of your frogs were found.
- **Grudge and Frogster Mash:**
  - add a zebra to both;
  - remake the tortoise with a 100% shell block;
  - a porcupine with spike damage;
  - better pre-fight hints.
- **Tests:**
  - games 215+ (one new check per fix);
  - hockey;
  - a 50-seed car-chase passability sim;
  - a crane freeze repro.

### Batch 9 — Arcade rooms (items 5, 31-room). Depends on M1 and M2.
- **Locked door:** chained door locks per the reference image, arcade only, reachable from inside; hide the [E] ALLEY prompt for that one alley but keep its function.
- **Room 4:** new machines at the marked spots; Bog Ball moved; a unique colour for each cabinet.
- **Tests:** horror (arcade part), games (machine spots reachable).

### Batch 10 — New games. Depends on B4, B5 and B9.
- **Croaked** (reverse Pac-Man):
  - 10 tokens to play, 20 for a win;
  - Pac Frog and Survivor modes;
  - random mazes, always solvable;
  - tutorials with animated demos;
  - badges.
- **Pad Battles** (room 4):
  - a 3D 8×6 grid of 48 lily pads; 4 unique frogs;
  - pads collapse; tongue and bump attacks; AI opponents;
  - exactly 10 tokens to play, exactly 20 only on a win;
  - desktop and mobile controls, a tutorial, badges.
- **Tests:** a new `tools/newgames.mjs` (prices charged once, a win pays out, a loss pays nothing, the maze is solvable, pads collapse, mobile input).

### Batch 11 — Street and world (items 14-night, 17, 37, 40, 43, 44; verify old #48). Depends on B2.
- **Alleyway refactor:**
  - remove the left wall;
  - a police sprite walks past with perspective scaling and sirens attached;
  - detection near the opening, then pursuit into the alley;
  - no wall clipping;
  - police and NPCs persist across street and alley transitions.
- **Night lighting:** the homeless NPC's sign tinted at night; Sharp's Barber window decorations darker at night.
- **Sleeping on the cardboard:** the head stays on it.
- **Man in black:** the line "All seven in one go" is rewritten so it doesn't break the fourth wall, and the rest of his lines are checked.
- **Old man:** donation buttons laid out 2×2.
- **Old #48:** verify each part of the street stealth batch and finish what is missing.
- **Tests:** stealth, story, a new alley-transition test.

### Batch 12 — Condo, apartment and shops (items 1, 29, 30, 41, 42). Depends on B2, M3, M8 and M9.
- **Midnight Condo Run:** higher prices (M9); the improvement suggestions written here as text only.
- **Apartment:**
  - no default mirror or towels; both can be bought;
  - more furniture with variations;
  - wall placement on the specified wall side;
  - a reflective mirror;
  - default wardrobe layout (M3); bed shifted left.
- **Shops:** the furniture shop and Threads stock rotate each in-game day; purchases persist.
- **Scares:**
  - turn around to find Froggy crouched behind you, a scream, "RUN!", a 2.5 s head start, and stacked bodies (M8);
  - the window scene: Froggy jumps out instantly and looks 3D inside the apartment.
- **Elevator:** fix the freezing.
- **Janitor scene:** Froggy's creepy stalking walk.
- **Tests:** stealth, horror, profiles (persistence), a new shop-rotation test.

### Batch 13 — Final regression and PR
- Run `test:all` together with police, stealth, practice and stairwell, plus the new tests.
- Open a PR only when you ask for one; item 1 asked for one.

---

## 5. Batch status

| Batch | Status | Commit | Tests |
|---|---|---|---|
| B0 | done: branch restarted from origin/master (b1e6ad2); the 3 police files stay uncommitted until B1 is verified | b1e6ad2 | |
| B1 | in progress before this plan (uncommitted). Open bug: AI scenario H. | | |
| B2–B13 | not started | | |

## 6. Known issues
- Horror: the same 3 tests fail on master too (drain-tube button, moving on to the next room, arms crossing the eyes).
- Police AI scenario H: an officer standing in the well at (0.9, 0.56, h 0) never climbs to a player on the flight above the G landing.
- Vite dies after 2 h in this environment; restart it when that happens.

## 7. Next step
Wait for the user's answers on C1–C8 and M1–M9, and for "DO IT". Then start Batch 0, then Batch 1.
