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
- [x] Stage 6 feat/minigames — MERGED
- [x] Stage 7 feat/consequences — MERGED
- [x] Stage 8 feat/voice — MERGED
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

## Next steps (STAGE 9, in progress on fix/finish)
- [x] Adversarial bug hunt: 6 hunters + 1 verifier. ~35 defects found, verified,
      fixed, and reproduced in src/lib/game/hunt.test.ts. COMMITTED.
- [x] PLAN.md Part 2 audit debt cleared (all remaining items).
- [ ] Balance end to end: re-run the ladder, record the FINAL figures in
      DECISIONS.md. NOTE the economy moved a lot this stage: castIncome now
      applies saleRate + market, accumulate no longer mints casts the bucket
      cannot take, luck redistributes within the rare types (LUCK_TIER_SHARE).
- [ ] Play the first ten minutes as a new player; fix what confused you.
- [ ] pnpm audit:ui, record scores.
- [ ] Refresh design/STATUS.md and design/IDEAS.md.
- [ ] Write the Stage 9 section of DECISIONS.md, then merge fix/finish --no-ff.

## Notes / decisions
- SAVE_VERSION is 6 with MIGRATIONS[5]. DO NOT BUMP AGAIN this pass.
- Tests 603 passing, 6 skipped. All four gates green.
- Probes are LADDER-gated: ladder.probe, market.probe, luck.probe.
  LADDER=1 pnpm vitest run src/lib/game/ladder.probe.test.ts --reporter=verbose
