# Autostop progress log

Goal: FIFTH PASS — finish the game. Brief: design/promt_goals/FIFTH_GOAL.md
Working branch: feat/going-ham. Branch per stage, merge --no-ff. NEVER push (R57).
No AI attribution in commits (R46). ONE SAVE_VERSION bump for the whole pass.

## Status
- [x] Baseline: 406 tests green, branch feat/going-ham clean.
- [ ] Stage 0 fix/offline
- [ ] Stage 1 chore/one-frontend
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

## Next steps
1. Stage 0: fix/offline — hold-merge bug first (failing test), then passive-only
   offline, then fuel hole, then bucket sizing, then runTrader guard in live tick.

## Notes / decisions
- SAVE_VERSION currently 5 (config.ts). Bump ONCE to 6 for the whole pass,
  one MIGRATIONS[5]. Decide the bump stage when the first stage needs it.
