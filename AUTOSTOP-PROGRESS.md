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
1. Stage 7: feat/consequences.
   FINES: fixed grace period NOT a roll, identical on/offline; confiscate the
   poached catch; coin fine is a PERCENTAGE (asymptotic, never reaches zero);
   hard coin floor above a full tank of fuel while boat.owned; DROP the
   ideas.txt "cannot buy anything until you pay" clause; offline = ONE eviction
   then fishing continues; a crewless player currently gets no OfflineReport at
   all -- an eviction must never be invisible.
   SETBACKS: called "Setbacks" in all player-facing copy; AMBUSH ON EVENTS not
   timers; at least three; escalate with playTime; damage in SECONDS OF INCOME
   with the difference refunded; refundUpgrade touches coins and NOTHING else
   (test lifetimeCoins byte-identical); car crash = one-time Setback at a
   threshold (car lost, upgrades downgraded, some coins lost, never again);
   evaluate in tick() ONLY, never in settleOffline/resume; do NOT wire into
   simulateRun; achievements gain a Setback family (append-only); grandfather
   existing saves.
   Read design/ANSWER-RESEARCH.md sections 1 and 3 first.

## Notes / decisions
- SAVE_VERSION is 6 with MIGRATIONS[5]. DO NOT BUMP AGAIN this pass.
- Market + ponds gate on prestigeCount > 0 (shifts unbuilt; deviation recorded).
- Licences: no coin price; canSit requires the next locked water needs it.
- Ladder after Stage 6 (seed 7): first prestige 3h13m20s;
  chain 3h13m / 13m27 / 3m01 / 2m19 / 1m46 / 1m41.
  LADDER=1 pnpm vitest run src/lib/game/ladder.probe.test.ts --reporter=verbose
- Tests 519 passing, 5 skipped.
- Stage 8 still needs shift TIER NAMES (Storms/Bosses/Megalodon) + Help surface
  + Tabs keyboard nav (nextTabIndex already exists in guide.ts) + 47 Fishdex
  descriptions rewritten.
