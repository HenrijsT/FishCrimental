# DECISIONS

Running log of every decision made during the unattended FishCrimental build.
Append-only — never rewritten.

## Stage 0 — bug fixes (`fix/bug-fixes`)

- **Bug 1 — `RandomIndex`.** Replaced the per-unit-of-weight `Record<number, T>` with a
  parallel `items[]` / `cumulative[]` pair resolved by binary search. Public API
  (`new RandomIndex(pairs)`, `.pick()`) is unchanged; `.pick(roll)` now takes an optional
  roll in `[0,1)` so tests are deterministic. Added `entries`, `size`, `total` and
  `weightOf()` accessors because the old code reached into `.map` directly.
  Non-finite, zero and negative weights are dropped at build time (matching the old
  behaviour, where a zero weight produced no entries); `pick()` on an empty index now
  throws instead of silently returning `undefined`.
- **Bug 2 — import-time simulation.** Deleted the 100-iteration `console.log` loop at the
  bottom of `src/lib/fishes/index.ts`. The distribution check moved into
  `src/lib/fishes/index.test.ts`, which asserts real invariants (a source only ever
  yields its own fish/types, Pond is >50% Small) rather than printing counts.
- **Bug 3 — hardcoded source.** `handleMouseDown` now takes a `FishingSources` argument.
  It also clears any in-flight timer before starting a new one, so a lost `mouseup`
  can no longer leak an interval.
- **Bug 4 — sell log.** `sellFish()` accumulated into a local `earned` Decimal and now
  returns it instead of logging. **Decision:** rather than fix the log ordering, the
  `console.log` calls were removed from library code entirely — a game library should
  not print to the console, and the sold totals are surfaced in the UI instead.
- **Bug 5 — placeholder route.** `src/routes/+page.svelte` is now the game surface
  (source selector, hold-to-fish, per-type counts, sell). `src/routes/test/` deleted.
- **Also deleted `src/lib/ponds.ts`** — the whole file was commented-out dead code.
  Allowed by the brief (deletions inside `src/` are permitted).
- **Also removed `console.log` from `fishAction`** and made it return the caught fish,
  so callers can render the catch. Same reasoning as bug 4.
- **Precomputed `sourceToAllFishChanceIndex`.** `fishAction` used to rebuild a whole
  `RandomIndex` over every fish in the source on every single cast (and reached into
  the now-private `.map`). It is built once at module load instead.
- **Testing:** added `vitest` (called for by the brief's quality bar) with
  `pnpm test` / `pnpm test:watch`. `vite.config.ts` now imports `defineConfig` from
  `vitest/config` — the plain `vite` export does not type the `test` key and
  `pnpm check` failed on it.

Stage 0 gates: `pnpm check` 0 errors, `pnpm lint` clean, `pnpm build` ok, `pnpm test`
13 passing.
