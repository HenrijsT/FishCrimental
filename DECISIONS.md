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

## Phase 1 — Foundation (`feat/going-ham`)

**Architecture**

- **One store, one object.** `src/lib/game/state.svelte.ts` exports a single `Game`
  class instance holding `state = $state<GameState>(…)` plus `$derived` views
  (`modifiers`, `incomePerSecond`, `holdSize`, `discovered`, `prestigeReady`). The old
  `Map<FishType, Writable<Decimal>>` is gone. A class was chosen over bare module-level
  runes because Svelte will not let you `export` a reassigned `$state`/`$derived`
  binding from a module, and getter boilerplate for a dozen fields is worse.
- **Decimal everywhere it matters.** Coins, hold contents, hold value, Fishdex counts,
  upgrade levels, deckhand counts, Pearls and every cost/multiplier are `Decimal`.
  Plain `number` is used only for probabilities, cast durations, timestamps and
  play time. `src/lib/decimal.ts` exports `D()`/`d0()`/`d1()` factories — no shared
  Decimal constants, since break_eternity mutates in place.
- **Safe parsing.** `parseDecimal()` matches the exact grammar `Decimal.toString()`
  emits (`-?` + optional `e{1,5}`/`(e^n)` prefix + number + optional exponent) before
  constructing anything, and rejects `NaN`/`Infinity`. `decimal.test.ts` proves
  `new Decimal('banana') === 0` and `new Decimal('1e') === 1`, then proves the guard
  catches both, and round-trips 40 escalating magnitudes through the pattern.
- **Nothing is ticked per entity.** `accumulate()` walks the eight sources once,
  computes `casts = crew × castsPerSecond × elapsed` in a single Decimal step, and
  spreads the catch across the source's species by expected probability. A test
  asserts 100 one-second steps equal one hundred-second step to 8 decimal places.
- **Catch tables are memoised** on `(source, luck)`, since luck only changes when an
  upgrade is bought. The cache is bounded at 256 entries.

**Decisions**

- **Hold value is tracked alongside hold counts.** Fish caught in the Ocean are worth
  ~1000× the same fish from the Pond, so a plain `Record<FishType, Decimal>` inventory
  cannot price a mixed hold. The hold therefore carries both per-type counts (for
  display and flavour) and a single `holdValue` Decimal that already includes the
  source multiplier. Selling pays `holdValue × sellMultiplier`. The alternative —
  48 separate (source, type) buckets — was rejected as unreadable in the UI.
- **Auto-fishing is deterministic, manual fishing is random.** A held rod rolls real
  RNG per cast (up to 16 individual fish, remainder filled from the expected
  distribution — rolling 1e30 fish one at a time is not an option). Deckhands use
  expected values. This keeps manual play exciting and idle play cheap, and makes
  offline progress exactly computable.
- **Offline catch is auto-sold.** `#settleOffline` runs `accumulate` at 75% efficiency
  for up to 8 hours, then restores the hold to its pre-offline snapshot and credits
  the coins directly. Otherwise a player returning after 8 hours would find a hold
  they still had to click to sell, and the "while you were away" number would be a
  promise rather than a payment. Fishdex progress from offline catches is kept.
- **Two joke species files were added** — `src/lib/fishes/oddity_fishes.ts`.
  `FishType.Jelly` and `FishType.Erotic` existed in the enum with sell values of 0 and
  999 but had **no species behind them**, so neither could ever be caught and neither
  joke could ever fire. Added three jellyfish (Lagoon/Sea/Offshore/Ocean) and one
  Lovestruck Lipfish (every source, weight 0.00011 against ~100 — roughly 1 in a
  million casts). This is additive; no existing fish content was touched.
- **Per-source rarity mixes** live in `SOURCE_CONFIG.typeWeights` rather than the flat
  `fishTypeBaseChance` table. The flat table made the Ocean 62% jellyfish, because the
  Ocean only stocks Large + Shark + Jelly + Erotic. `fishTypeBaseChance` is kept as the
  documented fallback.
- **`prerender = true`, no SPA fallback.** `adapter-static` was configured with
  `fallback: 'index.html'`, which **overwrote the prerendered page with an empty
  1.1 KB shell** on every build. Removing the fallback restores real prerendered HTML
  (2.5 KB, contains the game). All routes are prerenderable, so no fallback is needed.
- **eslint parses `.svelte.ts` with the TypeScript parser.** `eslint-plugin-svelte`
  claims `*.svelte.ts` for runes-in-modules support and was failing on `import type`.
  The `parserOptions.parser` override now covers `**/*.svelte.ts` and `**/*.svelte.js`.
  This is a parser fix, not a relaxed rule.

**Balance, and how it was tuned**

`src/lib/game/balance.ts` contains `simulateRun()` — a greedy stand-in player that
holds the rod at the deepest open water, sells every second, unlocks the next source
the moment it can, and otherwise always buys the cheapest thing available. The curves
were tuned against it rather than guessed.

The first attempt reached the first prestige in **6 minutes**, with sources 2–8 opening
inside 70 seconds of each other. The cause was structural: five upgrade tracks each
multiply income, so total income grows as the *product* of five exponentials while any
single cost curve grows as one. Buying one level of everything multiplies income by
about 2.2×, so any cost growth below ~2.2 makes the game explode. Cost growth was
raised from 1.54–2.07 to **3.58–4.63**, deckhand growth from 1.28 to **1.79**, and
unlock costs re-spaced by ~26× per tier.

Result, asserted in `balance.test.ts`:

| | |
|---|---|
| First prestige | 2 h 18 m of active play, at 1.00e15 lifetime |
| Source unlocks | 5 m, 12 m, 18 m, 27 m, 37 m, 49 m, 67 m |
| Mostly-idle player (15% uptime) | 3 h 08 m |
| Run 2 / 3 / 4 | 1 h 02 m / 24 m / 1 m 25 s |
| Lifetime reached in a fixed 3 h, run 1 → run 6 | 4.3e15 → 1.18e45 |
| Pearls after six runs | 4.27e12 |

**Gates:** `pnpm check` 0 errors · `pnpm lint` clean · `pnpm build` ok ·
`pnpm test` 96 passing.
