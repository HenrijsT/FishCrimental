# Autostop progress log

Goal: FIFTH PASS — finish the game. Brief: design/promt_goals/FIFTH_GOAL.md
Working branch: feat/going-ham. Branch per stage, merge --no-ff. NEVER push (R57).
No AI attribution in commits (R46). ONE SAVE_VERSION bump for the whole pass.

## Status
- [x] Baseline: 406 tests green, branch feat/going-ham clean.
- [x] Stage 0 fix/offline — MERGED (3370461)
- [x] Stage 1 chore/one-frontend — MERGED
- [ ] Stage 2 feat/selling
- [ ] Stage 3 fix/pearls
- [ ] Stage 4 feat/market
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
- Ladder measured seed 7: first prestige 3h23m59s, crossover 27m02s, boat 1h29m.
  Prestige chain 3h23m / 20m / 3m30 / 1m35 / 48s / 46s -- the Stage 3 collapse.

## Next steps
1. Stage 1: chore/one-frontend -- delete /logbook entirely.

## Notes / decisions
- SAVE_VERSION currently 5 (config.ts). Bump ONCE to 6 for the whole pass,
  one MIGRATIONS[5]. Decide the bump stage when the first stage needs it.
