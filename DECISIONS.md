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
multiply income, so total income grows as the _product_ of five exponentials while any
single cost curve grows as one. Buying one level of everything multiplies income by
about 2.2×, so any cost growth below ~2.2 makes the game explode. Cost growth was
raised from 1.54–2.07 to **3.58–4.63**, deckhand growth from 1.28 to **1.79**, and
unlock costs re-spaced by ~26× per tier.

Result, asserted in `balance.test.ts`:

|                                                |                                              |
| ---------------------------------------------- | -------------------------------------------- |
| First prestige                                 | 2 h 18 m of active play, at 1.00e15 lifetime |
| Source unlocks                                 | 5 m, 12 m, 18 m, 27 m, 37 m, 49 m, 67 m      |
| Mostly-idle player (15% uptime)                | 3 h 08 m                                     |
| Run 2 / 3 / 4                                  | 1 h 02 m / 24 m / 1 m 25 s                   |
| Lifetime reached in a fixed 3 h, run 1 → run 6 | 4.3e15 → 1.18e45                             |
| Pearls after six runs                          | 4.27e12                                      |

**Gates:** `pnpm check` 0 errors · `pnpm lint` clean · `pnpm build` ok ·
`pnpm test` 96 passing.

## Phase 2 — Core loop

The game is playable at `/`: pick a source, hold the rod, watch the cast bar, land
fish, sell the hold, unlock the next water.

- **Components** live in `src/lib/components/`: `TopBar`, `SourcePicker`, `CastPanel`,
  `CastBar`, `HoldPanel`, `CatchTicker`, `OfflineModal`, plus `Modal` and `Num`
  primitives. All Svelte 5 runes (`$props`, `$derived`, `$state`, `{@render}`).
- **`Num.svelte` is the only place a number reaches the screen.** It wraps
  `formatNumber` and applies the coin/pearl colour, so notation stays consistent.
- **Hold-to-fish uses pointer events with pointer capture**, plus space/enter for
  keyboard players, plus `onblur`/`onpointercancel` release so a cast cannot get stuck
  running when focus or the pointer leaves.
- **Cast progress is driven by `requestAnimationFrame`, and only while the rod is
  held.** The simulation itself runs on a 200 ms `setInterval` regardless. Keeping
  them separate means an idle tab is not painting 60 times a second.
- **`SourcePicker` shows only open water plus the single next locked source.** Showing
  all eight from the start spoils the progression and makes the panel unreadable on a
  phone.
- **Theme:** dark maritime palette in `src/app.css` using custom properties, plain CSS
  only. Two-column grid above 52rem, single column below.

**Quality gate: `pnpm audit:ui` added.** `@lhci/cli` runs Lighthouse three times
against `pnpm preview` (desktop preset, headless Chrome) and asserts performance,
accessibility and best-practices at ≥ 0.9. Reports are written to `build/lighthouse`
rather than the default `.lighthouseci/`, because `/build` is already gitignored and
the brief forbids editing `.gitignore`.

**Result: performance 1.00, accessibility 1.00, best-practices 1.00, SEO 1.00** across
all three runs.

Also smoke-tested the built site in headless Chrome — the page renders the real game
markup and logs no console errors.

**Gates:** `pnpm check` 0 errors · `pnpm lint` clean · `pnpm build` ok ·
`pnpm test` 102 passing · `pnpm audit:ui` all categories 1.00.

## Phase 3 — Economy

- **Tab shell.** The layout is now a persistent rig column (cast bar, hold, catch
  ticker — always visible and sticky on desktop) beside a tabbed content column.
  Keeping the rod on screen while browsing upgrades is the whole point of the genre;
  hiding it behind a tab would make the game feel like a spreadsheet. Tabs use proper
  `role="tablist"` / `aria-selected` / `aria-controls` wiring.
- **`UpgradePanel`** shows all five gear upgrades with the current effect, the effect
  after the pending purchase, and the bulk price. The **buy amount is global**
  (`game.buyAmount`, ×1 / ×10 / ×25 / Max) and shared with the crew panel, so the
  player sets it once.
- **Bulk buys use a closed-form geometric series**, not a loop:
  `affordableUpgradeLevels` inverts `base·gⁿ` with logs to find how many levels the
  coin pile covers, and `upgradeBulkCost` sums the series directly. At Max with 1e40
  coins a loop would run for millions of iterations; this is two Decimal logs.
  Tests assert the closed form matches level-by-level summation and never overshoots.
- **Source unlocks are strictly sequential** (`canUnlock` refuses anything but
  `nextLockedSource`), so no amount of coin hoarding lets a player skip the Lagoon.

**Gates:** `pnpm check` 0 errors · `pnpm lint` clean · `pnpm build` ok ·
`pnpm test` 111 passing · `pnpm audit:ui` all thresholds met.

## Phase 4 — Automation

- **`CrewPanel`** hires deckhands per source, shows each source's coins-per-second
  contribution, and folds in the `Crew Quarters` upgrade (which multiplies every
  deckhand's output) so the whole automation economy sits on one screen.
- **The handover is shown explicitly.** The panel puts "you, holding the rod" next to
  "the crew, without you" and, once the crew win, says so with the multiple. That is
  the manual→idle moment the genre is built around, and it deserves to be legible
  rather than something the player infers from a slowly-climbing number.
- **Deckhands ride the same modifiers as the player** — the rod speeds them up, the
  net makes their casts bigger, the lure improves their odds — but at a base 42%
  efficiency scaled by Crew Quarters. Reusing the modifier stack means there is no
  second economy to balance.
- **Measured crossover:** `simulateRun` now records `idleCrossoverAt`, the second the
  crew start out-earning the rod. On the tuned curves that lands well inside the first
  half of the first run, and `automation.test.ts` asserts it is later than 30 s (so
  the manual phase is real) and before 60% of the run (so the idle phase is real).

**Gates:** `pnpm check` 0 errors · `pnpm lint` clean · `pnpm build` ok ·
`pnpm test` 121 passing · `pnpm audit:ui` all thresholds met.

## Phase 5 — Depth

- **Fishdex** (`Fishdex.svelte`) groups all 47 species by type. Undiscovered entries
  read `???` and are disabled; discovered ones expand to the written description and
  the list of water they live in. Every discovery adds a permanent **+1.85% to sale
  value** (`DEX_BONUS_PER_SPECIES`), folded into `computeModifiers`, so a full dex is
  roughly ×1.87. That is a real incentive to go looking rather than a collection
  screen with no teeth.
- **Prestige** (`PrestigePanel.svelte`) shows Pearls held, all-time Pearls, runs
  completed, the current Pearl multiplier, and a progress bar toward the 1e15
  threshold. Prestiging takes a confirmation step, because it wipes the run.
- **Pearl tree:** five upgrades — Pearl Brokerage (sale value), Tide Reader (cast
  speed), Pearl Diver's Eye (luck), Legendary Crew (deckhand output), Standing Charter
  (start with deeper water already open). Pearls also give a passive multiplier
  whether spent or not, so a player who saves is not punished.
- **Records** (`AchievementsPanel.svelte`) — 17 achievements. The Lipfish one is
  `secret: true` and is hidden from the list until earned; the panel says how many
  hidden ones remain without saying what they are.
- **Toasts** for new species and new records, dismissible, bottom-right, `aria-live`.

**The two jokes**

- **"Don't be too Jelly."** Fires in the prestige modal on the _first_ prestige — the
  game's completion moment — when the run landed zero jellyfish. `jellyFree` is
  computed from the Fishdex, so a fractional jellyfish landed by a deckhand counts;
  you have to have genuinely never touched one. **Decision:** rather than leave players
  who did catch jellyfish with no payoff at all, the non-jelly-free branch shows a
  different, wrier line that tells them the better joke existed and they missed it.
  Nothing else in the game hints at this, which is the point.
- **The Lovestruck Lipfish.** `FishType.Erotic` sells for 999 — five times a Shark and
  the most valuable thing in the water — at a weight of 0.00011 against ~100, so about
  one fish in a million. It lives in every source, so it is a lifetime lottery rather
  than an endgame reward. The reveal modal is driven off the Fishdex count rather than
  off a manual cast, because at that rarity you are far more likely to land one from a
  deckhand's line than your own. Kept firmly PG: the fish puckers at things.

- **Tabs are addressable.** `#water`, `#gear`, `#crew`, `#dex`, `#pearls`, `#records`
  via `history.replaceState`, so a refresh returns you to the panel you were on. This
  also made it possible to smoke-test every panel in headless Chrome, which caught
  nothing but proved all six render.

- **Naming gotcha, recorded because it will bite again:** a component that declares
  `const state = …` cannot also use the `$state` rune — Svelte reads `$state` as a
  store subscription to the local `state`. Components that need both name the game
  state `g` and carry a comment saying why.

**Gates:** `pnpm check` 0 errors · `pnpm lint` clean · `pnpm build` ok ·
`pnpm test` 133 passing · `pnpm audit:ui` all thresholds met.

## Phase 6 — Polish

- **Settings tab**: offline progress on/off, reduce motion, scientific notation, save
  now, export to a text blob, import from one, and a two-step save wipe.
- **Scientific notation** is a real formatter mode (`notation: 'scientific'`) rather
  than a display hack — it skips K/M/B/T and goes straight to exponents below 1e15.
  Layered notation is identical either way, because there is no suffix for `ee300`.
- **Reduce motion** is honoured twice: the OS-level `prefers-reduced-motion` media
  query, and an in-game class on the shell for players whose OS setting says otherwise.
- **The log** — casts, fish, coins this run and all time, species, jellyfish landed,
  runs completed, time at sea — sits under the Records panel.
- **Real README** replacing the create-svelte boilerplate: how it plays, the scripts
  table, the stack, the file layout, the Decimal rules, and the measured balance
  numbers.
- **Long background gaps are settled as offline progress.** A backgrounded tab has its
  timers throttled to about once a minute and a sleeping laptop stops them entirely.
  `tick()` used to clamp the gap to 60 s and silently lose the rest; `game.resume()`
  now runs the offline settlement for any gap over two minutes.

**Bug found by playtesting, not by the type checker**

An automated playthrough driven over the Chrome DevTools Protocol caught
`setPointerCapture` throwing `NotFoundError` when the event has no live pointer behind
it. The call was the first statement in the `pointerdown` handler, so the throw
aborted the handler and **the cast never started**. It is now wrapped, with the capture
released on the way out. Nothing in `pnpm check`, `pnpm lint` or `pnpm test` would ever
have caught this — it needed a browser actually pressing the button.

**Verification beyond the gates**

- Full CDP playthrough on the production build: fish → sell → switch tab → fish →
  sell → buy an upgrade (Graphite Rod reached lv 1) → visit all seven tabs → export a
  save → reload → coins preserved. **Zero page errors.**
- Responsive check at 360 / 768 / 1440 px across all seven tabs: **no horizontal
  overflow anywhere, no control under 24 px tall.**

**Gates:** `pnpm check` 0 errors · `pnpm lint` clean · `pnpm build` ok ·
`pnpm test` 136 passing · `pnpm audit:ui` performance 1.00, accessibility 1.00,
best-practices 1.00, SEO 1.00.
