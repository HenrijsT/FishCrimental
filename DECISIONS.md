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

---

# Summary

The game is finished and playable. Every phase in the brief was completed; nothing was
cut.

Run it with:

```sh
pnpm install
pnpm dev        # then open http://localhost:5173
```

## What was built, phase by phase

**Stage 0 — bug fixes** (`fix/bug-fixes`, merged with `--no-ff` into `feat/going-ham`).
All five bugs fixed. `RandomIndex` rebuilt on a cumulative-weight array with binary
search, so fractional and enormous weights both work. The 100-iteration `console.log`
simulation that ran at module import is gone, replaced by a test suite that asserts
real distribution invariants. `handleMouseDown` takes the selected source instead of
always fishing the Ocean. `sellFish` returns the profit instead of logging a number it
had already zeroed. The SvelteKit placeholder at `/` became the game, and `/test` was
deleted. Vitest was added here because bug 2 required somewhere for the distribution
check to live.

**Phase 1 — Foundation.** One `$state` object behind one store class, replacing the
`Map<FishType, Writable<Decimal>>`. `Decimal` for every currency, count, cost and
multiplier. A strict `parseDecimal` that validates against the grammar
`Decimal.toString()` actually emits, because `new Decimal('banana')` returns 0 rather
than throwing. One number formatter (K/M/B/T → scientific → e-stacked layered).
Versioned localStorage saves with a migration chain and an export/import blob. Offline
progress computed in a single pass per source, capped at eight hours. Full Svelte 5
runes migration.

**Phase 2 — Core loop.** Playable at `/`: source picker, hold-to-fish with a cast bar,
the hold, selling, the catch ticker. Dark maritime theme, responsive. `pnpm audit:ui`
added and passing.

**Phase 3 — Economy.** Five gear upgrades on exponential Decimal costs, a global buy
amount (×1 / ×10 / ×25 / Max) using closed-form geometric-series pricing rather than
loops, and the tabbed layout with the rod permanently on screen beside it.

**Phase 4 — Automation.** Deckhands per source, reusing the player's modifier stack at
42% base efficiency, plus the Crew Quarters multiplier. The manual→idle handover is
shown explicitly and measured by the simulator.

**Phase 5 — Depth.** Fishdex over 47 species with a permanent +1.85% sale bonus each,
prestige with Pearls and a five-branch Pearl tree, 17 achievements (one hidden), toasts,
and both joke payoffs.

**Phase 6 — Polish.** Settings, scientific-notation mode, reduce motion, run
statistics, export/import, a real README, and a fix for a cast-breaking pointer-capture
bug that only a browser could find.

## Compromises, with the real numbers

**No quality gate was relaxed.** `pnpm check`, `pnpm lint`, `pnpm build`, `pnpm test`
and `pnpm audit:ui` all pass at their original thresholds:

| Gate            | Result                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `pnpm check`    | 395 files, **0 errors, 0 warnings**                                                              |
| `pnpm lint`     | Prettier clean, ESLint clean                                                                     |
| `pnpm build`    | ok — static output in `build/static`                                                             |
| `pnpm test`     | **136 passing** across 11 files                                                                  |
| `pnpm audit:ui` | performance **1.00**, accessibility **1.00**, best-practices **1.00**, SEO **1.00** (three runs) |

The compromises that were made are design decisions, not relaxed gates:

1. **Two joke species were added to a codebase the brief said to reuse, not rewrite.**
   `FishType.Jelly` (sells 0) and `FishType.Erotic` (sells 999) were in the enum with
   no species behind them, so neither could ever be caught and neither joke could ever
   fire. Four species were added in a new file; no existing fish was touched. The
   catalogue is now 47, not 43.
2. **Per-source rarity mixes override the flat `fishTypeBaseChance` table.** With the
   flat table, the Ocean — which only stocks Large, Shark, Jelly and Erotic — came out
   62% jellyfish. The flat table is kept as the documented fallback.
3. **Auto-fishing is deterministic, manual fishing is random.** Rolling RNG for 1e30
   fish is not possible; deckhands use expected values, the player's rod rolls up to 16
   real fish per cast and fills the remainder from the distribution.
4. **The hold carries a coin value alongside per-type counts.** Fish from the Ocean are
   worth ~1000× the same fish from the Pond, and a plain per-type inventory cannot
   price a mixed hold. The alternative — 48 separate (source, type) buckets — would be
   unreadable.
5. **Offline catch is auto-sold** rather than dropped into the hold, so the "while you
   were away" number is a payment rather than a promise.
6. **The first prestige is defined as game completion**, which is when the
   "Don't be too Jelly" popup fires.

Balance was tuned against a simulated greedy player rather than by feel. The first
attempt reached the first prestige in **6 minutes**; the shipped curves take
**2 h 18 m** of active play (**3 h 08 m** for a mostly-idle player) and land at
**1.00e15** lifetime coins, with sources opening at 5, 12, 18, 27, 37, 49 and 67
minutes. Run 2 takes 1 h 02 m, run 3 24 m, run 4 1 m 25 s. Over a fixed three-hour
window, run 1 reaches 4.3e15 and run 6 reaches **1.18e45**, with 4.27e12 Pearls banked.

## Nothing was cut

All six phases are complete. Two things are worth naming as deliberate scope choices
rather than omissions:

- **There are no component-level UI tests.** The brief's test list is game maths, and
  adding jsdom plus a testing library would have meant installing packages beyond what
  the brief calls for. Instead the UI is verified by an automated Chrome DevTools
  Protocol playthrough and a responsive sweep — which is what caught the one real UI
  bug in the build.
- **The scratch scripts used for that verification live in the session scratchpad**,
  not in the repo, because they are throwaway harnesses rather than a test suite.

## What to review first

1. **`src/lib/game/config.ts`** — every tuned number in one file. If the pacing feels
   wrong, this is the only file to touch, and `balance.test.ts` will tell you what the
   change did.
2. **`src/lib/game/balance.ts` and `balance.test.ts`** — the simulated player and the
   assertions that keep the curves honest. This is the least conventional part of the
   build and the part most worth a second opinion.
3. **`src/lib/decimal.ts`** — the `parseDecimal` grammar. It is the one place a
   malformed save could quietly become a wrong number instead of an error.
4. **`src/lib/game/state.svelte.ts`** — the single store, the tick loop, offline
   settlement and the resume path.
5. **The `fix/bug-fixes` branch** — left undeleted for review, as instructed.

## Running it

```sh
pnpm install
pnpm dev                                     # play it
pnpm test                                    # 136 tests, ~14s
CHROME_PATH=/usr/bin/google-chrome-stable pnpm audit:ui   # Lighthouse
```

Everything is committed locally on `feat/going-ham`. Nothing was pushed.

## One late correction

`@lhci/cli` writes its working files to `.lighthouseci/` at the repo root regardless of
the `upload.outputDir` setting, which only controls where the finished reports are
copied. Seven of those artifacts had been committed since Stage 1 — build output that
does not belong in the repo. They are untracked and deleted, `pnpm audit:ui` now removes
the directory after every run while preserving lhci's exit code, and `.prettierignore`
covers it. `.gitignore` was not touched, as the brief requires.

---

# SECOND PASS

## Stage 0 — triple verification and bug fixes (`fix/round-two`)

Three passes were run separately, each with its own lens, and compared at the end.
Pass 1 read the maths and state handling. Pass 2 attacked it with hostile inputs.
Pass 3 drove the production build in headless Chrome over the DevTools Protocol.

### Confirmed bugs

**B1 — one cast wrote every species in the source into the ticker, the hold and the
Fishdex.** _(the user's reported bugs 1, 2 and 5, all one defect)_

Reproduced in a unit probe: with `net` at level 1 (`fishPerCast` 1.19), a single Pond
cast produced **31 entries** — one rolled fish plus a fractional sliver of all 30 other
species — and `Object.keys(state.dex).length` went from 0 to 31 in one click. Confirmed
live in the browser: the catch ticker read `Betta Fish ×1.06 9.55 | Zebra Barb ×1.06
9.55 | Guppy 0.51 | Tetra 0.51 | Platy 0.51 | Swordtail 0.51 …` — exactly the reported
"same stuff on every line but the first". The hold read `Small 7.21 | Medium 1.29 |
Large 0.02 | Erotic 0 !`, which is the reported Erotic bug in the same screenshot.

Cause: `performCast` rolled up to 16 fish and then filled the fractional remainder from
the expected distribution across _every_ species, and `accumulate` did the same for
deckhands. Fractional fish were the root of all three complaints.

Fixed by replacing the catch model outright — see **Stage 3**, which owns that decision.
Doing it here rather than later was deliberate: three separately-reported bugs share
this one root cause, and the brief is explicit that features should not be built on top
of broken code. Stage 3 documents the reasoning and adds the statistical proof.

**B2 — `formatNumber` rendered nonzero values as `0`.** Reproduced: `formatNumber(0.004)`
→ `"0"`, `formatNumber(1e-6)` → `"0"`. Below 0.05 the `toFixed(1)` path produced `"0.0"`
and `trimTrailingZeros` turned it into `"0"`. This is what made a sub-unit Erotic count
render as a red-flagged zero. Now anything in `(0, 0.01)` renders `<0.01`, and a value
that would round to `"0"` is caught and rendered the same way. A real zero still reads
`0`. Four tests cover it.

**B3 — toasts only dismissed; they did not go anywhere.** Reproduced live: clicking a
"New in the Fishdex" toast left the active tab on Water. Toasts now have two targets —
the body navigates (`selectTab(tab, focusTarget)`), and a separate `×` dismisses. The
Fishdex opens and scrolls to the species; the Records panel scrolls to and outlines the
achievement. Verified live: tapping the toast switched to Fishdex, expanded _Giant
Gourami_, and set `location.hash` to `#dex`.

**B4 — every source stocked almost every species, all at identical rarity.**
_(the user's "verify if it's a bug" item — it was one.)_ Reproduced: the Pond catch
table held **31 species**, including all 12 Medium fish, and every species inside a
category had `baseChance: 10`, giving a flat 7.08e-2 each. There was no reason to fish
anywhere else and nothing to hunt for.

Rewrote the rosters and the rarity spread across all 43 catalogue species. Sources now
hold **8 to 14** species each, with `baseChance` ranging 1–24 inside a category
(Guppy 24 down to Betta Fish 2; Nurse Shark 16 down to Whale Shark 1). Bull sharks are
in the river, whale sharks only in the ocean, and the Pond's Giant Gourami is a rare
surprise rather than a certainty.

**This has zero economic impact by construction** — `averageValue` depends only on the
per-type probabilities in `SOURCE_CONFIG`, which were not touched, and every source
still stocks every type it is configured to pay out. That invariant is now a test.

**B5 — a large crew overflowed a double and could destroy the save.**
`autoCastsPerSecond` returned a plain `number` via `crew.times(rate).toNumber()`.
Reproduced with a crew of 1e320: the result was `Infinity`, which flowed into
`holdValue`, then `coins`, then the save file — where `parseDecimal` correctly rejects
`Infinity` and the field silently falls back to **zero**. A player at that scale would
have lost everything on reload. `autoCastsPerSecond` now returns a `Decimal`. The
regression test runs a 1e320 crew through accumulate → sell → serialise → load and
asserts the coins come back intact.

**B6 — bulk-buying deckhands cost more than buying them one at a time.** Reproduced:
ten Pond deckhands cost 112,938 singly and 112,943.47 in bulk, because `deckhandCost`
floored and `deckhandBulkCost` summed the exact geometric series. Dropped the floor;
the two now agree to nine decimal places.

**B7 — a save from a newer build loaded silently and was then overwritten.** Reproduced:
a save with `version: 99` and unknown fields loaded as if it were current, and the next
autosave wrote the truncated version back. `deserialize` now throws `FutureSaveError`,
`loadFromStorage` returns a tagged outcome, and the game refuses to save at all while a
save problem is outstanding. Verified live: the banner appears and the file still reads
`v99 mystery=keep me coins=5555` after a full 12-second autosave window.

**B8 — hand-edited saves were trusted.** Reproduced: `coins: '-1e30'` loaded as negative
money; `upgrades.rod: '1e30'` loaded a rod 1e30 levels above its own maximum. Currencies
and counts are now clamped non-negative and floored, levels are clamped to `maxLevel`,
and the new remainder bank rejects anything outside `[0, 1)`.

**B9 — two tabs on one save clobbered each other.** Both autosaved, last writer won.
A `storage` listener now detects another tab writing, stops this tab saving, and offers
a reload. Chosen over merging or locking because it is the only option that cannot lose
data.

### Hardening that was not a reproducible bug

- `#settleOffline` was called with the raw loaded object in `init()` and `importBlob()`
  rather than with `this.state`. Assigning to a `$state` field wraps the value in a
  proxy, so those mutations bypassed reactivity. No visible failure could be produced —
  nothing had subscribed yet at that point — but the code was wrong and is now correct.

### Hypotheses that could not be reproduced

- **Log-rounding overshoot in `affordableUpgradeLevels` / `affordableDeckhands`** driving
  coins negative. Brute-forced 1,120 upgrade cases and 1,000 deckhand cases across five
  upgrades, eight sources, 40 levels and coin piles from exactly-affordable to 97×:
  **zero overshoots, zero negative balances.** 500 spam-clicks of every buy button in a
  live browser also produced no negative balance.
- **Timer leak on unmount.** `stop()` clears all three handles and `onMount` returns it.
- **Duplicate keys in the toast `{#each}` crashing the renderer.** Guarded on both paths.
- **`parseDecimal` rejecting a legitimate value.** It rejects non-canonical forms like
  `1e1e300`, which break_eternity accepts as _input_ but never _emits_. Saves only ever
  contain `toJSON()` output, and `decimal.test.ts` round-trips 40 escalating magnitudes.
  Only reachable by hand-writing a save in a form the game never produces.

### Runtime pass

Full playthrough on the production build over CDP: fresh save → manual fishing →
mid-cast source switch (cast correctly cancelled) → refresh mid-cast → toasts →
seeded mid-game → prestige → offline settlement at 3 hours, at one year (correctly
capped at 8h with the explanatory line) and with the clock set 90 days _forward_
(no modal, no negative earnings) → layer-2 Decimals through every panel → 1,000
spam clicks. **No console errors or warnings at any point, before or after the fixes.**

**Gates:** `pnpm check` 0 errors · `pnpm lint` clean · `pnpm build` ok ·
`pnpm test` 163 passing · `pnpm audit:ui` 1.00 / 1.00 / 1.00 / 1.00.

## Stage 1 — making the game understandable

### Per-source visual identity

`src/lib/game/scenes.ts` holds a palette and a feature list per source;
`WaterScene.svelte` renders them through one SVG skeleton. That gets eight scenes
that read as different places without eight hand-drawn files:

|          |                                                            |
| -------- | ---------------------------------------------------------- |
| Pond     | warm green, reeds, lily pads, sun, you can see the bottom  |
| Stream   | pale blue-green, boulders, pebbles, current streaks, trees |
| River    | wider, tree line, current, boulders, more depth            |
| Lake     | still, distant hills, a jetty, light rays                  |
| Lagoon   | turquoise over a white sandbar, coral, bright sun          |
| Sea      | open blue, gulls, real swell                               |
| Offshore | grey, heavy swell, a marker buoy, kelp                     |
| Ocean    | near-black under starlight, the heaviest swell, deep kelp  |

Depth and swell both increase monotonically down the list, and a test asserts it.
`SourceThumb.svelte` renders the same palette at 48×32 so the picker list is
recognisable at a glance. **Everything is inline SVG plus CSS keyframes — no image
files, no external hosts.** `static/` still contains only `favicon.png`. A test
asserts every scene colour is a literal hex value, so an asset path cannot creep in.

### The act of fishing

Three states, visibly different: **idle** (water only), **casting** (rod, line arcing
out, float landing, spreading ripple; the bar reads "Casting…" then "Waiting for a
bite…") and **landing** (a splash burst over the float). Verified live: mid-cast the
`.tackle` group is in the DOM and the bar label changes.

### Legible catches

A flash card rises over the water naming the fish, the count and what it made, styled
by **rarity computed from its actual probability in that water** — `common`, `uncommon`,
`rare`, `exotic`, `mythic`. A mythic catch gets a gold border, a glow and larger type;
a guppy gets none of that. The ticker carries the same rarity as a coloured pip with a
legend, so a Lovestruck Lipfish cannot scroll past looking like a guppy. The flash names
the **rarest** fish of a multi-fish cast, not the last one.

### Explaining the systems

Short, concrete copy where the decision is made rather than in a guide tab: the source
picker says what a source costs, how long a cast takes there and what a fish is worth;
the gear panel says upgrades multiply together; the hold says where you caught it
matters more than what it is; the crew panel already stated the deckhand rate and the
handover. Locked sources say the price and whether you can afford it.

### Onboarding

**Staged tabs.** A new player sees one tab — Water — and one button. Gear appears after
the first sale, Crew when a deckhand comes within reach, Fishdex at two species, Pearls
at the Sea or 1e9 lifetime, Records at the first achievement, Settings after twelve
casts. Each new tab carries a `new` badge and shows a one-line blurb with a "Got it".

**One next action, never a list.** `nextStep()` returns a single sentence and optionally
a tab to jump to. It walks: hold the rod → sell the hold → buy the first upgrade → hire
the first deckhand → open the next source → reach the Ocean → prestige. Tested to always
point at a tab that exists.

**Decision: staged reveal over a tutorial modal.** A modal is read once and forgotten,
and it competes with the thing it is describing. Tabs that arrive when they become
relevant teach the same thing by being there, cost nothing to skip, and survive a
reload because they are derived from game state rather than a "seen tutorial" flag.

### Motion

Every animation is CSS on an SVG group. Both the OS `prefers-reduced-motion` query and
the in-game Reduce Motion setting stop all of it, verified live. **Lighthouse still
scores 1.00 / 1.00 / 1.00 / 1.00** with the animation running, so nothing had to be cut.

Responsive re-checked at 360 / 768 / 1440 px: no horizontal overflow. No console errors.

## Stage 2 — licences and the boat

### Licences

**Decision: a chain of four, not independent permits.** Independent licences would let
a player with one big payday buy a Deep Sea Charter before they had ever fished a
stream, which reads wrong and flattens the progression. A chain gives four ordered
beats and a natural place for flavour.

| Licence                | Covers        | Cost       |
| ---------------------- | ------------- | ---------- |
| Inland Angling Licence | Stream, River | 360        |
| Lake & Lagoon Permit   | Lake, Lagoon  | 14,000     |
| Coastal Waters Licence | Sea, Offshore | 640,000    |
| Deep Sea Charter       | Ocean         | 38,000,000 |

The Pond needs nothing — the first two minutes of the game must not have a form to
fill in. A licence is separate from the source's coin cost, so opening new water has
two beats: qualify, then afford.

### The boat

**Decision: Offshore and Ocean need it; the Sea does not.** The brief left the Sea to
judgement. Keeping it shore-accessible means the boat arrives _after_ the player has
met licences, deckhands, upgrades and the Fishdex, rather than piling a fifth system on
top of a fourth. It also gives the fallback somewhere real to fall back _to_ — the Sea
is a genuinely productive place to be stranded, not a punishment.

- **Boat** — 1,950,000 coins, bought once.
- **Fuel** — 0.85 L per open-water cast at 5,400 coins/L, from a 400 L tank.
- **Condition** — 0–100, 0.006 lost per open-water cast, 74,000 coins per point to repair.
- **Fit-out** — Reinforced Hull (wear ×0.72/level), Efficient Engine (fuel ×0.74/level),
  Larger Tank (×1.85/level), and Standing Fuel Order (one-off).

### Never a fail state — and what that actually took

The brief's hard constraint drove four separate design choices, each with a test:

1. **Condition never stops the boat.** `boatEfficiency` maps 0–100 onto 0.4–1.0 and is
   applied as _drag on cast time_. A completely neglected boat is 60% slower. It is
   never 0, and it costs nothing to leave broken except speed.
2. **An empty tank falls back, it does not halt.** `reachableSource` walks back to the
   deepest water that is unlocked, licensed and shore-accessible. In `accumulate`, the
   casts the boat could not cover are _worked inshore instead_ and still pay. A test
   runs eight hours with an empty tank, zero condition and no money and asserts the
   value earned is greater than zero and nothing was destroyed.
3. **The player is told, in plain words.** A persistent banner names the water they were
   moved from and to, says nothing was lost, and offers a jump to the harbour. The
   offline summary carries the same line when it happened while they were away.
4. **A standing order removes the chore entirely.** It is a _delivery_, not a tank
   top-up — it buys exactly what the trip needs, capped only by coins, and bills for it.
   An empty tank with a standing order and coins in hand counts as able to sail.

**Two bugs came out of playtesting this, not out of the type checker:**

- The stranded banner cleared itself on the very next 200 ms tick, because
  `#keepFishable` tested the source the player had just been _moved to_ rather than the
  one they were moved _from_. Reproduced live: the banner never appeared at all.
- With a standing order the tank ended each trip at exactly zero, and
  `fuel / fuelPerCast` then floored to one cast short — so every trip reported a
  fallback and the player was flagged as stranded despite a paid-up standing order.
  Fixed with a small purchase margin, plus `canSail` treating an affordable standing
  order as fuel in hand. Both have regression tests.

### Pacing

Both systems are bought by the simulated player in `simulateRun` — it takes each licence
as soon as it is affordable and required, buys the boat before it needs open water,
keeps the tank filled, arranges a standing order once it is worth 2.5× its price, and
repairs below 65% condition.

Adding the sinks pushed the first prestige from **2 h 18 m to 2 h 41 m**. Trimming
licence and boat prices barely moved it (2 h 39 m) — the delay is the licence gate
sitting in front of each tier, not the money. The lever that actually worked was the
`market` upgrade cost growth, **3.71 → 3.62**, which brought it back to **2 h 25 m** —
within 5% of where it was before this stage.

|                      | before Stage 2             | after                   |
| -------------------- | -------------------------- | ----------------------- |
| First prestige       | 2 h 18 m at 1.00e15        | **2 h 25 m at 1.00e15** |
| Mostly-idle player   | 3 h 08 m                   | 3 h 30 m                |
| Sources open at      | 5/12/18/27/37/49/67 m      | 6/14/21/30/39/53/71 m   |
| Licences taken at    | —                          | 3 / 14 / 23 / 33 m      |
| Boat bought at       | —                          | 39 m                    |
| Run 2 / 3 / 4        | 1 h 02 m / 24 m / 1 m 25 s | 1 h 03 m / 24 m / 57 s  |
| Run 6 lifetime (3 h) | 1.18e45                    | **1.79e55**             |

Source unlock costs were also cut 20% to soften the double charge of licence-plus-price
at each tier.

**Save format 3**, with a migration that grandfathers an existing run: the licences
covering water it had already opened are granted, and a save that had already reached
open water is handed a boat. Nobody loses access to water mid-run.

**Gates:** `pnpm check` 0 errors · `pnpm lint` clean · `pnpm build` ok ·
`pnpm test` 213 passing · `pnpm audit:ui` 1.00 / 1.00 / 1.00 / 1.00.

## Stage 3 — the fractional catch question

### The decision

**Every count in the game is a whole number. Fractional rates are resolved by banking
the remainder — not by rounding, and not by rolling dice.**

A rate of 1.19 fish per cast pays 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2 … and the long-run
average is 1.19 to the last digit. `takeWhole(state, key, amount)` adds the amount to a
banked remainder, pays out the whole part, and keeps the fraction for next time. The
bank lives in `state.carry`, keyed by `source#thing`, and is saved.

### Why not the other two options

**Keep fractions and show them honestly.** This is what the first build did, and it is
what produced three of the five bugs the user reported. A cast wrote 0.51 of a Guppy,
0.34 of a Tetra and a two-hundred-thousandth of a Lipfish into the hold, the ticker and
the Fishdex _simultaneously_, because the only honest way to hand out 1.19 fish drawn
from a 31-species distribution is to hand out a slice of all 31. The result: the catch
ticker showed the same list every cast, the hold displayed `Erotic 0 !`, and a player
with three deckhands had "caught" every species in the pond within seconds. Fractional
fish are not a display problem. They are a modelling problem that surfaces everywhere.

**Resolve stochastically — 1.19 means 2 fish 19% of the time, by coin flip.** Correct
in expectation, and it was the strong contender. Rejected for three reasons:

1. It is only unbiased _in expectation_. Remainder banking is unbiased **exactly**: at
   any moment, everything the player is owed has either been paid out or is sitting in
   the bank. A test asserts `paid + banked === rate × draws` to three decimal places
   over 100,000 draws at seven different rates.
2. It adds variance to a number the player is watching go up. Idle-game income is a
   ratchet; noise on it reads as a bug.
3. Offline it would need either a binomial sample per species per window (fine) or a
   normal approximation (an approximation). Banking needs neither.

### How it satisfies each requirement

**Unbiased.** Proved, not asserted. `takeWhole` is tested at rates 0.1 through 7.77 over
100,000 draws each; the error never exceeds the un-banked remainder, and a drift test
samples the error every 20,000 draws over 200,000 and shows it flat rather than growing.
Species proportions are checked against the catch table on both code paths — within
0.006 on the rolled path over 120,000 casts and within 0.002 on the bulk path over
500,000 fish. The one-in-a-million Lipfish comes up within ±10% of its true rate over
50 million fish.

**Consistent.** Manual and automatic fishing call **the same function**.
`performCast` passes `fishPerCast`; `accumulate` passes `casts × fishPerCast`. There is
no separate automatic economy. A test drives 10,000 casts by hand and the same number by
crew and asserts both land within 0.1% of the quoted rate and of each other. A second
test asserts both functions still route through `distributeCatch`, so the two cannot
quietly drift apart.

**The one seam, and where it sits.** Inside `distributeCatch`, hauls of **24 fish or
fewer are rolled one fish at a time** against the weighted table; larger hauls are split
across species by expected share with the same banking applied per species. The seam is
on _haul size_, not on _who is fishing_ — a player with a huge net gets the bulk path
too, and a one-deckhand crew gets rolled fish. This is deliberate: a small haul is a
moment the player is watching, and it should be a real draw with real surprise; a
haul of ten billion is a number, and rolling it is not possible. Both are unbiased.

**Offline-computable.** Eight hours resolves in one call per source. A test gives every
source a billion deckhands, runs eight hours, and asserts it returns in under 250 ms —
it completes in single-digit milliseconds. A second test checks one eight-hour call
against 480 one-minute calls and gets the same answer within 1%.

**Legible.** The cast panel now says, in words: _"1.19 fish a cast — 1 most casts, 2
about 19% of the time"_. Above 1,000 it drops the explanation and just shows the number.
No screen anywhere can be asked to display a fraction of a fish — a test asserts every
hold entry is either exactly zero or at least one.

**Tested.** `catch_model.test.ts`, 19 tests, plus four on the wording in
`format.test.ts` and the round-two regressions that this replaced.

### One implementation note

`state.carry` values are plain `number`, not `Decimal`, and that is deliberate rather
than an oversight of the Decimal rule. They are always in `[0, 1)`: they are fractions
of a unit, never counts, never compounded and never spent. Above 2^53 there is no
representable fractional part left to bank, so `takeWhole` floors and returns. The save
loader throws away any carry entry outside `[0, 1)`.

**Gates:** `pnpm check` 0 errors · `pnpm lint` clean · `pnpm build` ok ·
`pnpm test` 236 passing · `pnpm audit:ui` 1.00 / 1.00 / 1.00 / 1.00.

## Stage 4 — final triple verification

Three passes again, over the whole game including everything Stages 1–3 added.

### Confirmed bugs, all found in this pass

**F1 — the Standing Charter handed out water the player had no licence for.**
Found by the logic pass and immediately confirmed by the balance suite: the six-run
prestige chain completed only five runs. `createInitialState` reset licences to all
false but `pearl_headstart` still unlocked sources, so a run started standing over
unlicensed water, earned nothing there, and stalled. Fixed: licences still reset with
the run — they belonged to the operation you sold — but anything the Charter opens comes
with the paperwork already done. Four regression tests, including one that walks every
headstart level 0–7.

**F2 — a headstart run could start standing over water with no boat under it.**
Same root: `activeSource` picked the deepest unlocked source, which at headstart 6+ is
Offshore, and a fresh run has no boat. Now it picks the deepest unlocked source that is
not boat-only. Tested at every headstart level.

**F3 — unlicensed water still paid out.** `accumulate` and `autoCastsPerSecond` checked
`unlocked` but not the licence, so they disagreed with `reachableSource` about where the
crew were allowed to work. Reproduced with a hand-edited save: 28 fish an hour out of
water the player had no permit for. Both now check the licence.

**F4 — a NaN boat condition blanked every cast time.** `boatEfficiency` divides into
`castSeconds`, so a non-finite condition propagated NaN into every source in the game.
Not reachable from a save — `readBoat` clamps — but reachable from any future code path
that writes the dial. `boatEfficiency` now treats anything non-finite as a wrecked boat.

**F5 — the offline summary subtracted the fuel bill twice.** The report's `coins` was
net of fuel, and the modal then showed the fuel bill as a separate line underneath, so a
reader taking both at face value undercounted. `coins` is now gross, and the modal shows
earnings, the fuel bill and the net as three lines.

### Verified live, end to end

A real playthrough on the production build: fresh save → six rounds of hold-and-sell →
tabs staging in as they were earned → buy the Graphite Rod (cast time 1.15s → 0.97s) →
earn through to a licence → licence stamped → Stream unlocks → switch to it and watch
**the scene and its description change** → every unlocked tab renders → reduce motion →
scientific notation → responsive sweep. **No console errors or warnings at any point.**

The two-tab guard was verified directly. A CDP-created second tab is backgrounded and
its autosave timer is throttled, so it never wrote and the guard never fired — a harness
limitation, not a game one. Driving the exact `StorageEvent` Chrome delivers instead:
the banner appears, the tab stops saving (a sentinel written into `localStorage`
survived a full 12-second autosave window untouched), Reload and Dismiss are both
offered, and an unrelated storage key is correctly ignored.

Responsive re-checked across **all eight tabs at 360 / 768 / 1440 px**: zero horizontal
overflow at every combination.

### Hypotheses that could not be reproduced

- **`fuelPerCast` reaching zero and dividing by zero in `runBoat`.** At maximum Engine
  it is 0.0061 L, and the curve is multiplicative so it can never reach zero.
- **`takeWhole` poisoned by a non-finite amount.** Probed with NaN and with 1e1200:
  NaN returns 0 and never enters the bank; a large finite Decimal is floored and
  returned. No path was found that produces an actual `Infinity` there.
- **A 1e300 crew breaking the save.** Probed end to end — accumulate, sell, serialise,
  reload — and the coins came back bit-identical, with every hold entry still integral.

### Final numbers

|                                 |                                     |
| ------------------------------- | ----------------------------------- |
| First prestige                  | **2 h 25 m** at 1.00e15 lifetime    |
| Sources open at                 | 6 / 14 / 21 / 30 / 39 / 53 / 71 min |
| Licences taken at               | 3 / 14 / 23 / 33 min                |
| Boat bought at                  | 40 min                              |
| Crew out-earn the player at     | 11 min                              |
| Mostly-idle player (15% uptime) | 3 h 30 m                            |
| Runs 2 / 3 / 4 / 5 / 6          | 1 h 03 m / 24 m / 57 s / 13 s / 4 s |
| Run 6 lifetime in a fixed 3 h   | 1.79e55                             |
| Pearls after six runs           | 8.05e16                             |

**Gates:** `pnpm check` 0 errors · `pnpm lint` clean · `pnpm build` ok ·
`pnpm test` **260 passing** across 17 files · `pnpm audit:ui` **1.00 / 1.00 / 1.00 / 1.00**.

---

# Second pass — closing summary

All five stages are complete. The game is playable, committed on `feat/going-ham`, and
nothing was pushed.

```sh
pnpm install
pnpm dev        # http://localhost:5173
```

## Every bug found, and how

**Fourteen confirmed**, each reproduced before being fixed and re-verified after.

_Stage 0 — the round-two hunt (`fix/round-two`, merged `--no-ff`)_

| #   | Bug                                                                                                                                                                             | Reproduced by                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | One cast wrote a fractional sliver of **all 31 species** in the source into the ticker, the hold and the Fishdex — the single cause of three of the five bugs the user reported | Unit probe: `caught.size` was 31 after one cast at `net` level 1. Confirmed live: the ticker read `Guppy 0.51 \| Tetra 0.51 \| Platy 0.51 …` and the hold read `Erotic 0 !` |
| B2  | `formatNumber` rendered nonzero values as `"0"`                                                                                                                                 | `formatNumber(0.004)` → `"0"`                                                                                                                                               |
| B3  | Toasts only dismissed, never navigated                                                                                                                                          | Clicking a Fishdex toast left the tab on Water                                                                                                                              |
| B4  | Every source stocked nearly every species at identical rarity                                                                                                                   | Pond catch table held 31 species, all at 7.08e-2                                                                                                                            |
| B5  | A large crew overflowed a double to `Infinity`, which the save layer rejects — **silently zeroing the player's coins on reload**                                                | A 1e320 crew produced `Infinity` through hold → coins → save                                                                                                                |
| B6  | Bulk-buying deckhands cost more than buying them singly                                                                                                                         | Ten Pond deckhands: 112,938 singly, 112,943.47 in bulk                                                                                                                      |
| B7  | A save from a newer build loaded silently and was then overwritten                                                                                                              | `version: 99` loaded and was truncated on the next autosave                                                                                                                 |
| B8  | Hand-edited saves were trusted — negative coins, rod level 1e30                                                                                                                 | `fromRaw({coins: '-1e30'})`                                                                                                                                                 |
| B9  | Two tabs on one save clobbered each other                                                                                                                                       | Both autosaved, last writer won                                                                                                                                             |

_Stage 2 — found by playtesting the boat, not by the type checker_

| #   | Bug                                                                                                                                                                         | Reproduced by                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| B10 | The stranded banner cleared itself on the next 200 ms tick, because it tested the source the player had been moved **to** rather than **from**                              | Banner never appeared live                                     |
| B11 | With a standing order the tank ended each trip at exactly zero, and `fuel / fuelPerCast` floored one cast short — so every trip reported a fallback despite a paid-up order | Offline summary said "ran out of fuel" with 1e12 coins in hand |

_Stage 4 — the final pass_

| #   | Bug                                                                                                             | Reproduced by                                                        |
| --- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| B12 | The Standing Charter opened water the player had **no licence for**, stalling every prestige run past the first | The six-run balance chain completed five                             |
| B13 | A headstart run could start standing over open water with no boat                                               | Same root; caught at headstart ≥ 6                                   |
| B14 | Unlicensed water still paid out — `accumulate` disagreed with `reachableSource`                                 | Hand-edited save earned 28 fish/hour from unpermitted water          |
| B15 | A non-finite boat condition propagated NaN into every cast time                                                 | `boatEfficiency(NaN)`                                                |
| B16 | The offline summary subtracted the fuel bill twice                                                              | Coins delta 204.4M vs sales 210.2M with a 5.8M bill shown separately |

Every one has a regression test. The user's five reported bugs map to B1 (three of
them), B3 and B4.

## Hypotheses that could not be reproduced

Logged rather than fixed, as the brief requires.

- **Log-rounding overshoot in `affordableUpgradeLevels` / `affordableDeckhands`.**
  Brute-forced 1,120 upgrade and 1,000 deckhand cases across five upgrades, eight
  sources, 40 levels and coin piles from exactly-affordable to 97×: zero overshoots,
  zero negative balances. 1,000 live spam-clicks agreed.
- **Timer leak on unmount.** `stop()` clears all three handles and `onMount` returns it.
- **Duplicate keys crashing a toast `{#each}`.** Guarded on both paths.
- **`parseDecimal` rejecting a legitimate value.** It rejects non-canonical forms like
  `1e1e300`, which break_eternity accepts as input but never emits.
- **`fuelPerCast` reaching zero and dividing by zero.** Multiplicative curve, floor
  0.0061 L at maximum Engine.
- **`takeWhole` poisoned by a non-finite amount.** NaN returns 0 and never banks.
- **A 1e300 crew corrupting the save.** Probed end to end; coins returned bit-identical.

## The fractional catch question

**Decision: every count is a whole number, and fractional rates are resolved by banking
the remainder.** 1.19 fish per cast pays 1, 1, 1, 1, 1, 2, 1 … averaging exactly 1.19.

The argument in one line each: _keeping fractions_ is what produced three of the five
reported bugs, because the only honest way to hand out 1.19 fish from a 31-species
distribution is to hand out a slice of all 31; _resolving stochastically_ is unbiased
only in expectation and adds noise to the one number an idle player watches; _banking_
is unbiased **exactly** — at any moment everything owed has either been paid or is in
the bank — needs no RNG, and resolves eight hours in a single step.

Manual and automatic fishing call the same function, so they cannot pay differently.
The one seam is haul size, not who is fishing: **24 fish or fewer are rolled one at a
time** so a small catch is a real draw with real surprise; larger hauls split by
expected share with the same banking per species. Full reasoning in the Stage 3 section.

## How licences and the boat changed the pacing

|                               | Before second pass         | After                   |
| ----------------------------- | -------------------------- | ----------------------- |
| First prestige                | 2 h 18 m at 1.00e15        | **2 h 25 m at 1.00e15** |
| Mostly-idle player            | 3 h 08 m                   | 3 h 30 m                |
| Sources open at               | 5/12/18/27/37/49/67 min    | 6/14/21/30/39/53/71 min |
| Licences taken at             | —                          | 3 / 14 / 23 / 33 min    |
| Boat bought at                | —                          | 40 min                  |
| Crew out-earn the player at   | 12 min                     | 11 min                  |
| Runs 2 / 3 / 4                | 1 h 02 m / 24 m / 1 m 25 s | 1 h 03 m / 24 m / 57 s  |
| Run 6 lifetime in a fixed 3 h | 1.18e45                    | **1.79e55**             |

Adding the sinks first pushed the run to **2 h 41 m**. Trimming licence and boat prices
barely helped (2 h 39 m) — the delay is the licence gate in front of each tier, not the
money. The lever that worked was `market` cost growth, **3.71 → 3.62**, plus a 20% cut
to source unlock costs to soften the double charge. Final: **2 h 25 m, within 5% of
where it started.**

## Compromises, with the real figures

**No quality gate was relaxed.** All five pass at their original thresholds:

| Gate            | Result                                    |
| --------------- | ----------------------------------------- |
| `pnpm check`    | 409 files, **0 errors, 0 warnings**       |
| `pnpm lint`     | Prettier clean, ESLint clean              |
| `pnpm build`    | ok                                        |
| `pnpm test`     | **260 passing** across 17 files (was 136) |
| `pnpm audit:ui` | **1.00 / 1.00 / 1.00 / 1.00**, three runs |

The judgement calls, each with its number:

1. **The catch-model rewrite landed in Stage 0, not Stage 3.** Three separately-reported
   bugs shared it as a root cause, and the brief is explicit that features must not be
   built on broken code. Stage 3 owns the decision, the argument and the 19-test proof.
2. **Four species were added in the first pass and their rosters rewritten in this one.**
   43 catalogue species now sit 8–14 to a source instead of up to 31, with `baseChance`
   spread 1–24 instead of a flat 10. **Zero economic impact by construction** — value
   depends only on the per-type weights, which were not touched — and that invariant is
   a test.
3. **The Sea does not need a boat.** The brief left it to judgement. Keeping it
   shore-accessible means the boat arrives after every other system, and gives the
   fuel fallback somewhere genuinely productive to fall back to.
4. **`state.carry` values are plain `number`, not `Decimal`.** They are always in
   `[0, 1)` — fractions of a unit, never counts, never compounded, never spent. Above
   2^53 there is no representable fraction left to bank.
5. **The offline settlement runs in up to 24 chunks, not one.** A standing fuel order
   pays out of coins, and coins only arrive when the catch is sold. 24 chunks covers
   eight hours; it is not a per-cast simulation.
6. **No component-level UI tests.** The brief's test list is game maths, and jsdom plus
   a testing library would be packages beyond what the work requires. The UI is verified
   by CDP playthroughs instead — which is what found B10, B11 and B16.

Nothing was cut from the brief.

## What to look at first

1. **Play it.** `pnpm dev`. The first two minutes are the part that changed most: one
   tab, one button, one instruction, and a pond that looks like a pond.
2. **`src/lib/game/engine.ts`, `takeWhole` and `distributeCatch`** — the catch model, and
   the answer to the fractional question.
3. **`src/lib/game/catch_model.test.ts`** — the proof. 19 tests: unbiasedness at seven
   rates over 100,000 draws each, distribution accuracy on both paths, manual/auto
   parity, and eight hours resolving in under 250 ms with a billion deckhands.
4. **`src/lib/game/config.ts`** — every tuned number in one file, now including licences
   and the boat. `balance.test.ts` will tell you what any change did.
5. **`src/lib/components/WaterScene.svelte` and `src/lib/game/scenes.ts`** — eight water
   scenes from one SVG skeleton. `static/` still holds only `favicon.png`.
6. **`fix/round-two`** — left undeleted for review, as instructed.

## Running it

```sh
pnpm install
pnpm dev                                                   # play it
pnpm test                                                  # 260 tests
CHROME_PATH=/usr/bin/google-chrome-stable pnpm audit:ui    # Lighthouse
```

Everything is committed locally on `feat/going-ham`. Nothing was pushed.

# THIRD PASS

Brief: `Goals/THIRD_GOAL.md`. Inputs: `Goals/AUDIT.md` (an independent 13-agent
audit — 29 findings raised, 6 refuted, 23 confirmed), `ideas.txt`,
`USER-REQUIREMENTS.md`, and this file.

Five stages: act on the audit, settle licensing and visibility, research and
plan from `ideas.txt` (the main deliverable), build an auto-fisher, and
evaluate SvelteKit 3.

---

## Stage 0 — the six mandatory audit defects

Branch `fix/audit`, merged into `feat/going-ham` with `--no-ff` as `d789326`.
Branch kept.

The audit's structural finding drove the approach: **260 tests, all green, all
in the pure engine — and all 23 confirmed defects outside it.** The 612-line
`Game` class and all 29 components had zero coverage. So every fix here is
paired with a test, and `src/lib/game/lifecycle.test.ts` is the first thing in
the repo to import `state.svelte.ts`.

Each defect was reproduced before being fixed. The reproduction ran first and
failed; 8 of the 15 lifecycle tests failed on the original code, and 10 of the
12 routing tests.

### 1. Offline settle paid for the hold you already had, and handed it back

`state.svelte.ts:287`, critical. `sellHold` ran *inside* the chunk loop; the
restore afterwards put the fish back without ever rolling back `coins`.

Reproduced exactly as the audit described — three resumes with a 1e6 hold:

```
resume 1: coins=1000000  holdValue=1000000  hold=1000
resume 2: coins=2000000  holdValue=1000000  hold=1000
resume 3: coins=3000000  holdValue=1000000  hold=1000
```

Silent with no deckhands, because the early return means no modal renders at
all. It inflated `lifetimeCoins` identically, so it minted Pearls out of
nothing.

Fixed by zeroing the hold *before* the loop instead of restoring it after. That
repairs the early-return path for free: with the hold zeroed, a no-catch settle
sells nothing.

Five tests: no payment for the existing hold; no duplication across repeated
resumes; `lifetimeCoins` unchanged; the crew's real earnings still paid and the
report's coin figure matching the balance (it used to say 11,171 next to
62,757); and the hold untouched when nothing happened.

### 2. The multi-tab guard muted the tab the player was using

`state.svelte.ts:168`. The `storage` event fires in the tab that did **not**
write, so reacting to it by muting saves silences the victim. A plain tab
switch is enough to trigger it, because the tab being left saves on
`visibilitychange`.

**This refutes B9 in the second pass above, which called it "the only option
that cannot lose data".** It lost data three ways.

Now it warns and **keeps saving**. That is last-writer-wins, which is where the
game already was — the guard was not preventing the clobbering, only choosing a
different victim. `SaveProblem` gained a blocking/non-blocking split:
`BLOCKING_SAVE_PROBLEMS` is `future` and `corrupt` only.

The banner also gained a **Copy backup** button, because its old advice
("Reload to pick up where the other tab is") discards the muted tab's session.

### 3. A refused localStorage write was completely silent

`state.svelte.ts:235`. Every caller discarded the boolean — the autosave, the
`pagehide` handler, and the Save now button — while `SettingsPanel` went on
asserting *"The game saves to this browser every 10 seconds."*

New `write-failed` problem kind, raised on refusal and cleared when a write
succeeds again. Deliberately non-blocking: a full quota should not also stop
the game trying.

### 4. Dismiss on the future/corrupt banner destroyed the save it protected

`state.svelte.ts:238`. Dismissing cleared the flag with no other effect, and
the 10-second autosave was still armed — so ten seconds later the fresh game
overwrote the preserved save. The banner's own advice, *export it and start
fresh*, was impossible: `exportBlob()` serialised the brand-new game.

Two fixes. `dismissSaveProblem()` copies the raw bytes to
`fishcrimental.save.bak` first (new `SAVE_BACKUP_KEY`, `backupRawSave`,
`readRawSave`). And `exportBlob()` returns the **preserved** blob while a
blocking problem stands, via a new `exportRawSave` that wraps the original
bytes verbatim rather than round-tripping them through the parser that could
not read them.

### 5. The headline coins/s ignored the boat gate

`engine.ts:482`. Measured here at **5.03x** overstatement for a dry-tank
Offshore crew (the audit measured 20-34x in its own scenarios), and the
deeper-deckhand claim reproduced to the digit: **22,339/s advertised for an
Offshore deckhand against 5,958/s for a Sea one**, when the Offshore crew
cannot sail and are actually working the Sea.

Fixed by extracting **one** routing helper, `routeCasts(state, modifiers,
source, casts, spend)`, used by `accumulate` (with `spend = true`, which burns
the fuel) and by `sourceIncomePerSecond` (with `spend = false`, which predicts
the identical split without spending). `runBoat`'s fuel arithmetic was factored
into `fuelForTrip` and `castsFromFuel` so the estimating and spending paths run
the same code rather than two copies of it.

**This uncovered a second drift the audit did not name.** The stranded fallback
was `reachableSource`, which consults the tank — so it answered *Ocean* when
asked before the trip and *Sea* when asked after the fuel was burned. The
estimator and the settler disagreed by construction. New `shoreSource(state)`
returns the deepest water workable from the shore, ignoring fuel entirely, so
the answer does not depend on when you ask. This matches what `accumulate`
already did in practice; only the estimator changes behaviour.

Twelve tests, including a direct assertion that a prediction and a real spend
return identical splits.

### 6. Seven of eight tabs were unreachable by keyboard

`Tabs.svelte:24`. A roving `tabindex` with no arrow-key handler anywhere, and
nothing in the codebase navigating to `settings` — so Reduce Motion, Offline
Progress, notation and the save controls could not be reached from a keyboard
at all.

Arrow/Home/End handling added. `nextTabIndex(key, index, count)` lives in
`guide.ts`, not in the component, so it is testable without a DOM — eight tests
including "never returns an index outside the strip".

The handler is on the **buttons**, not the tablist. Putting it on the container
tripped `a11y_interactive_supports_focus`, and the buttons are where the ARIA
tab pattern wants it anyway.

### 7. Tab ids typed as a union

`TAB_IDS` / `TabId` in `guide.ts`, replacing bare strings written out
independently in `guide.ts`, `+page.svelte`, `StrandedBanner`, `Toasts` and
`NextStep`. Two tests: `TAB_IDS` and `TABS` describe the same set in the same
order, and every `nextStep` destination is a real tab across eight coin
magnitudes.

Per the audit's correction in its §5, source ids were **not** touched: they are
already the `FishingSources` enum, which is the union the finding asked for.

### One incidental fix

`castOnce`'s dex lookup moved from a `Set` to a plain record. Exporting the
`Game` class made `svelte/prefer-svelte-reactivity` see it and fail the lint
gate. It is a frozen lookup rather than reactive state, so a record is both
correct and clearer. Typing it `ReadonlySet` did not satisfy the rule; the
record does.

### Not done, deliberately

Per the brief: no directory refactor, and the six refuted findings in the
audit's §3 were not re-investigated. **I found nothing to disagree with in any
of the six refutations.** The remaining 17 confirmed defects are carried into
`Goals/PLAN.md` rather than fixed here.

### Gates

`pnpm check` 0 errors · `pnpm lint` clean · `pnpm build` ok · `pnpm test`
**296 passing** across 19 files, up from 260/17 · `pnpm audit:ui`
100/100/100/100 across 3 runs.

---

## Stage 1 — repository visibility and licensing

**Everything the brief assumed about this turned out to be checkable, and three
of its assumptions were wrong.** Facts first, decision second.

### What is actually true

**The repository is public.** An unauthenticated
`GET https://api.github.com/repos/HenrijsT/FishCrimental` returns **200**. (`gh`
is not installed on this machine, so this was the available method.)

**But almost nothing is published.** `origin/main` is **6 commits** of
prototype. `git ls-tree -r origin/main | grep -c src/lib/game` returns **0** —
there is no engine, no config, no save layer, no balance work, no `DECISIONS.md`
on the public branch. The 29 commits that constitute the actual game have never
been pushed, because R9 says never push. **The public repository contains a
fish-list prototype and a progress bar.**

**The design backlog is not exposed.** `ideas.txt`, `Goals/` and
`USER-REQUIREMENTS.md` are all in `.git/info/exclude` and are untracked. The
brief's concern that they "expose the entire design direction" is currently
false. `DECISIONS.md` *is* tracked, but is not on `main` — it would become
public the first time `feat/going-ham` is pushed. That is a decision to take
deliberately, not by accident.

**The owner is not quite the sole author — but is the sole copyright holder of
the current code.** `git shortlog -sne` shows a second contributor,
`Gogls <gustavs.degteris@gmail.com>`, with 2 commits: `ProgressBars.svelte`
plus edits to `functions_generic.ts` and a test route. All three files were
deleted in `d5e1eff` and `661869f`. A `git blame` sweep over all 88 tracked
files finds **0 surviving lines** attributable to them. So relicensing the
current tree is clean; the historical commits are not, and cannot be made so.

**The GPL was never actually applied.** `LICENSE` was the unmodified GPL-3.0
text from the very first commit (`b47f85a Initialize project base`), with the
copyright line still reading `Copyright (C) 2007 Free Software Foundation,
Inc.` and the how-to-apply template still containing literal `<year> <name of
author>`. `grep -rl "GNU General Public" src/` returns **nothing** — not one
source file carries a licence notice. `package.json` had no `license` field at
all.

**No dependency forces anything.** I scanned all **651** installed packages:
506 MIT, 52 Apache-2.0, 49 ISC, 19 BSD-2-Clause, 12 BSD-3-Clause, 4 MPL-2.0,
3 0BSD, 2 CC-BY-4.0, 1 each Python-2.0, CC0-1.0, BlueOak-1.0.0, BSD. **Zero
GPL, LGPL or AGPL anywhere in the tree.** The only reciprocal licences are
MPL-2.0 (`lightningcss` via Vite, `axe-core` via `@lhci/cli`), which is
file-level copyleft — it obliges publishing changes to those files and nothing
more. Neither is modified, and neither ships. **Exactly one third-party package
reaches the player: `break_eternity.js` 2.1.3, MIT**, which requires only that
its notice travel with distributions.

### What the GPL would actually mean, accurately

Checked against the FSF's own GPL FAQ rather than folklore.

- **Selling GPL software is explicitly permitted.** *"Yes, the GPL allows
  everyone to do this. The right to sell copies is part of the definition of
  free software."* There is no price cap. (`#DoesTheGPLAllowMoney`)
- **Distributing a binary obliges you to offer the Corresponding Source to
  every recipient**, and under GPLv3 §6(a)/(d) by equivalent access through the
  same place at no further charge. (`#DoesTheGPLAllowDownloadFee`)
- **A buyer may then redistribute freely, including for free.** The FSF is
  blunt: *"someone could pay your fee, and then put her copy on a web site for
  the general public."* (`#DoesTheGPLRequireAvailabilityToPublic`)
- **You cannot stop them.** *"You can't require people to pay you when they get
  a copy from someone else."*
- **Hosting is not distribution.** GPLv3 has no network-use clause, so serving
  the game as a web page triggers nothing. **Shipping a Tauri or Electron build
  on Steam is distribution and does trigger it.** That asymmetry is the whole
  practical point for this project.
- **A copyright holder may licence future versions differently, but cannot
  withdraw rights already granted.** *"the public already has the right to use
  the program under the GPL, and this right cannot be withdrawn."*
  (`#CanDeveloperThirdParty`)

The genre precedent is real and worth knowing: **Mindustry is GPL-3.0 and sells
for $9.99 on Steam**, while the same game is free on itch.io, F-Droid and as
automatic per-commit builds on GitHub. It works — but it works because the
developer chose to give it away too. A paid GPL release is a *convenience and
support* purchase, not an exclusive one. That is a legitimate business model.
It is a different one from what I1 describes.

### The decision

**Repository: stays public. Licence: changed from GPL-3.0 to a proprietary
source-available licence, all rights reserved.**

Reasoning:

1. **The Steam plan (I1) and GPL-3.0 are compatible only in the Mindustry
   sense** — sell it, and accept that any buyer may lawfully repost the build
   for free with the source attached. That is a real business model, but it is
   a choice, and nothing in `USER-REQUIREMENTS.md` says the owner has made it.
   Keeping GPL by default would make it for them, permanently.
2. **The asymmetry decides it.** You can always open-source later. You can
   never un-GPL what you already published. Given the choice is being made
   autonomously and cannot be checked with the owner, the reversible option is
   the correct one.
3. **The cost of going proprietary is close to zero here.** No dependency
   requires copyleft. No contributor's code survives. The GPL was never applied
   to a single source file, and everything of value was never pushed.
4. **Public still buys what the owner is actually getting from it** — a
   portfolio piece, a readable codebase, review and feedback. Source-available
   keeps all of that. Going private would trade it away to protect a design
   backlog that is already untracked.

Runner-up: **keep GPL-3.0, fill in the copyright line, and adopt the Mindustry
model deliberately.** It lost on point 2 alone. It is a perfectly good answer if
the owner wants it, and switching to it later is one commit — the reverse is
not.

Rejected: MIT/Apache (gives away more than GPL for a commercial plan);
AGPL (a network clause on a game with no server is pure friction);
private repo (loses the portfolio value, protects nothing not already
untracked); dual licensing and BUSL/PolyForm (real overhead, and dual
licensing only pays when there are third-party contributions to sell around —
there are none).

### What changed

- **`LICENSE`** — replaced. Proprietary, source-available: read, fork, build
  locally, quote with attribution; no distribution, hosting, sale or derivative
  works without permission. Real copyright line: `Copyright (c) 2026 Henrijs
  Treiguts`. Includes a contribution grant, so a future pull request does not
  create the exact fragmentation problem `Gogls` nearly created. Includes an
  explicit **note on earlier versions** stating that whatever the old GPL text
  granted for already-published commits is not withdrawn — because it cannot
  be.
- **`package.json`** — `"license": "SEE LICENSE IN LICENSE"` (the SPDX form for
  a non-standard licence), plus `author` and `description`. `"private": true`
  **stays**: it is correct for something never published to npm, and it is what
  prevents an accidental `npm publish`. The manifest and the licence file now
  agree, which they did not before.
- **`THIRD-PARTY-NOTICES.md`** — new. Reproduces the `break_eternity.js` MIT
  notice in full (the one thing genuinely required for a distributed build),
  lists the tooling licences, records the full 651-package scan, and flags that
  a Tauri/Electron wrapper adds dependencies not in this tree and needs the
  scan re-run before any Steam release.

### What warrants a lawyer, and what does not

**Not in dispute, and safe to act on:** that the GPL permits sale; that
distribution triggers the source obligation; that recipients may redistribute;
that a licence grant on already-published code cannot be retracted; that none
of the 651 dependencies imposes copyleft on this project; that `break_eternity`
requires attribution in a distributed build.

**Genuinely uncertain, and worth real advice before money changes hands:**
whether a bare `LICENSE` file with an unfilled copyright line and no per-file
notices constituted an effective GPL grant at all; what exactly that grant
covers given the only published commits are a prototype containing none of the
current code; whether the two removed contributions from `Gogls` leave any
residual claim; and the Steam Distribution Agreement's own terms, which I did
not obtain. **I am not a lawyer and this is not legal advice.** The practical
exposure is small — the published prototype has no game in it — but "small" is
a judgement, not a legal opinion.

