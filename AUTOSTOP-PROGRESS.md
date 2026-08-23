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
1. Stage 8: feat/voice.
   a) Name the shift tiers Storms / Bosses / Megalodon in code, save and copy
      (R61). Shifts are NOT built -- plan: derive the tier from prestigeCount
      and record the deviation, same as the market gate.
   b) Help surface (R55): browsable, covers ONLY what is unlocked (distinct from
      guide.ts which describes the NEXT step). Setbacks documented there once
      lived through (R62). Plus an opt-out unlock popup toggled in Settings.
      PREREQUISITE: keyboard nav in Tabs.svelte -- nextTabIndex() already exists
      in guide.ts, check whether Tabs.svelte actually wires it.
   c) Rewrite all 47 Fishdex descriptions in voice. Samples in
      design/archive/VOICE-SAMPLE.md. Failure mode is SAMENESS, not offence --
      a different concrete detail per fish. If it cannot be sustained across 47,
      stop and say so rather than shipping forty identical entries.
2. Stage 9: fix/finish -- budget real time. Adversarial multi-agent bug hunt
   (every finding verified by a second agent AND reproduced by a test), clear
   PLAN.md Part 2 audit debt (17 defects; modal host + contrast already done),
   balance end to end and record the ladder, play the first ten minutes as a new
   player, pnpm audit:ui, refresh design/STATUS.md + design/IDEAS.md.

## Notes / decisions
- SAVE_VERSION is 6 with MIGRATIONS[5]. DO NOT BUMP AGAIN this pass.
- Market + ponds gate on prestigeCount > 0 (shifts unbuilt; deviation recorded).
- Licences: no coin price; canSit requires the next locked water needs it.
- Ladder after Stage 7 (seed 7): first prestige 3h12m38s;
  chain 3h13m / 13m27 / 3m01 / 2m19 / 1m46 / 1m41.
  LADDER=1 pnpm vitest run src/lib/game/ladder.probe.test.ts --reporter=verbose
- Tests 548 passing, 5 skipped. All four gates green at every merge so far.
