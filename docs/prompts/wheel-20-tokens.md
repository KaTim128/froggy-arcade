In KaTim128/froggy-arcade, retune the casino room's (room 3) WHEEL OF FORTUNE.

Files: src/minigames/wheel.ts (FACES table, bonus odds, spinCost, header comment),
src/game/content.ts (the `wheel` cabinet's `cost` / `reward`), src/core/gameConfig.ts
(the admin default for `wheel.cost`), and anything that prints the price (the "40"
price tag, the how-to card, the board beside the wheel).

1. A spin costs 20 tokens (was 40). Change the default everywhere it lives, including
   the admin config default and the `spinCost()` fallback, and keep it admin-adjustable.
2. Make the wheel lose more and win rarely:
   - Most spins (about 60-65%) should pay nothing or less than the 20 it cost
     (blank faces plus 1/2/3/5/10).
   - About 1 spin in 4-5 should roughly break even (15-25).
   - Real wins (40+) should be uncommon, about 1 in 10. 100+ about 1 in 40,
     500+ about 1 in 500, and the 5000 jackpot far rarer.
   - Lower the RESPIN and BONUS faces' chances, and make bonus spins pay mostly small.
   - Target a long-run return of about 70-75% of the price: a 20-token spin should
     average about 14-15 tokens back, respins and bonus spins included, so the house
     keeps 25-30%.
3. Keep the existing rules. The result is drawn and saved before the wheel moves.
   The board reads its live percentages straight from FACES. The rarest faces are
   the narrowest. Every face shows its number. Respins are capped. Nothing pays twice.
4. Rewrite the header comment's odds table and the house-edge arithmetic to match the
   new numbers. Include a dev-only check, or a Node simulation of 1,000,000 spins, that
   prints the real return-to-player and the hit rates, and make sure they land in the
   ranges above.
5. Test it in the browser: the price tag reads 20, a spin charges 20 exactly once, the
   board's percentages add up to 100%, text fits inside its buttons on desktop and
   mobile, and there are no page errors. Add a row to IMPLEMENTATION_PROGRESS.md,
   commit and push.
