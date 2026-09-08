# Froggy Arcade

A cozy 2D pixel-art arcade. You have ten dollars.

```bash
npm install
npm run dev        # http://localhost:5173
```

Desktop browser, 320×180 internal resolution, integer-scaled and letterboxed.
No backend — everything lives in `localStorage`.

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
  minigames/  seven games behind one interface
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

```bash
npm run dev            # in one terminal
npm run test:smoke     # boot -> settings -> intro -> hub -> cabinet -> win
npm run test:games     # all seven games launch, play and forfeit cleanly
npm run test:story     # charity fires once, the bust ejects, silence holds
npm run test:basement  # ten frames, no skip, 4s hold, the jumpscare
npm run test:chase     # speed ratio, lethality, escapability
npm run test:outro     # camera locked, Froggy whole in the doorway, end card
npm run test:text      # glyph coverage, 1-bit rendering, no overflow
npm run test:profiles  # save slots stay separate, the old save is adopted
npm run test:horror    # the turn, the transformation, the three rooms
npm run test:all
```

Screenshots land in `tools/shots/`. Dev builds also accept deep links, which is
how the harness reaches any part of the game directly:

```
?scene=ArcadeDark&route=ejected      jump to a scene with the state it needs
?game=chompman&tokens=50             jump straight into a cabinet
?intro=1&charity=1&key=1             set the latches
```

Press `` ` `` in a dev build for the debug panel: set tokens, set the route,
toggle latches, jump to any scene, watch the live audio source count.

## Status

All seven build phases are complete and each was committed runnable. What
remains is the art and audio pass — every asset is generated geometry or
synthesized sound, catalogued in
[assets/PLACEHOLDER.md](assets/PLACEHOLDER.md). Froggy himself is finished.
