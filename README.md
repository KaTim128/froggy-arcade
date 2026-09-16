# Froggy Arcade

**▶ [Play it in your browser](https://katim128.github.io/froggy-arcade/)**

A cozy 2D pixel-art arcade. You are sleeping rough outside it, and a man in a
black hat wants the prizes off the shelves.

```bash
npm install
npm run dev        # http://localhost:5173
```

Desktop browser or phone. 320×180 internal resolution, integer-scaled and
letterboxed on a desktop; on a touch screen the picture is scaled to fit the
width and the controls go in the band underneath it. No backend — your save
lives in `localStorage` in your own browser, so nothing you do here leaves your
machine.

## Playing

| | |
|---|---|
| **W A S D** / arrows | walk |
| **E** | use whatever you are stood at |
| **E**, **space** or **enter** | get Froggy to the point |
| **Esc** | settings, and quit out of a game |
| **hold left mouse** | look around, in the first-person rooms |
| **shift** | run — 1.4x the walk, across the arcade floor |
| **C** | toggle a crouch, in the rooms he locks you in |

On a phone you get a thumbstick, a look pad over the picture, and whatever
buttons the thing in front of you actually reads — a cabinet brings its own
out, labelled with the same keys its how-to-play card names. **Esc → MOVEMENT**
swaps the thumbstick for a four-way arrow pad if that suits your thumb better;
the choice is kept with the volumes, so it outlives the run. Everything in the
building is reachable this way, including the doors, the horror rooms and all
nineteen cabinets.

**Nothing is charged for walking up to a machine.** Every cabinet opens on a
how-to-play card — what it wants, which keys *that* cabinet reads, and what a
go costs — with two buttons under it. LEAVE goes back to the floor with your
tokens untouched. PLAY is the only thing in the building that takes them, and
it takes them once. If you cannot afford the machine you still get to read it;
PLAY just goes dark and tells you what you are short.

The two things in the casino that take a bet rather than a price — Froggy's
blackjack table and the wheel — charge inside the game instead, and they are
the only two that will not let you in empty-handed.

A game that ends level is not a loss. A draw hands your entry cost straight
back, once, and pays nothing on top of it.

Win a prize and it comes off the shelf. Clear the shelf and the back room
sends out a fresh lot, so there is always something to be playing for.

Win prizes inside, sell them to the man outside for half their token price in
cash, feed the cash back through the change machine at half again, and see how
long the arcade lets you keep doing that.

## Deploying

Pushing to `master` rebuilds and republishes the page — see
[.github/workflows/deploy.yml](.github/workflows/deploy.yml). The repository
needs **Settings → Pages → Source: GitHub Actions** set once, and the build's
`base` in [vite.config.ts](vite.config.ts) has to match the repository name.

---

## Specs

The game was built from two documents, and every module cites them:

- [docs/QFD-Froggy-Arcade.md](docs/QFD-Froggy-Arcade.md) — voice of the customer,
  weighted House of Quality, risk register. Decides *what matters and why*.
- [docs/PRD-Froggy-Arcade.md](docs/PRD-Froggy-Arcade.md) — full gameplay, scene
  specs, minigame rules, economy model. Decides *what gets built*.

Two rules are non-negotiable and are enforced in code rather than by convention:

1. **Froggy is the only non-pixel element.** The world renders into a 320×180
   NEAREST-filtered buffer; he renders to a separate unfiltered overlay above
   it ([`src/render/froggyLayer.ts`](src/render/froggyLayer.ts)) and never
   passes through it. Nothing in the game ever explains this.
2. **The post-break-in arcade is totally silent.** Scenes declare their audio;
   a scene that declares none *instantiates nothing*
   ([`src/core/audio.ts`](src/core/audio.ts)). Silence is asserted in test as a
   source count of zero, not a volume of zero.

## Layout

```
src/
  core/       state, token ledger, broke latches, route guards, audio, input, debug
  render/     320x180 integer scaler, palette + night transform, Froggy's overlay
  art/        painters shared between the warm and the dark version of each room
  froggy/     his vector art, his three variants, and everything he says
  minigames/  nineteen games behind one interface
  scenes2d/   Phaser scenes
  three/      chase level grid + pathfinding
```

The token ledger is the only thing that may write `tokens`, and a route guard
predicate is the only thing that decides which scene is reachable. Both are
narrative devices with a numeric interface: the horror unlocks by going broke,
so the economy code carries the same weight as the horror code.

## Testing

Everything is verified by driving the real game in real Chrome
(`puppeteer-core`, using the installed browser — no download). A typecheck
cannot tell you that a scene threw on `create()`.

`CHROME_PATH` picks the browser if it is not in one of the usual places.

```bash
npm run dev            # in one terminal
npm run test:smoke     # boot -> settings -> intro -> hub -> cabinet -> win
npm run test:games     # every cabinet: tutorial, play, forfeit, and the odds
npm run test:story     # charity fires once, the bust ejects, silence holds
npm run test:basement  # ten frames, no skip, 4s hold, the jumpscare
npm run test:chase     # speed ratio, lethality, escapability
npm run test:outro     # camera locked, Froggy whole in the doorway, end card
npm run test:text      # glyph coverage, 1-bit rendering, no overflow
npm run test:profiles  # save slots stay separate, the old save is adopted
npm run test:horror    # the turn, the transformation, the three rooms, his size
npm run test:mobile    # the phone build, driven with real touch events
npm run test:all
```

Screenshots land in `tools/shots/`. Dev builds also accept deep links, which is
how the harness reaches any part of the game directly:

```
?scene=ArcadeDark&route=ejected      jump to a scene with the state it needs
?game=pinball&tokens=50              jump straight into a cabinet
?intro=1&charity=1&key=1             set the latches
?touch=1                             force the phone controls on (0 forces off)
```

Press `` ` `` in a dev build for the debug panel: set tokens, set the route,
toggle latches, jump to any scene, watch the live audio source count.

## Status

All seven build phases are complete and each was committed runnable. What
remains is the art and audio pass — every asset is generated geometry or
synthesized sound, catalogued in
[assets/PLACEHOLDER.md](assets/PLACEHOLDER.md). Froggy himself is finished.
