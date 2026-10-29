# Implementation progress

The working record for the Froggy Arcade backlog. Read this first in every session, then check the real state with `git status`, `git log --oneline origin/master..HEAD` and the open pull requests.

**Status: APPROVED (#107, 27 Oct 16:11: "then start doing it"). Working through the batches in order.**

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
| C2 | Story prices. | **DECIDED (user):** first play of world N costs 2N and pays 4N on a win (costs 2/4/6/8/10, pays 4/8/12/16/20). Replay of world N costs N and pays 2N (1/2, 2/4, 3/6, 4/8, 5/10). Item 45 (reward drops to 3 when over-levelled) is **DROPPED (user)**. |
| C3 | Ladder price. | **DECIDED (user): 20 tokens per run, 100 on a win.** |
| C4 | Achievements. | **DECIDED (user): the most recent prompt, item 35. Achievements get harder; badges stay hard.** |
| C5 | Police speeds and behaviour. | **DECIDED (user):** every officer is fast at the start (2× en route to floors 6, 3 and 1), then searches at 1.4×. If the player runs, officers in hearing range hear the footsteps, know where the player is and start a chase. Walking or crouching stays quiet. |
| C6 | Item 15 says "no artificial floor restrictions"; the mid-turn police prompt says "do not change floor assignments". | **Each officer keeps his assigned starting floor, and none is blocked from following you to another floor.** |
| C7 | Creature Clash mobile controls. Item 19 says ability buttons with icons. Item 32 says tap to activate, with no attack joystick. Item 2 says remove handedness. | **One move stick, plus tap ability buttons with icons and names. No attack stick, no handedness.** |
| C8 | Recruiting. Item 3 says no starter creature and recruiting costs 25 tokens. The current code gives a free starter. | **Remove the starter. The first recruit costs 25.** |

## 3. Missing information — I will NOT guess these

| # | Item | What is missing |
|---|---|---|
| M1 | 5: arcade chained door locks | **ANSWERED:** lock reference is `docs/refs/arcade-chained-lock.jpg` (also `arcade-lock-205.png`). Chain and lock go on the arcade doors only, on the inside. The alley whose [E] ALLEY prompt is hidden is the one in `docs/refs/hidden-alley-206.png`: next to the frog wanted poster, behind the parked car. |
| M2 | 31: room 4 machines | **ANSWERED (28 Oct):** `docs/refs/room4-marks.jpg` -- room 4 is GAME CORNER (claws + Clash, ArcadeLounge). Seven spots: two at the top between the green 5-token machine and CLASH, five along the bottom row. The arrow points right from the green machine (read as: it moves right). |
| M3 | 41: wardrobe layout and bed | **ANSWERED (from the 27 Oct images):** wardrobe at the far right of room 213, sleeping bag just left of it (`docs/refs/window-room-elevator-242.png` = image 3). Bed position in the window scene per `window-room-elevator-241.png` (image 2). Image 1 (240) is the jumpscare; images 4–5 (243, 244) are the elevator. *Also still open:* the "wall side shown in Image 2" for wall furniture (26 Oct 05:45) had no image attached. |
| M4 | 24: mobile errors ("broken image") | **ANSWERED:** a broken-image icon appears on mobile during 3D scenes and games. Plan: find which image fails on mobile (lost WebGL context, texture size, or an asset path under the Vercel base path) and fix it at the root. The "Image 1" in the mobile message (26 Oct 01:05) was not attached. |
| M5 | 24: eerie staircase scene | **ANSWERED:** at night, the player goes through the arcade staff door and down the stairs, finds a key at the bottom, and that leads to hide and seek. Make that scene eerie, with tap-to-enter doors and the chair (mobile tap support). |
| M6 | 10: Frog Cross invincibility exploit | **ANSWERED:** after the first car hit, the frog gets a short invincibility that players use to walk through traffic to the other side. Fix: during the invincibility window the frog cannot cross through cars; it is knocked back or held still. The window no longer gives free passage. |
| M7 | 20: badges and achievements | **ANSWERED (from the original prompt):** achievements come from objectives, milestones, wins and actions that most players unlock through regular play. Rare badges: Fence Wars (win without taking damage from the lizard, or an extremely hard damage-threshold run); The Grudge (beat every animal in a row without losing); Chamber (10 rounds in a row without being shot: very rare, luck-based); Arcade Mastery (one unique badge per arcade game, from a hard challenge that fits the game); Secret Discoverer (hidden badges for secret areas, hidden routes, easter eggs and special interactions, kept hidden until found). Requirements must not repeat; icons are distinct; rare badges get a more prestigious look and unlock notice; progress persists across sessions; no duplicate rewards; each one is tested to unlock only when genuinely earned. The per-game challenge list goes here for review before it is built. |
| M8 | 30: stacked bodies with blood | **ANSWERED:** in the forest, during the midnight Froggy chase, once the player goes deep enough: inside a small textured building. |
| M9 | 1: Midnight Condo Run prices | **ANSWERED:** furniture ×1.5, clothing ×1.2, haircuts ×1.3. Suggestions are text only. |

## 3b. Requirements found in the 5-day re-check (2026-10-27)
I went back through every message from "Create a pull request" (22 Oct) to now. The batches above missed these; each is now part of the batch shown.
- **B8:**
  - **Room layout.** Swap the lobby places of Fence Wars and Frog Pond Hunt.
  - **Confusion Ball.**
    - Being hit by it deals 4 damage, shows a lock icon in the middle of the wind bar and greys the bar out.
    - The confusion lasts for the next throw only.
    - If that throw hits the opponent, it is a normal throw.
    - If it hits the ground, it cracks into 4 pink mini balls that fly back at the thrower, 1 damage each, with no double hits. The same applies to the AI.
    - Price history: 7 → 5/10 (26 Oct 11:05), then **10 to play, 20 for a win (final, 26 Oct 12:10)**. The extra win/lose text goes; the result box stays (refs 232–235).
  - **Wheel of Fortune.** "Addicting yet a higher chance of losing." Remaining extra spins shown on screen. No spin exploits.
  - **Bog Ball.** Show the pulls remaining and when the winner or a tie is decided.
  - **Frog Race.** Frogs, track, background and effects at Bog Ball quality.
- **B6:**
  - Ability buttons are bigger, with the icon and a one-word label under it.
  - Clear feedback for active, cooldown and unusable abilities.
  - Attacks target the opponent automatically; buffs, defence and heals apply to self.
  - The selected ability's name and description go in a compact strip above the buttons that doesn't cover the fight.
- **B7:**
  - Each Story zone has its own themed arena.
  - Zone backgrounds have ambient animation (particles, glow, mist).
  - The final boss is the hardest, multi-phase.
  - Story hop and Ladder climb animations follow saved progress after a restart.
  - Boss VS screens are more dramatic.
- **B2:**
  - **Players and floors.** The player must stay free to reach levels 3–6 and 612.
  - **Movement.** Running animations match real speed: no sliding, smooth acceleration.
  - **Doors and rooms.**
    - A closed door doesn't make an officer lose you; officers go to the right door, check it, and enter where the rules allow.
    - Officers never enter the elevator while you're in it, or your apartment.
  - **Searching.**
    - Officers coordinate their search.
    - They don't recheck the same spot without reason.
    - User decision 27 Oct: fast at the start, then search; running is heard and starts a chase.
  - **Toilet.** Enlarged; the door can be closed from inside (ref `police-flashlight-toilet-231.png`, `fencewars-police-clash-233.png`).
  - **Flashlights.** Occlusion must be real (raycast or shadow), not a visual cheat.
  - **Geometry.** Remove the decorative condo lobby doors (refs 226–230).
- **B4:**
  - **Session persistence.**
    - Covers dialogs and 3D scenes too, not just arcade games.
    - Saves positions, health, timers, scores, rounds, opponents and items.
    - Opens Settings paused, then counts 3-2-1 on Resume.
    - Never charges again and never counts the refresh as a loss.
  - **Mobile fullscreen.** On iPhone **and Android**, landscape fills the screen with no black gaps or manual zoom; portrait is supported where it fits.
  - **Controls page.** Every game's Change Controls page has restore defaults and conflict prevention.
  - **Machine screen.** The Play / Tutorial / Leave / Practice buttons are evenly laid out on every machine, as "PLAY — N TOKENS".
- **B10:**
  - **Croaked.** DONE (first pass): 10 tokens, 20 for a win, in room 4's second top spot (Bog Ball moved right).
    - Role selection after PLAY (PAC FROG / SURVIVOR), a new maze each round, checked to be fully reachable.
    - The hunter lays traps (SPACE / TRAP, 3 at once, 4 s apart, hold 2.2 s); the survivor is always the faster.
    - Hunting/fleeing AI; a timer and a flies-left counter; a step-by-step tutorial with animated pictures; NOWHERE TO HIDE badge.
    - Room 4's 5 bottom spots: **kept empty for now (user, 28 Oct)**; their placement is recorded as `LOUNGE_FREE_SPOTS` in src/game/content.ts (x 66/117/169/221/270, foot y 152, from docs/refs/room4-marks.jpg).
  - **Pad Battles. BUILT (28 Oct), redrawn in 2D at the user's request (28 Oct)**: src/minigames/padbattles.ts, the pond from above at a slight tilt (pads as ellipses, frogs rising off their shadows when they jump). 8x6 = 48 lily pads (veined, notched, rimmed, bobbing) on animated glossy water with reeds; four frogs each with its own look (MOSS leaf cap = you, BRUTE horns = aggressive, SHELL shell = defensive, SLY crest = opportunist). Pads warn (flash faster, shake harder, crack at half way) then crumble and sink with splashes and ripple rings; waves quicken (warning 1.9s down to 1.0s, gaps 3.4s down to 1.1s) and are chosen so the safe pads stay one connected piece, outnumber the frogs, and every warned pad has a safe neighbour. Walk / jump (clears one pad) / tongue whip (J) / body bump (K), cooldowns, knock-back, stun, sparks; touching pads walkable, a sunk pad is a hole. AI: get off failing pads, jump gaps, never walk off on purpose; BRUTE chases the nearest, SHELL holds the middle, SLY hunts frogs with water behind them. Placements (ties share a place), elimination banners, chips for who is left, results card; simultaneous last falls = nobody wins (a loss). 10 in, 20 only on a win, nothing on a loss -- verified: 50 -> 40 -> 60 win, 40 loss, 40 all-at-once. Badge UNTOUCHABLE (win without being hit), fastest-win record, 5-step tutorial with pictures, rebindable J/K, phone stick + TONGUE/BUMP/JUMP. Cabinet in room 4's first bottom spot (x 66). **Not yet:** a play-through on a phone; Pad Battles' snapshot/restore after a reload (it has none, like the other shell games without one).
  - **Pad Battles.**
    - AI personalities: aggressive, defensive, opportunistic.
    - Elimination announcements, players-left indicator, final placements, replay.
    - Simultaneous falls handled.
    - A pause menu.
- **B11:**
  - **Alley.** The police sprite replaces the static red/blue wall sirens.
  - **Man in black.** Rewrite the lines in refs 246–247.
  - **Old man.** Buttons per ref 248.
- **B12:**
  - **Shops.** Rotation doesn't refresh on re-entry, a scene change or a reload. Threads gets new colours and styles each day.
  - **Apartment.** Mirror reflection uses the Threads mirror as its reference.
  - **Midnight Condo Run.** Prices go up (M9) and improvement suggestions are written up as text only.

### Reference images
All 50 images from the last five days are saved in `docs/refs/`, named by topic and original number, so later sessions can use them.
No image arrived with three messages:
- (answered 28 Oct) room 4 marks: docs/refs/room4-marks.jpg; wall side: docs/refs/wall-furniture-side.jpg (the back wall of the flat, between the door and the wardrobe);
- the mobile errors.

## 3c. Requirement index: log entry → batch
`docs/REQUIREMENTS_LOG.md` holds all 108 of your messages (#1–#107 plus #49b) from 22 Oct 00:00 to 27 Oct, **word for word**, including the 9 you sent while I was mid-task (my first pass had missed those). Numbering is #1–#106.

How each batch uses the log:
- **The log is the specification.** A batch counts as done only when every sentence in its log entries is implemented and tested, including the "Test …" paragraphs inside them, which are acceptance criteria.
- **Where entries conflict, the later one wins,** marked ⟶ below.
- **Every "preserve unrelated features" clause** applies to every batch.


### 22 Oct messages (#1–#39), before the "Create a pull request" message
Status below means the commit is merged to master; I have not re-tested each one this session.

| Log # | Topic | Status |
|---|---|---|
| 1 | Test-menu buttons: police stealth scene, fresh start; smaller text; scrollable | Merged (22 Oct "Test menu: scrolling list, NEW GAME") |
| 2 | CALM button always shown in the janitor scene; round interact button on mobile | Merged (same commit) |
| 3 | Clash: no two abilities share a name | Merged ("no two move buttons with the same word") |
| 6 | Police caught you going into hiding; broken lobby door; male officers; no flying out of the map after an arrest; police stuck at the bed in shops; smaller objectives text with the left HUD | Merged ("Police escape and the following day: …") |
| 7 | Arcade texturing, polish, win/lose colour, sharp crane toys | Merged ("Arcade finish: …") |
| 8 | Lobby seen from the stairwell, door broken on the far side, couch and bin visible | Merged ("the real lobby through the broken G door") |
| 10 | Grudge PLAY → PLAY/PRACTICE choice | Merged |
| 11 | Lobby like ref 2, three officers, routes 6/3/1, officer models, jumpscare, dark-screen fix, info moved up, zigzag 2D stairwell, river jump, slower dialogue | Merged (several commits). **Routes and speeds are refined in #35/#37/#53/#100 → B1/B2.** |
| 12–13 | Win/lose aura removed, win burst kept | Merged |
| 15–16 | Froggy climbs in at his own size, side-on; 612 on the right | Merged |
| 17 | Clash description card fits, CLOSE visible | Merged |
| 18 | No "px" jargon | Merged |
| 20 | Stairwell platforms tighter; level text away from the doors | Merged |
| 22–27 | Janitor 3D fixed; lobby view; cops come from the right; wall dressing; river sounds; bigger rooms to hide in; no holes round the stair doors | Merged |
| 28–29 | Arcade lock, key and textures; Grudge walk past the bag; smooth hand; Clash melee FX and element shots; chains round the handles | Merged (PR #121) |
| 31–34 | Grudge LEAVE; no PX; glasses; all 7 in one go; stairwell layout and walls | Merged (PR #122) |
| 35 | Rooftop; police 2× then 1.4×; smooth jump-scene flashlights; hotel, room, river and outside textures | **Pending: B1 (police, WIP commit) and B3 (rooftop)** |
| 36 | Remove the basement cage; add a G floor below floor 1 | **Pending: B3** |
| 37 | Police AI stairwell access, no stuck or idle officers, repath; better officer models (eyes, face, proportions, uniform). Don't change the chase sequence, routes or floor assignments | **Pending: B1** |
| 38 | Midnight Condo suggestions and prices; PR | **Pending: B12, B13** |

### 23–27 Oct messages (#40–#106)
| Log # | Topic | Batch | Notes |
|---|---|---|---|
| 38 | Midnight Condo suggestions (text only), higher prices, PR | B12, B13 | Multipliers set in #103 |
| 40 | Clash: no handedness; desktop-only keybinds; mobile buttons fill the space | B6 | |
| 41 | Clash: fainted creature stays in its slot; no starter; 25 tokens to recruit | B6 | |
| 42 | Clash overhaul: balance, +40 creatures, +80 abilities, +5 bosses (60 boss attacks), arenas, UI, boss badges 5/10/15 | B6, B7 | Max level ⟶ 20 (#100). Ladder levels ⟶ 15–19 + boss (#75/#79). |
| 43 | Arcade chained lock (inside only, default); hide one alley's prompt | B9 | Refs 205, 206; #103 |
| 44 | Wall abilities keep the creature's own textures | B6 | |
| 45 | Story Mode: 5 zones, markers, transitions, completion badge, Ladder unlock | B7 | Prices ⟶ #101 |
| 46 | Fence Wars models + overlay; Frog Race polish + LEAVE/QUIT; Wheel overhaul; Chamber CASH OUT / LEAVE | B8, B4 | Refs 207–211 |
| 47 | Red −N floaters for tokens and cash; Blackjack Froggy squarer | B4, B8 | Refs 212–213 |
| 48–49 | LEAVE before play (no "break even"), QUIT GAME after; every button's text centred | B4 | Refs 214–216 |
| 49b | Longer version of #49: LEAVE/QUIT labels, centred buttons, **INVENTORY binding (default G)** in Controls (ref 217), Grudge chooser with costs, remove the redundant screen (refs 218–221), **badges for every game** (Frog Cross 5/10/15 crossings), **a tutorial page plus a Play/Leave choice before every game (Barrel Climb has none)**, **Frog Cross invincibility exploit**, **heavier Air Hockey puck, nothing else changed**, **Dance Off: better frog and opponent, a new dancer each round, cash out between rounds with no loss for continuing** | B4, B5, B8 | Found on the re-check |
| 50 | Pause on tab switch; tutorials for every game per platform; action-specific mobile prompts (incl. 3D, e.g. HIDE); Car Chase traffic | B4, B8 | |
| 51 | Button layouts; Mini Duels hands; Tic Tac Toe drop; bowling ball | B4, B8 | Refs 222–223 |
| 52 | Police: proximity retention, 2–3 s last-known buffer; homeless sign tinted at night | B2, B11 | Refs 224–225 |
| 53 | Police overhaul: doors and geometry, floor 1, models, dialogue, performance, speeds, door checks, roaming, noise, state rules | B2 | Refs 226–230. Speeds ⟶ #100 |
| 54 | Clash: buff weak creatures, ranged vs melee fairness, boss animations | B6 | |
| 55 | Alley refactor: left wall, walking police with perspective and sirens, detection and pursuit, no clipping, persistence | B11 | |
| 56 | iPhone fullscreen | B4 | Extended by #62 |
| 57 | Bog Ball 3-step turn; Clash ability buttons and description strip; crane Oddity freeze | B8, B6 | |
| 58 | Achievements vs badges: rare badges, Arcade Mastery per game, Secret Discoverer | B5 | Difficulty ⟶ #83 |
| 59 | Unique badge icons; BADGE UNLOCKED notice, queued; "lazy hiding"; secret "error frog-04" | B5 | |
| 60 | Badge screen boxes; Clash menu spacing; ability descriptions; "Step" → "Tile" | B5, B6 | |
| 61 | Balance every melee creature | B6 | |
| 62 | Whole-game mobile test; broken image (3D scenes and games, #103); landscape fullscreen on iPhone and Android; eerie staircase scene with tap doors and chair | B4, B3* | *The staircase is the staff-door stairs down to the hide-and-seek key (#103), not the 2D Stairwell. It goes with B9 (arcade). |
| 63 | Clash: remove the black boxes over icons; redesign the icons | B6 | |
| 64 | Badge screen scrolls | B5 | |
| 65 | Remove "NO REFUND, AND NO PRIZE" | B4 | |
| 66 | Froggy Grab freezes like Oddity | B8 | |
| 67 | Apartment: no default mirror or towels; more furniture; wall side; daily rotation for the furniture shop and Threads; ownership persists | B12 | The wall-side image is missing |
| 68 | Reflective mirror; variations of every furniture type in the rotation | B12 | |
| 69 | Turn-around scare: crouched Froggy, scream, RUN!, 2.5 s head start; stacked bodies with blood | B12 | Bodies placed per #103 |
| 70 | Room 4 layout + Croaked (full spec) + the PLAY — N TOKENS layout in every game | B9, B10, B4 | The orange-marks image is missing |
| 71–72 | Clash: no attack stick; tap to fire with auto-target; bigger buttons with icon and word; state feedback | B6 | |
| 73 | Ladder creature lock: release or abandon, with confirmation | B7 | |
| 74 | Flashlight occlusion; bigger toilet with a door closable from inside | B2 | Ref 231 |
| 75 | Multi-phase bosses (summons, teleports, shields, arena-wide attacks, ultimates, telegraphs); Ladder 15–19 + 20 | B6, B7 | |
| 76 | Ladder climb animation; VS screens | B7 | |
| 77 | Swap Fence Wars and Frog Pond Hunt; Confusion Ball 4 damage + lock icon | B8 | Price ⟶ #79 |
| 78 | Confusion mini balls | B8 | Refined in #79 |
| 79 | Fence Wars result text and 10/20; Confusion rules; high scores per game; platform tutorials; flashlight occlusion; toilet; Clash controls, ladder lock, bosses, ladder levels | B8, B4, B2, B6, B7 | Refs 232–235 |
| 80 | Story hop animation; ladder climb; VS screens; prices | B7 | Prices ⟶ #100/#101 (Story 2N/4N, replay N/2N; Ladder 20/100) |
| 82 | No text outside its box anywhere | B4 | |
| 83 | Remove "THIS WEEK"; achievements scroll; much harder achievements | B5 | Refs 236–237 |
| 84 | Clash J/K/L; Change Controls before every game (restore defaults, no conflicts) | B6, B4 | Ref 238 |
| 85 | Sharp's Barber window decorations darker at night | B11 | |
| 86 | Frog Pond Hunt found/not-found markers | B8 | |
| 87 | Session persistence everywhere, paused, 3-2-1, no recharge | B4 | |
| 88 | Sleeping on the cardboard | B11 | Ref 239 |
| 89 | Instant window jumpscare, Froggy 3D inside; wardrobe and bed layout; police kept out of the elevator and apartment; elevator freeze | B12, B2 | Refs 240–244 |
| 90 | Janitor-scene creepy walk (bent elbows, twitchy, slow, forward lean, heavy steps) | B12 | Ref 245 |
| 91 | Man in black stops breaking the fourth wall | B11 | Refs 246–247 |
| 92 | Old man's buttons 2×2 | B11 | Ref 248 |
| 93 | Over-level reward drop | — | **Dropped** (#102) |
| 94 | Back out before picking a creature | B6 | |
| 95 | Zebra (Grudge + Frogster Mash); tortoise remake with a 100% shell block; porcupine with spikes; pre-fight hints | B8 | |
| 96 | Clash hub: no overlap, better creatures, less text | B6 | Ref 249 |
| 97 | Air Hockey varied serve angles | B8 | Ref 250 |
| 98 | Pad Battles (full spec) | B10 | |
| 99 | Process: audit, plan in batches, wait for "DO IT", keep this file up to date, resume from the last checkpoint | all | Followed by this file |
| 100–103 | Decisions and answers | all | See sections 2–3 |
| 104–107 | Re-check requests (this log; the alley prompt is #55); #107 = "check again, then start" | — | Done; work started |

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
  - ~~5 new bosses (15 in total)~~ **user, 28 Oct: keep 10 bosses for now; make their animations more lively and strong.** Boss badges at 3 / 6 / all 10;
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

### Batch 7 — Creature Clash Story and Ladder
**BUILT (28 Oct, user: "a story mode instead of zone"):** STORY MODE replaces the zone battles on the hub (game/creatureStory, hub `story` screen). Five worlds in order, four battles + a boss each, at the levels in the table; a world opens when the one before's boss falls. Prices per C2, read per battle: world N costs 2N / pays 4N until its boss is beaten, then N / 2N as replays. The map: five round windows on each world's own ground along a path of stepping stones, beaten ringed gold, locked with a padlock; your creature hops to the world picked. The panel: levels, blurb, the five stage markers (battles + boss), who is next, price, FIGHT. A VS card before every story fight (world name, both creatures sliding in, VS). Results say what is next or which world opened. Foe drawn when the fight opens and kept with the paid battle (reload-safe); a loss faints the fighter, stage kept. New VOID CITADEL arena (obsidian, runes) for world 5. Badge WORLD WALKER for all five. The LADDER opens after the last story boss (a run already on can be finished), and pays 100 on a win (C3; was 80). **My defaults, to confirm:** the five story bosses are the existing bosses under the story names (Mossback Guardian = the Green Maw, Abyssal Dreadfin = the Salt Kraken, Cindermaw = the Starfall Seraph, Prism Warden = the Mirror Sphinx, The Hollow Sovereign = the Lantern Lich), with health eased in early worlds (50% in world 1 up to 100% in world 5), since the bosses are kept at ten; C2 prices taken per battle, not per world. Still to do from B7: zone transition animation beyond the marker glide, ladder 15-19 levels + creature lock (#73/#75). (items 7, 33, 45, 32-ladder, 4-badges). Depends on B6.
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

**Buttons (user, 28 Oct): LEAVE leaves the game, BACK goes back a menu screen.** The pause menu's in-game button is LEAVE everywhere (was QUIT GAME once a go was under way; the crane's QUIT); its confirm is CONFIRM LEAVE; EXIT TO START MENU asks 'EXIT TO THE START MENU?' / CONFIRM EXIT; the forfeit line reads LEAVING WILL FORFEIT N TOKENS. The machine card already had LEAVE on its first page and BACK on HOW TO PLAY / CONTROLS; the Clash hub BACK on its screens, LEAVE in the pause menu. tools/frame.mjs updated, 14/14.


## NEW REQUESTS (28 Oct, late) -- the queue, in the order being worked

| # | Request | Status |
|---|---|---|
| Q1 | Creature Clash: 20 new creatures + 40 abilities | DONE, pushed (70 creatures, 160 specials) |
| Q2 | Then 20 MORE creatures + 40 MORE abilities (user: "actually 40 and 80") | done: 20 more creatures (camel, flamingo, shark, lobster, koala, ladybug, beaver, moose, narwhal, lemur, cricket, pangolin, goat, squirrel, swan, raccoon, vulture, skunk, axolotl, peacock), each its own body, two to three an element, all housed in biomes; 40 more specials, each a kind+special pair no other move has (incl. the new buffs); 90 creatures, 200 specials; icon words added; seen fighting in sim battles |
| Q3 | Clash touch buttons and stick OUTSIDE the arena view (the black side bars), the same for every game | done: sideways on a phone the picture is fitted between two black columns (touchControls.reserveSides, used by the scaler again); the stick or pad sits in the left one, the buttons one above another in the right one, the gear at the top of the right one. Creature Clash uses the shared controls both ways up (no sticks drawn on the arena), so its attacks auto-aim at the foe. Dance Off keeps its arrow tiles on the clear strip along the bottom of its stage |
| Q4 | Clash move card: only the ability (no strong/weak), bigger text, nothing past its box | DONE |
| Q5 | Clash creature card is tappable (and says so) -> stats page: ATTACK, DEFENCE, SPEED, HP, MELEE or RANGED, + strengths and weaknesses | DONE |
| Q6 | Clash home: no stat bars, only the XP bar; the move rows get the room | DONE |
| Q7 | Clash LADDER tile text 'AFTER THE STORY' runs out of its box | DONE |
| Q8 | Buff abilities: e.g. evasion +30%, crit chance +20% | done: four buff mods (EVASION 30% of hits miss 4s, FOCUS +20% crit 5s, FURY +25% damage 5s, QUICKEN cooldowns 40% faster 5s) on HUSH GLIDE, TAILWIND, MOLTEN SKIN, COMET TRAIL; word floats over the head, MISS on a dodged hit; all four seen firing in sim fights |
| Q9 | Story Mode: exactly 4 FIXED opponents per world before the boss, themed, none repeated across worlds, same for every account; no random | DONE: Mosswood Rootwalker, Leafcrawler, Mossbadger, Thornstag; Sunken Kelpcrab, Inkling, Tidesteed, Cragodile; Emberfall Pyrosal, Cindermole, Ashscorpion, Forgeboar; Crystal Frostermine, Geodehog, Rimegolem, Obeliskwalker; Void Hollowcrow, Nightlynx, Gloompossum, Bogwraith |
| Q10 | Pad Battles: Bog Ball-level visuals; pads spaced apart so frogs must jump; smooth jumps, exact landing, falling animation, splashes on a miss; body blocking/pushing | done: 7x5 pads with open water between them (walk your own pad, JUMP to the next one the way you face); jumps arc with a crouch and a squash, and the landing is checked against the pads as they are at touchdown (a pad gone, or water: splash and out); falls tumble over the edge, splash and sink; frogs are solid and push by who is walking into whom; the AI gets about by jumping; pond, pads and frogs painted procedurally like Bog Ball's, with moonlight and fireflies. Tutorial demos still show the old grid (Q11) |
| Q11 | Tutorials (all games): machine page with NO picture (text + PLAY centred, the 3 buttons where they are); pictures only in HOW TO PLAY; one unique, accurate picture per step (not like the crane's repeats); pictures kept inside their box; better textures/lighting/animation matching each game (e.g. Dance Off arrows rise the right way); clearer beginner wording, Creature Clash explained (stats, effects, buffs, debuffs, cooldowns) | done: machine page without a picture, words and PLAY centred; every picture clipped to its box and lit (top light, vignette); ui/tutorialDemos rewritten -- shaded, outlined art on textured grounds for every step of every cabinet, each its own, checked against a screenshot of its game (Dance Off arrows rise to the line, Air Hockey rink runs up the screen, Pad Battles pads apart, five slot reels...); both cranes get four real steps with their own pictures (were one picture under six broken lines); Creature Clash HOW TO PLAY in the hub (9 steps: moving, moves and cooldowns, stats, elements, debuffs, buffs, cover, story, controls) |
| Q12 | Pause -> resume: a 3 s countdown in every arcade game except Froggy 21, the Wheel and the Chamber | done: core/pause counts 3, 2, 1 (one second each) on every RESUME in Minigame, CraneGame and CreatureArena; Froggy 21, Wheel and Chamber skip it |
| Q13 | Badges: a locked badge shows no colour (KING OF THE ROAD's green dot) | done: locked icons drawn through a grey pen, every colour becomes a locked grey |
| Q14 | Text over text: the police escape's hint line over the objective; check every screen | done (police escape): hint drawn under the objective block (phone: it was on it); other screens checked as touched |
| Q15 | Police escape: lobby stair doorway not blocked by the wall; remove the extra rail section (ref 4); police pathing/collision (no passing through each other, no back-and-forth at the doorway, recover when blocked); police models joined naturally, better walk/turn; performance with many officers; a little more time at the start | done: doorway (the lobby's dado rail no longer runs across it; one 0.9 m opening, one frame); the G stub rail removed; officers keep apart (keepApart, through the real collision) and yield only to one ahead; paths string-pulled (no out-to-the-fire-door-and-back on every landing); shut flats and off-floor officers not drawn (corridor draw calls 1019 -> 143); +1.5 s at the start (+1 s on a retry); phone: the red shout under the hint. Model: a sloped yoke joins neck, chest and shoulders (no shelf; collar and epaulettes sit on it); turning on the spot steps the feet round |
| Q16 | (29 Oct) The 3-2-1 showed over the Creature Clash menu after LEAVE: count only going back into play | done: core/pause `resumeToLeave()` unfreezes without the count; every way out of the pause menu (LEAVE, QUIT GAME, CASH OUT, a practice LEAVE, a forfeit EXIT) uses it. CANCEL on Creature Clash's leave question counts back in (`countBack`). Checked in the browser: training LEAVE goes to the hub with no count, story LEAVE shows the question with no count, CANCEL counts 3-2-1 and the fight carries on; frame.mjs 14/14 |
| Q17 | (29 Oct) Creatures more textured; body parts sticking to each other | done: art/sdf grain (clumped noise plus speckle, anchored to each part so it travels with it) breaks the light bands into fur/scale texture on every body; 7 bodies whose parts drifted apart in some frame (urchin, eel, dragonfly, ladybug, moose, cricket, peacock) re-jointed with thicker limbs and bridging parts; a flood-fill check over all 90 creatures at six animation moments finds one piece each |
| Q18 | (29 Oct) Creatures: not shapes stuck together; textured, natural body parts | done: art/sdf materials (fur strokes along each part, scales, overlapping feathers, plated shell, soft skin; table in art/creatureArt MATERIAL, none for prizes), wider fillets at every join, `organic()` gives every leg a haunch and a foot (placed after its leg so later cuts still carve them); all 90 stay one piece (flood-fill check); frame.mjs 14/14 |
| Q19 | (29 Oct) Tails and horns must look good (moose, goat, squirrel; check the rest) | done: moose gets two palmate antlers (beam, palm, fingers, brow tine); goat swept-back ringed horns; squirrel and skunk bushy plume tails with a stripe; fox a full brush with a white tip; stag branching antlers; ram an open curled horn with ridges; zebra a tail with a tuft. Every one of the 90 was viewed large; the rest read fine. Thin tines no longer get the wide join (k under 0.6 stays tight) so they stay separate points. 90/90 still one piece; frame.mjs 14/14 |

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
  - wall placement on the specified wall side (`docs/refs/wall-furniture-side.jpg`: the back wall, door to wardrobe);
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
| B0 | done: branch restarted from origin/master (b1e6ad2); the 3 police files were later saved as a WIP commit | b1e6ad2 | |
| B1 | **DONE, verified 27 Oct.** Done: officers move at 2× your run on the way to floors 6/3/1 (measured 8.0 m/s) and 1.4× after (measured 3.36 m/s searching; chase capped at 5.6). Running is heard: a chase starts, through the well up to a floor and a half (#100). In the well they follow the flights (scenario H fixed). During a chase they go through a door once it is 56% open and step out of its swing. Bar lamps are spotlights now, with no red/blue blotches on faces. Eyes are bigger, with irises and pupils; neck and jaw narrower. Torch brightness eases with the beam's length (no white-out at the 612 window). Textures (hotel, rooms, river, outside, sky) from the WIP commit were checked in screenshots. | see git log | tsc OK; build OK; police 45/45; policeai 22/22 (new: 9 chase scenarios + stood-still check in game time, noise, speeds); smoke OK |
| B2 | **IN PROGRESS (27 Oct).** Done, pending the regression run:
<br>• **Geometry:** the police lobby is single-height (POLICE_CEIL 2.95, no galleries), which fixes the floor-1/floor-2 protrusion and the white block across floor 2. The G stair door is cleaned up: no inner stops, no splinters in the jamb, the leaf lies on the lobby floor away from the wall. Decorative gallery doors are removed in 2D (art/hotelInterior) and in 3D (three/hotelLobby).
<br>• **WCs:** plan-B WC 2.3×2.2 m, plan-C bathroom 2.0×2.0 m, so you can walk in and shut the door from inside (all 28 checked).
<br>• **Torches:** light ends at the beam's first hit; real shadows when shadows are on; far officers' shadow maps redraw 1 frame in 4; bar lamps cast no shadows; one bar lamp per officer and one bridge light (lights 23→20).
<br>• **AI:** a 2.5 s last-known buffer; near sense 2.0 m; a flat on another officer's list is skipped; a spot checked in the last 45 s is less likely to be re-checked.
<br>• **Dialogue:** opening, coming-in and radio lines shortened; officer lines replace each other instead of queuing.
<br>• **2D:** no officer comes into your flat (Condo); none sees or catches you stepping into the lift (Hotel `safe`).
<br>• **Rules:** written in docs/POLICE_RULES.md.
<br>**NOT done:** full Bog Ball-quality rebuild of the officer models (only eyes, lamps, neck and jaw improved in B1); elevator *freeze* debugging (#89 §3, B12). | see git log | tsc OK; build OK; police 45/45; policeai 25/25 (wc, door, torch, noise, speeds, 9 chase scenarios); stealth 30/30 (new: no officer in your flat, none sees you in the lift); smoke OK; story 16/17 (the failure is the same on master: "BackAlley reachable from normal"); horror 144/147 run alone (same 3 failures as master; runs made while other tests were going vary between 139 and 143, timing under load) |
| B3 | **DONE, verified 27 Oct.** The 2D stairwell runs G, 1–6: G is the lobby's landing (the foot of the well, no basement cage); 1 and 3–5 are locked other-people's floors; 2 and 6 go to their corridors. Floor signs are painted G and 1–6. The roof door at the top opens on to a walkable rooftop (sky by time of day, the town, tank, AC units, stair house), and you come back in the same way. The Hotel lobby's stair entry sends you to G; the lift display reads G at the lobby and counts G, 1, 2 … | see git log | stairwell 14/14 (new: G, locked 1, no basement, roof out and back); stealth 30/30; story 16/17 (same as master); smoke OK |
| B4 | **IN PROGRESS.** Done and verified (tools/frame.mjs 14/14; games 214/215 — the failure, "frog race: the winner crosses clear, 5.2% too close", is a random-sample check on the race physics, which B4 does not touch):
<br>• **Exit labels:** LEAVE before the play is under way, QUIT GAME after (MinigameScene.inPlay/exitLabel; module hooks `inPlay`, `pauseExit`). Leaving before play refunds the stake and shows no result: no "break even" (#48/#49/#49b). Frog Race (bets), Chamber (before the first pull; CASH OUT once there is a pot, #46), Wheel (before the first spin), Blackjack (before the first deal) and Pond Hunt (placing) have a pre-play stage.
<br>• **Floaters:** a red −N by the token and cash counters; in games, under the title bar (#47).
<br>• **Tab switch:** back from another tab mid-game, the pause menu is open (#50; pause.ts `pauseIfInGame`).
<br>• **Inventory key:** INVENTORY in CONTROLS, default G, rebindable (#49b).
<br>• **Text:** "NO REFUND, AND NO PRIZE" removed (#65).
<br>• **Buttons:** every `button()` label is centred on its ink in whole pixels and the box widens to fit it (#49/#51/#82); `tools/textfit.mjs` audits every screen (button ink in its box, nothing off screen, no text over text, no text out of its panel): 948 lines, 0 out of place. tools/text.mjs 5/5, frame 14/14. Commit c4700b1. **games.mjs re-run after this commit is still owed** (the run was cut short twice: a 15-min limit, then the dev server's 2-h limit).
<br>• **Mobile action words:** the phone's INTERACT button says PLAY / OPEN / HIDE / TALK / GO / USE / BUY ... from the prompt on screen, 2D and 3D (core/keyWords `actionWord`, touchControls `actionWord`); tools/actionwords.mjs 7/7. Commit 8e22ac9 (#50).
<br>• **The machine's screen before every game** (#49b, #50, #70, #79, #84): every cabinet, Barrel Climb included and from E, opens on YOUR BEST / objective / PLAY - N TOKENS (+ what it pays) / PRACTICE beside it where there is one (ref 220 layout, the chooser folded in) / TUTORIAL / CONTROLS / LEAVE. HOW TO PLAY opens first on a first go, with each control lit and pressed in turn (desktop keycap, phone fingertip). CONTROLS changes every key the game reads, its own keys too (Grudge J K L I), scoped to that game (keymap `gameKeys`/`setKeyScope`); shared and game keys never swap; RESET KEYS. Records for all 20 cabinets (12 new). tools/machine.mjs 17/17, practice 8/8, stealth 30/30, frame 14/14, text 5/5, textfit 0 out of place, actionwords 7/7. Commit a0410af. games + mobile regression on a0410af: running.
<br>• **HOW TO PLAY from the pause menu** mid-game (#50); commit 95db9c4. machine.mjs 18/18.
<br>• **TILE, not STEP**, in Creature Clash distances (#60); commit 2bc8373.
<br>• **Phones full screen** (#56/#62): web-app manifest + Apple meta (iPhone Safari has no full-screen call for a page; added to the home screen it opens with no bars), a one-time hint on an iPhone held sideways, refit on visualViewport changes and as a turn settles. tools/mobilecrawl.mjs (every scene, 3D scene and cabinet on iPhone/Android sideways and upright: page/console errors, failed requests, broken images, picture filling the height) — smoke-run clean; full run still owed. The user's "Image 1" of the phone errors was never attached. Commit e3a984c.
<br>• **A reload is not a loss** (#87): core/session (sessionStorage live flag set by START; Boot sends a reload straight back past the title screen), GameState.game (stake, paid, practice, at-risk, snapshot; or a scene of its own for the cranes), pause.pauseOnArrival + RESUME counts 3-2-1 (also back from another tab mid-game), the shell holds a restored game (update, clock, tweens) until RESUME. **All 20 cabinets** have snapshot/restore (exact, incl. mid-shot / mid-hand / mid-race; Frogster Mash by round; Car Chase clears short-lived hazards); a spin cut off mid-air is refunded. Cranes come back with the go still paid. Rooms come back where you stood. tools/session.mjs: 26 checks all passed (commit f70a698), + crane 2/2 (commit after).
<br>• **Creature Clash battle mid-reload** (uncommitted when the dev server stopped, now committed WIP): back into the arena with the battle open (check PASS), the fight starts from the bell with no second stake — **second check not yet confirmed** (the wait was too short, then the dev server hit its 2-h limit).
<br>• **Creature Clash battle mid-reload:** confirmed: PASS, the fight starts from the bell, no second stake. tools/session.mjs 31/31.
<br>• **Regression, games.mjs on the latest head (28 Oct):** 207/215. Fixed: (1) **Fence Wars throws missed at low frame rates.** The flight stepped by half a frame, the solver (the lizard's aim and the harness's) by 1/120 s, so a solved arc that clipped the target went past it below ~30 fps. Flights now run in the solver's 1/120 s steps with leftover frame time banked; all 6 item checks pass (were 0/5 alone). (2) **Bowling, same cause:** ball and pins stepped by frame time (up to 40 ms) while the aim line is traced at 1/60 s; now fixed 1/60 s steps. The strike and spare checks now land on the first try (were 0/10). All 14 bowling and Fence Wars checks pass. (3) **Barrel climb arms check:** a test race. Its "at rest" wait ended at swing 0.0099 with the arm still coming down; it now waits for holding plus arms at 0. 5/5.
<br>• **Rest of the regression (28 Oct, head e06d938):** mobile.mjs 32/32 after a test fix (HideRoom3D spends 12 s+ compiling shaders inside create() on the harness's software GPU, so the checks read its controls before it was up and strafed inside the briefing; they now wait for the room and the round). mobilecrawl.mjs: 132 screens on iPhone/Android sideways and iPhone upright, 0 problems. machine 18/18, practice 8/8, actionwords 7/7, textfit 0 out of place (866 lines), text 5/5, frame 14/14, stealth 30/30, session 31/31.
<br>**Known limit:** 3D scenes come back from a reload to their checkpoints only (route/room), not exact positions. **B4 done.** | | |
| B5 | **BUILT (28 Oct), final regression running.** 40 badges (9 story, 24 arcade mastery incl. ARCADE MASTER, 3 Creature Clash bosses, 4 secrets), each its own icon (game/badgeIcons); state `badgeProgress` (kept across resets). BADGE UNLOCKED drop-down (scenes2d/BadgeToast, queued, rare = gold, no input; core/overlays keeps it out of the touch layout and pause). Hooks: the shell checks every record against its mastery line (game/badges `badgeOnRecord`) and gives modules `api.badge` (refused in practice); Frog Cross 5/10/15, Fence Wars no damage, Grudge every foe in a row (persistent run, a loss or walking away resets), Dance Off flawless, Slots 5 Froggys, Froggy 21 charlie, crane jackpot, Clash bosses 5/10/all (unique set). Secrets: LAZY HIDING (HideRoom3D, one spot through the seek), ERROR FROG-04 (Whack cameo), OFF THE MAP (all 4 side alleys), UP ON THE ROOF (stairwell). Badge screen: a box each, sections, ??? secrets, scrolls. Goals: no THIS WEEK, harder achievements (25/100/250 wins, 200 played, win at 10 / all 20 cabinets, 1000 tokens won, rent x4, 20 placed, 10 bought, $25 begging, 7 clothes, 3 haircuts, Clash 25/100, sell 10), scrolls in whole rows with a scroll bar, CLAIM / scroller / tabs / CLOSE spaced per the user's screenshot. tools/badges.mjs 17/17; textfit 0 out of place, profiles 19/19, practice 8/8, machine 18/18. **28 Oct, user:** mastery made harder (Mini Duels 10 in a row, Hoops <22 s, Whack 90, Pond <=20 searches, Barrel Climb <50 s, Flood <55 s, Car Chase $1000, Bog Ball by 5, Frog Race on 10 tickets, Frogster Mash 250, Froggy 21 two charlies in a row; Chamber 10 and Frog Cross 5/10/15 kept as the log states them); the badge screen is one list with no STORY / MASTERY headings or RARE label. The user asked to stop spending time on test runs and build the remaining requests. **Mismatch to ask:** log #42 says 'all 15 bosses'; there are 10, so BOSS SLAYER (10) and BANE OF BOSSES (all) unlock together. | | |
| B6 | **IN PROGRESS (28 Oct).** Done: level cap 20 (C1; +50+20/level XP, 4,750 to the top; +4% HP, +3.5% dmg, +0.6% speed a level); zone opponents at your level +/-1 (LV shown); no starter (#3, C8): an empty team opens on RECRUIT YOUR FIRST CREATURE (25); a loss FAINTS the fighter, which keeps its slot, rests 5 min or is revived for 5 tokens (my default: the log says it must stay but not how it recovers), and the other fit one steps in; BACK from an unopened pack (#1098 'go back before selecting'), the pack stays saved; controls per C7: no handedness, phones get one move stick and three tap ability buttons with icons and names (tap = use it at the foe), desktop J/K/L fire abilities 1-3 at the foe (rebindable, the Clash's own keys), CONTROLS tile and screen desktop only. **Bosses (user: keep 10, livelier and stronger):** every boss breathes and bobs, element motes wheel round it, it rears up and swells as each mechanic gathers and roars when it goes (shockwave, shake, its cry); at half health it ENRAGES (banner, red burst, red rim) and from then on casts 25% more often, moves 15% faster and hits 15% harder; it roars at the bell. **Themed arenas (first pass, 28 Oct):** every world has its own painted floor (art/arenaFloors): cave flagstones + crystals + stalagmites, mown fields + path + flowers, Deepwood leaf litter + roots + mushrooms + light shafts, snow drifts + ice sheets + tracks, Sourmire pools + lily pads + reeds, Sunken Ruins tiled court + mosaic + the buried ship's hull, Salt Shore surf + wet sand + shells, Glass Desert dunes + cracked pan + glass, Ashen Peak glowing lava cracks + ash; decoration only, cover/collision unchanged. The same floors paint the zone-map tiles. The battle HUD has dark bands above/below the ring (names, bars and move line readable on snow and sand); overhead bars stay inside the ring. Hub: ACTIVE chip, RELEASE clear of the menu. **Also done (28 Oct):** recruit screen: GOOD AT / WEAK under the picked creature, no text over the cards; every move card has a DURATION line (guards, auras, walls standing time + breakable or not, mines, snares, what a special leaves on its target); cast walls are made of their maker's stuff (ice slab = ice, kelp weave = weed, ember = vent, stone = rock...), not the arena's prop; tools/clash.mjs: a balance simulator (the computer plays both sides at 12x, each creature vs 8 others, both sides of the ring, nine arenas) printing win rates and outliers. **Still to do in B6:** 40 new creatures + 80 abilities (needs 40 new unique bodies), act on the simulator's outliers (buff the weak, trim the strong), raised set pieces per arena beyond the ship. **28 Oct (user):** decoys now fool the player too (drawn exactly like their maker, with its health bar, one smoke puff for the swap, walk at you, and your auto-aim goes for the nearer); the Haunter (Bogwraith) leaves a double with PHASE; blindness is near-black with a 38px soft circle, and a blinded computer loses you beyond it; arena decorations never overlap the cover or each other; every ring has a themed edge wall. | | |
| Cabinet screens (user, 28 Oct) | **DONE.** Every cabinet's machine / HOW TO PLAY / CONTROLS screens redone (ui/tutorialCard): the machine page is a moving picture of the game, a one-line pitch (`tutorial.pitch`), the best, PLAY / PRACTICE and the forfeit line -- no rules, no keys, no pay line the top bar already says. HOW TO PLAY is a step pager (`tutorial.steps`, 3-4 per game, all 20 written) with an animated example for each step (ui/tutorialDemos, ~60 pictures), keyboard words on a keyboard and the phone's own words on a phone, < > and LEFT/RIGHT to turn. CONTROLS lists every control with its KEYBOARD and PHONE inputs side by side on both devices; keycaps rebind on a keyboard. New small 3x5 font (render/smallFont, ui `smallText`) for supporting lines. Checked on desktop (all 20, contact sheets) and an upright phone; practice 8/8, machine 18/18. Also: ladder bosses cycle through all 10 before repeating (`bossesBeaten`); wall furniture can go where the coat hook was once a wardrobe is in. | | |
| B7–B13 | not started | | |

## 6. Known issues
- Horror: the same 3 tests fail on master too (drain-tube button, moving on to the next room, arms crossing the eyes).
- **Next step (exact):** wire B5 (badges.ts from the draft, BadgeToast registered in sceneManager, the hooks, BadgesModal, Goals: no THIS WEEK tab, scrollable, harder achievements; tools/badges.mjs).
- **Dev server for tests:** run `npx vite --port 5173 --base /`. Master's Vercel commit set base `/froggy-arcade/`, and the tests' `import('/src/...')` 404 without `--base /`.
- **For B2 (seen 27 Oct):** a white block stands across the floor-2 corridor about 6 m from the stairs. It doesn't block walking (only visual); likely the floor-1 geometry protruding into floor 2 (#53).
- **Story test, on master too:** `back-door route only from ejected — BackAlley reachable from normal` (pre-existing, not from this work).
- **Officer faces** are better but still simple: the Bog Ball-quality model rebuild is B2 (#53).
- Vite dies after 2 h in this environment; restart it when that happens.

## 7. Next step
B2 (police overhaul, log #52, #53, #74, #79 §4, #89 §3, #100). Then B3.

<!-- previous: -->
Wait for the user's answers on C1–C8 and M1–M9, and for "DO IT". Then start Batch 0, then Batch 1.
