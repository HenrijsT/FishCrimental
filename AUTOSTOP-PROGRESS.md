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
- [ ] Stage 5 feat/ponds
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
1. Stage 5: feat/ponds -- DESIGN FIRST into DECISIONS.md, then build.
   Constraints: per-pond remainder key `pond:${id}`; nothing before
   SOURCE_ORDER[0]; ponds feed the market so check a pond-heavy player does not
   crater their own prices; accumulate() is already O(producers).
   Decide + record: unlock, cost, upgrades, what it breeds, chosen vs fixed
   species, survives prestige?, where in the UI.

## Notes / decisions
- SAVE_VERSION is 6 with MIGRATIONS[5]. DO NOT BUMP AGAIN this pass.
- Market gate is prestigeCount > 0 (shifts are unbuilt; recorded as a deviation).
- Ladder after Stage 4 (seed 7): 3h18m09s / 11m19 / 2m44 / 1m56 / 1m47 / 1m41.
  Run 1 untouched. Measure: LADDER=1 pnpm vitest run src/lib/game/ladder.probe.test.ts --reporter=verbose
- market.probe.test.ts verifies mono/rotate against the built game.
- Tests 473 passing, 5 skipped (probes are LADDER-gated).
