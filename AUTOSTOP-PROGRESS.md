# Autostop progress log

Goal: FIFTH PASS — finish the game. Brief: design/promt_goals/FIFTH_GOAL.md
Working branch: feat/going-ham. Branch per stage, merge --no-ff. NEVER push (R57).
No AI attribution in commits (R46). ONE SAVE_VERSION bump for the whole pass.

## Status
- [x] Baseline: 406 tests green, branch feat/going-ham clean.
- [x] Stage 0 fix/offline — MERGED (3370461)
- [x] Stage 1 chore/one-frontend — MERGED
- [x] Stage 2 feat/selling — MERGED
- [x] Stage 3 fix/pearls — MERGED
- [x] Stage 4 feat/market — MERGED
- [x] Stage 5 feat/ponds — MERGED
- [ ] Stage 6 feat/minigames
- [ ] Stage 7 feat/consequences
- [ ] Stage 8 feat/voice
- [ ] Stage 9 fix/finish

## Done so far
- Read FIFTH_GOAL.md, STATUS.md. Baseline `pnpm test` = 406 pass / 24 files.
- Stage 0 MERGED. Hold-merge fix (failing test first), passive-only offline,
  OFFLINE_FUEL_SHARE=0.5, OFFLINE_HOLD_MULTIPLIER=24, best-water-first when the
  bucket binds, runTrader guarded behind hasAssistant (R63), Assistant now counts
  as transport (canSell). 412 tests green, all four gates. DECISIONS.md updated.
- Stage 1 MERGED: /logbook deleted (1,283 lines).
- Stage 2 MERGED: consignment/Sell button (R65), TOWN_TRIP_SECONDS 40 (R66),
  SAVE_VERSION 5->6 + MIGRATIONS[5] (the pass's ONE bump -- do not bump again).
  430 tests green.
- Stage 3 MERGED: pearl bonus once + logarithmic (SCALE 2), headstart max 4,
  PEARL_EXPONENT 0.30, pearl_nightwatch sink. Chain converges ~100s, no collapse.
- Ladder seed 7 after Stage 2: first prestige 3h18m09s, crossover 27m02s,
  boat 1h23m11s, Ocean 1h59m27s.
  Prestige chain 3h18m / 20m / 2m48 / 1m35 / 48s / 46s -- the Stage 3 collapse.
- Measure with: LADDER=1 pnpm vitest run src/lib/game/ladder.probe.test.ts --reporter=verbose

## Next steps
1. Stage 6: feat/minigames -- every licence gated behind a minigame, NO coin
   price (R42, IDEAS N1). Quota run first ("land N of species X in a time
   limit"), reusing casting/luck/catch tables. Retryable, unlosable, short;
   better play finishes faster. Accessibility: no hold-a-button-only input.
   Removing the price removes a coin sink -- cheapestPurchase must stop treating
   licences as purchases, and every downstream pacing figure must be re-measured.

## Notes / decisions
- SAVE_VERSION is 6 with MIGRATIONS[5]. DO NOT BUMP AGAIN this pass.
- Market + ponds both gate on prestigeCount > 0 (shifts unbuilt; deviation recorded).
- Ladder after Stage 5 (seed 7): 3h18m09s / 9m28 / 2m08 / 1m56 / 1m46 / 1m41.
  Run 1 untouched throughout. LADDER=1 pnpm vitest run src/lib/game/ladder.probe.test.ts --reporter=verbose
- Tests 497 passing, 5 skipped (probes are LADDER-gated).
- Stage 8 will need shift TIER NAMES (Storms/Bosses/Megalodon). Shifts are not
  built; plan to name tiers as a function of prestigeCount and record it.
