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

Brief: `design/promt_goals/THIRD_GOAL.md`. Inputs: `design/archive/AUDIT.md` (an independent 13-agent
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

`state.svelte.ts:287`, critical. `sellHold` ran _inside_ the chunk loop; the
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

Fixed by zeroing the hold _before_ the loop instead of restoring it after. That
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
asserting _"The game saves to this browser every 10 seconds."_

New `write-failed` problem kind, raised on refusal and cleared when a write
succeeds again. Deliberately non-blocking: a full quota should not also stop
the game trying.

### 4. Dismiss on the future/corrupt banner destroyed the save it protected

`state.svelte.ts:238`. Dismissing cleared the flag with no other effect, and
the 10-second autosave was still armed — so ten seconds later the fresh game
overwrote the preserved save. The banner's own advice, _export it and start
fresh_, was impossible: `exportBlob()` serialised the brand-new game.

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
was `reachableSource`, which consults the tank — so it answered _Ocean_ when
asked before the trip and _Sea_ when asked after the fuel was burned. The
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
`design/PLAN.md` rather than fixed here.

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

**The design backlog is not exposed.** `ideas.txt`, `design/` and
`USER-REQUIREMENTS.md` are all in `.git/info/exclude` and are untracked. The
brief's concern that they "expose the entire design direction" is currently
false. `DECISIONS.md` _is_ tracked, but is not on `main` — it would become
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

- **Selling GPL software is explicitly permitted.** _"Yes, the GPL allows
  everyone to do this. The right to sell copies is part of the definition of
  free software."_ There is no price cap. (`#DoesTheGPLAllowMoney`)
- **Distributing a binary obliges you to offer the Corresponding Source to
  every recipient**, and under GPLv3 §6(a)/(d) by equivalent access through the
  same place at no further charge. (`#DoesTheGPLAllowDownloadFee`)
- **A buyer may then redistribute freely, including for free.** The FSF is
  blunt: _"someone could pay your fee, and then put her copy on a web site for
  the general public."_ (`#DoesTheGPLRequireAvailabilityToPublic`)
- **You cannot stop them.** _"You can't require people to pay you when they get
  a copy from someone else."_
- **Hosting is not distribution.** GPLv3 has no network-use clause, so serving
  the game as a web page triggers nothing. **Shipping a Tauri or Electron build
  on Steam is distribution and does trigger it.** That asymmetry is the whole
  practical point for this project.
- **A copyright holder may licence future versions differently, but cannot
  withdraw rights already granted.** _"the public already has the right to use
  the program under the GPL, and this right cannot be withdrawn."_
  (`#CanDeveloperThirdParty`)

The genre precedent is real and worth knowing: **Mindustry is GPL-3.0 and sells
for $9.99 on Steam**, while the same game is free on itch.io, F-Droid and as
automatic per-commit builds on GitHub. It works — but it works because the
developer chose to give it away too. A paid GPL release is a _convenience and
support_ purchase, not an exclusive one. That is a legitimate business model.
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

---

## Stage 3 — the auto-fisher

`AUTO_FISHER` in `config.ts`, the "Clockwork Rig". An upgrade that holds the rod
for the player, distinct from a deckhand: a deckhand works one source on their
own, the rig works whichever water the player is pointing at, exactly as their
own hand would.

### The starting speed: 0.20 of a human, i.e. 5x slower

The brief asked for a figure between 2x and 10x slower and for it to be
justified against the existing pacing rather than picked round. The anchor is
`DECKHAND_BASE_EFFICIENCY = 0.42` — a deckhand already casts at 42% of a human.

- **At 0.42 or faster, the rig strictly dominates the crew track.** It would
  out-cast a deckhand _and_ need no per-source purchase, so nobody would ever
  hire anyone. That rules out anything faster than about 2.4x slower, which
  eliminates most of the band the brief offered.
- **Below roughly 0.15 nobody buys it.** Its first level would land less than
  a third of a deckhand for several times the price, at a moment when the
  cheapest-thing-on-the-board strategy the game itself recommends would never
  choose it.
- **0.20 is just under half a deckhand.** A real alternative at the moment it
  unlocks, never the obvious one.

### The ladder reaches exactly 1.00, by construction

`autoFisherFraction(level) = AUTO_FISHER_START ^ (1 - (level - 1) / (maxLevel - 1))`

Level 1 is `0.20 ^ 1` and level 12 is `0.20 ^ 0`, which is **exactly** 1 —
`Math.pow(x, 0)` has no floating-point slack. "Matches a human exactly, never
more" is therefore a property of the formula, not of the tuning, and a test
asserts `toBe(1)` rather than `toBeCloseTo(1)`.

Measured ladder: `0.200 0.232 0.268 0.310 0.359 0.416 0.481 0.557 0.645 0.746
0.864 1.000`.

### It stands down while you hold the rod

The one design decision the brief did not specify. A rig that ran _alongside_ a
held rod would give a maxed player 2x human speed, which breaks "it does not
out-perform playing" even though each half obeys the rule.

So `accumulate` takes an `autoFisherShare` from 0 to 1 — the fraction of the
interval the rig was working. `tick()` passes `this.casting ? 0 : 1`,
`#settleOffline` passes `state.autoFisherOffline ? 1 : 0`, and `simulateRun`
passes `1 - manualUptime`. One number covers the live game, the offline settle
and the simulation.

The consequence is the intended one: below max, holding the rod yourself is
strictly better, because you are faster. At max it makes no difference, because
you are the same speed. The rig removes the _obligation_ to hold the button
without ever removing the option.

### Parity, and its own bank

R14 required that the rig not pay differently from a hand at the same rate.
It routes through the same `routeCasts` and the same `distributeCatch` as a
manual cast — including the boat gate, so a rig pointed at an unfuelled Ocean
falls back inshore exactly as a hand cast does, and it is refused on unlicensed
water for the same reason `accumulate` refuses the crew. A test runs a hand at
the human rate against a maxed rig for an hour and asserts the two land within
0.1%.

It banks under its own key, `autofisher#casts`, per the brief. Sharing the
crew's key would pool two producers running at different rates into one bank.

### The offline purchase

`AUTO_FISHER_OFFLINE_COST = 5e11`, one purchase, no levels, and it requires a
rig to exist first. Priced deliberately above the Ocean unlock (1.64e11) so
that in the run where it first becomes reachable it is a genuine choice against
opening the last source rather than a box ticked on the way past.

Both the level and the offline fitting are coin purchases, so a prestige takes
them, like every other coin purchase. Carrying either through prestige belongs
in the Pearl tree, and is noted in `design/PLAN.md` rather than smuggled in
here.

### What it did to the pacing

Re-measured through `simulateRun` with the rig integrated into
`cheapestPurchase`, so the greedy reference player buys it whenever it is the
cheapest thing on the board.

|                             | before     | with the rig            |
| --------------------------- | ---------- | ----------------------- |
| First prestige, 100% uptime | 2h 25m 44s | **2h 28m 13s** (+1.7%)  |
| First prestige, 50% uptime  | 3h 30m 39s | **2h 43m 03s** (-22.5%) |

**No retune was needed**, and the shape of the change is the point. The
attentive player is 1.7% _slower_, because the greedy simulation spends coins
on a rig that — at 100% uptime — never runs. That is a real and acceptable
cost. The half-attention player gains 47 minutes, because the rig covers the
half of the time they are not holding the rod.

So the rig does not inflate the ceiling; it raises the floor. The gap between
playing attentively and playing casually narrows from 45 minutes to 15, and the
attentive player still finishes first. Source unlocks moved by under a minute
each at full uptime (Stream 5m59s, River 14m41s, Lake 21m40s, Lagoon 30m17s,
Sea 40m37s, Offshore 54m26s, Ocean 73m35s); the idle crossover is unchanged at
10m59s.

### Save format

`SAVE_VERSION` 3 -> 4, with `MIGRATIONS[3]`. The change is purely additive, so a
v3 save would have loaded correctly on the field defaults alone; the step exists
so the version is stamped explicitly rather than by `fromRaw`'s fallback.
`autoFisherOffline` is read as `false` unless a rig also exists, so a
hand-edited save cannot buy the night shift without the machine.

Note that this bump is only safe _because_ Stage 0 fixed the Dismiss-destroys-
the-save defect: a player who loads this build and then reverts now hits a
banner that backs their save up instead of eating it.

### Tests

25 new, in `autofisher.test.ts`: the ladder's endpoints and monotonicity, the
2x-10x band, human-rate parity at all eight sources, the cost curve sitting
inside the gear tracks' 3.58-4.63 band, the purchase guards, R14 parity, linear
scaling in the share, its own carry key, never a fractional fish, one-step
versus many-step agreement, the licence refusal, and the inshore fallback.

One of those tests compares casts and fish rather than coin value between one
big step and many small ones. That is deliberate and the reason is written into
the test: a 3600-second step is one bulk draw split by expected share, while
3600 one-second steps are rolled individually, and the constant RNG the test
uses makes every individual roll pick the same species. The divergence is a
property of the test's RNG, not of the rig; casts and fish are what the
remainder bank actually guarantees, and those match to within one cast.

### Gates

`pnpm check` 0 errors · `pnpm lint` clean · `pnpm build` ok · `pnpm test`
**321 passing** across 20 files · `pnpm audit:ui` 100/100/100/100 across 3 runs.

---

## Stage 4 — SvelteKit 3

**Verdict: green, and deliberately not merged.** Branch `chore/sveltekit-3`,
commit `e362b8f`, left in place.

I evaluated it by doing it rather than by reading about it, because the report
I had said the trial was cheap and fully reversible — and that turned out to be
true.

### Everything checked, not assumed

|                            |                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `@sveltejs/kit`            | latest **2.70.3**, next **3.0.0-next.25**                                                    |
| `@sveltejs/adapter-static` | latest **3.0.10**, next **4.0.0-next.4**, peer `^3.0.0-next.0`                               |
| `kit@next` engines         | `node >=22.17`                                                                               |
| `kit@next` peers           | `vite ^8.0.12`, `svelte ^5.56.4`, `typescript ^6.0.0`, `@sveltejs/vite-plugin-svelte ^7.0.0` |
| installed here             | node 26.7.0, vite 8.2.2, svelte 5.56.10, ts 6.0.3, vps 7.3.0                                 |

**There is no dependency wall.** Every peer requirement was already satisfied
before the upgrade. That is the surprising finding, and it is the reason the
trial was worth running rather than reasoning about.

A trap worth recording: for `@sveltejs/vite-plugin-svelte` and
`eslint-plugin-svelte` the `next` dist-tag points at an **older** version than
`latest` (7.0.0-next.1 vs 7.3.0; 3.0.0-next.18 vs 3.23.0). Installing either
with `@next` would silently downgrade. Neither needs touching.

### The trial

`npx sv@next migrate sveltekit-3 --tasks all --confirm` ran clean. 64 files
changed: `svelte.config.js` deleted and folded into the `sveltekit()` call in
`vite.config.ts`, `tsconfig.json` re-pointed at `$app/tsconfig`, and the bulk of
it `$lib` -> `#lib` Node subpath imports with explicit extensions.

All five gates pass on the result:

```
pnpm check     0 errors, 398 files
pnpm test      321 passing, 20 files
pnpm lint      clean
pnpm build     ok — 15,486 bytes of real prerendered HTML, not an empty shell
pnpm audit:ui  100 / 100 / 100 / 100 across 3 runs
```

The codemod even handled `'$lib/game/state.svelte'` -> `'#lib/game/state.svelte.js'`
correctly, which was the case I expected to break.

### Two things I had to fix on top of the codemod

- **It wrote floating dist-tags.** `"@sveltejs/kit": "next"` and
  `"@sveltejs/adapter-static": "next"` are not version ranges — every
  `pnpm install` would pull whatever `next` pointed at that day. Pinned to
  `^3.0.0-next.25` and `^4.0.0-next.4`, which still adopt stable 3.0.0/4.0.0
  automatically when they land. **This is a real defect in the codemod's
  output and anyone repeating this should check for it.**
- **`MIGRATION_TASKS.md` listed one task**, dev-server CORS for static assets.
  Inapplicable — there is no `fetch()` anywhere in `src/` and `static/` holds a
  favicon. Deleted, per the file's own instructions.

One non-fatal wrinkle: `adapter-static@4.0.0-next.4` still reads the removed
`builder.config.kit`, so `pnpm build` prints a deprecation warning. Kit next.25
ships a compatibility getter, so it warns rather than breaks. It will go when
the adapter is re-cut for stable.

### Why green is not the same as merge

The brief said to merge only if genuinely green. It is genuinely green. It is
still the wrong thing to merge today, for three reasons:

1. **The upgrade buys nothing measurable.** The entire SvelteKit surface this
   project uses is three build-time imports — `sveltekit` from
   `@sveltejs/kit/vite`, `adapterStatic`, and `vitePreprocess` — plus a
   two-line `+layout.ts`. Zero runtime APIs: no `$app/*`, no `$env/*`, no
   `goto`, no hooks, no `+server.ts`, no service worker. Remote functions,
   tracing and the error-boundary work are all irrelevant to a client-only
   static single-route game. The one thing 3.x is genuinely faster at —
   Vite 8 and rolldown — **this project already has on Kit 2.70.3.**
2. **The diff is 64 files of blame churn for zero functional change**, landing
   immediately before the large roadmap Stage 2 produces. Every planned
   feature would then be written against a pre-release API during the exact
   window it might still shift.
3. **A pre-release has no advisory coverage.** `pnpm audit` and GitHub
   advisories key on released ranges; a `3.0.0-next.N` pin can fall in a gap,
   and I found no published security-backport policy for the 2.x line either
   way.

Against all that: waiting costs **nothing**, because this commit proves the
migration is one codemod away. The branch is kept green and pinned so it is a
one-command merge whenever the owner wants it — and if they disagree with this
call, acting on that disagreement is `git merge chore/sveltekit-3`.

**Revisit trigger:** `pnpm view @sveltejs/kit dist-tags` shows `latest: 3.0.0`.
Expect the migration at stable to be identical or easier, with a re-cut adapter
that drops the deprecation warning.

### Two environment notes, because they cost time

- `npx sv` left `~/.local/bin/pnpm` (8.15.9) shadowing `/usr/bin/pnpm` (9.4.0)
  on `PATH`, and 8.x cannot read a `lockfileVersion: '9.0'` lockfile. If
  `pnpm install` starts refusing the lockfile, check `pnpm --version` before
  anything else.
- A research subagent fetched a 132 KB TV Tropes page to `tv.html` in the repo
  root, which broke `pnpm lint`. Moved out, not committed. Worth watching for
  when agents have web access and a working directory.

---

## Stage 2 — the main deliverable: research and plan

`design/RESEARCH.md` (560 lines) and `design/PLAN.md` (694 lines). **Documents
only — nothing from this stage was implemented.**

**Note on committing:** `design/` is in `.git/info/exclude`, so both files are
deliberately untracked, like every other brief in that directory. The brief
forbids editing the exclude file, and force-adding them would defeat the same
intention, so they live on disk and this section is the tracked record that
they exist. This is also why the Stage 1 finding matters — the design backlog
is not exposed on the remote, and `DECISIONS.md` is the only working doc that
would be.

### How it was researched

Seven independent research lines run as a workflow, each with web access, each
then attacked by a **separate adversarial verifier** told to refute the
findings and personally re-fetch every URL. In parallel, two agents costed every
idea in `ideas.txt` against the actual codebase with `file:line` citations.

**The adversarial half earned its place.** On the line whose verification
completed first, the tally was **9 CONFIRMED, 6 UNSUPPORTED, 3
RECLASSIFY-AS-JUDGEMENT, 3 FALSE** — including a quotation presented in quote
marks that **does not exist in the cited article and inverts what the article
actually says**. Every claim in `RESEARCH.md` is therefore tagged `[cited]`,
`[verified]`, `[disputed]`, `[inferred]` or `[judgement]`, the killed claims are
recorded so nobody re-derives them, and every place the research wanted a number
and could not source one is listed as a gap rather than filled in.

A note on cost: the first workflow run lost 7 of 9 agents to a session limit
mid-flight. Resuming replayed the two completed agents from cache and re-ran the
rest, which is the only reason the research survived.

### The three findings that reshaped the plan

**1. `pearlMultiplier` is applied twice, and the panel shows the unsquared
figure.** I verified this in the code rather than taking it from a report:
`engine.ts:278` gives `1 + 0.5 × pearls^0.9`, and `computeModifiers` multiplies
it into **both** `fishPerCast` (`:299`) and `sellMultiplier` (`:305`), so income
scales as its **square**. `PrestigePanel.svelte:49` renders the unsquared value.

This — not the cost curves, which were already retuned once — is the real reason
the prestige chain collapses from 2h25m to 4 seconds over six runs. It confirms
the audit's §4 note independently, and it means **any second reset layer built
on top of it would be untunable.** It is now the first item in the roadmap's
Phase A and an open question for the owner, because halving it is a pacing
decision rather than a bug fix.

**2. Nothing in the genre ships a random-timing deep reset.** Roughly ten search
angles; every candidate resolved to player-triggered, threshold-triggered or
failure-triggered. Recorded as an absence, not as a search failure. It does not
make the idea bad — it makes this game the experiment, and removes the "game X
does this and it works" safety net.

**3. "Paradigm shift" already means something else.** The genre's own vocabulary
(The Paper Pilot's guide, by the author of the Profectus engine) defines it as
_a phase of completely distinct gameplay that fully replaces the previous one_ —
Universal Paperclips, A Dark Room. Genre-literate players will expect the
fishing loop to be **replaced**, not multiplied.

### The verdicts, in short

**Changed:** the probabilistic paradigm shift becomes a **visible Tide meter
that arms a player-pressed button** — the owner's escalating curve kept exactly,
the agency kept too. The map is deferred until it has something to contain.
Shopkeepers need one of four properties or they are a reskin of the price gate
that already ships.

**Kept:** the bicycle and its selling cooldown (the cleanest fit in the file —
manual and automatic paths are already separated, so it touches nothing in the
engine); the bucket, with a **scheduled expiry** at the first deckhand; the
trader as auto-sell plus restock on a wall-clock deadline; the mud pool as a new
first source; repeat-catch species value; a read-only price board; one-time
story beats; and nested reset layers.

**Cut:** police fines, inverted instead into a value penalty on unlicensed water
— every fix that makes the fine safe removes the idea, and it contradicts the
project's own never-a-fail-state rule. Two thirds of "knowledge-based profit",
which already ships as `DEX_BONUS_PER_SPECIES`. A real fluctuating market, which
needs `state.hold` rebuilt from 6 type buckets to 47 species buckets behind an
information-destroying migration — a bigger job than the entire boat system was.

**Quantified rather than argued:**

- A **×100 price collapse per shift is undone by 13.13 levels of Market
  Contacts**, out of 80. Falling prices are either invisible or a wall, with
  almost no band between — unless the player holds the lever, which is the one
  condition under which the two shipped examples work.
- A hard bucket cap makes offline throughput **`chunks × capacity`** — 24 × 10 =
  240 fish for an eight-hour absence, whatever the crew. `OFFLINE_CHUNKS` was
  chosen to keep the standing fuel order funded and would silently become the
  game's offline income ceiling.
- A flat per-tick reset roll is **~1000× more punishing in run 1 than run 5**,
  given the 2h25m/1h03m/24m/57s/13s/4s ladder — backwards, because it hits
  hardest the players least invested.
- `save.ts:250` hardcodes `unlocked[FishingSources.Pond] = true`. Prepend a mud
  pool without changing it and **every reloading player is handed the Pond
  free, permanently.** The audit's blanket "do not insert anything before
  `SOURCE_ORDER[0]`" is over-stated — `reachableSource` is a bounded loop that
  terminates regardless — but this line is the real hazard it was pointing at.

### On the audit's refutations

The brief said not to re-investigate the six refuted findings and to say so with
a reproduction if I disagreed. **I found nothing to disagree with.** The
remaining 17 confirmed defects are carried into `design/PLAN.md` Part 2 with a
recommended order, grouped by what blocks other work.

### Stage 2 addendum — the verification finished, and it changed the documents

The Stage 2 section above was written while six of the seven verifiers were
still running. All fourteen agents have now finished. Final tally across
**155 findings judged**:

| Verdict                 | Count  | Share  |
| ----------------------- | ------ | ------ |
| CONFIRMED               | 91     | 59%    |
| UNSUPPORTED             | 31     | 20%    |
| RECLASSIFY AS JUDGEMENT | 19     | 12%    |
| **FALSE**               | **14** | **9%** |

Two of the fourteen were quotations in quote marks that do not exist in the
cited article. One verifier re-harvested a 5,186-review Steam corpus from
scratch and falsified four superlatives with counts. **And two were confident
claims about this codebase**, which I then checked in the source myself rather
than taking either side on trust:

- **"The tail of a run is a buy-one-more-upgrade versus bank-toward-the-
  threshold decision."** False. `lifetimeCoins` is only ever incremented
  (`engine.ts:981`) and never decremented on spend, and `pearlsFor` reads it
  directly — so spending cannot reduce Pearl yield and there is nothing to bank.
  I had repeated a softened version of this in `PLAN.md`; it is now corrected
  in place, with the honest narrower argument left standing (a random trigger
  destroys the ability to plan the _next_ purchase, which is a planning loss,
  not a banking one).
- **"The Fishdex is 56 free unwritten story beats."** False, and it was one of
  my own roadmap items. `description: string` is mandatory on the `Fish`
  interface, all 47 species carry one, `index.test.ts` asserts every one exceeds
  20 characters, and I measured them: **median 226, min 171, max 256**. The
  surfaces are full of neutral encyclopaedia copy. The task is _rewriting
  ~12,000 characters in voice_, which is a different and better-defined job.

A third correction reversed a conclusion outright. The claim that **"writing is
a net liability more often than an asset"** fails twice over: it was inferred
from a corpus of negative reviews only, where "net" cannot be established by
construction, and the single empirical study located (Hwang, UCSC 2025) reports
the **opposite** — participants marked "Storyline" negatively _because idle
games lack one_. What survives is that bad writing is resented.

Four superlatives were downgraded to measured shares: "spreadsheet" appears in
25 of 5,186 negative reviews (0.5%), not as the top readability complaint;
offline caps in 37 (0.7%); cloud sync is named in about a quarter of the 78
save-loss reviews rather than being the leading cause; and "automation ships at
human speed in every game examined" rests on three games.

**All of this is now corrected in `RESEARCH.md` and `PLAN.md`**, with the killed
claims recorded rather than deleted, so nobody re-derives them. None of the
corrections changed a keep/change/cut verdict. They changed how strongly several
of them can be argued, and they replaced one roadmap item with a more accurate
version of itself.

The lesson worth keeping: **the single most useful thing in this pass was the
instruction to verify adversarially rather than self-assess.** Nine per cent of
a careful agent's cited findings were false, and two of the falsehoods were
about code sitting on this disk.

---

## Closing summary

Five stages, all complete. Branch `feat/going-ham`, nothing pushed.

### What was fixed, and how it was reproduced

Stage 0, on `fix/audit`, merged with `--no-ff` as `d789326`. All six mandatory
defects, each **reproduced before being fixed**: 8 of 15 new lifecycle tests and
10 of 12 new routing tests failed against the original code, then passed.

The offline settle paid for the hold you already had and handed it back — three
resumes with a 1e6 hold took coins to 1e6, 2e6, 3e6 with the hold intact each
time, silently when there were no deckhands, and it minted Pearls out of the
inflated `lifetimeCoins`. The multi-tab guard muted the tab the player was
using, which refutes B9 from the second pass. A refused write was completely
silent. Dismiss destroyed the save it protected. The headline coins/s ignored
the boat gate — 5.03× overstatement measured here, and the audit's
deeper-deckhand claim reproduced to the digit at 22,339/s advertised against
5,958/s real. Seven of eight tabs were unreachable by keyboard.

**The new tests are the point.** `lifecycle.test.ts` is the first thing in the
repo to import `state.svelte.ts` — the layer the audit found held all 23
confirmed defects and zero tests. Coverage went 260 → **321** across 17 → 20
files.

Fixing #5 turned up a defect nobody had named: the stranded-cast fallback used
`reachableSource`, which consults the fuel tank, so estimating before a trip and
settling after gave two different answers for the same trip. `shoreSource` is
order-independent.

### Licensing and visibility

The repo **is** public — but `origin/main` is 6 prototype commits with **zero
files under `src/lib/game/`**. Everything of value has never been pushed.
`ideas.txt`, `design/` and `USER-REQUIREMENTS.md` are untracked, so the design
backlog is not exposed; `DECISIONS.md` is tracked and would go public on the
first push. There is a second contributor in the history with **0 surviving
lines**. All 651 installed packages were scanned: **no GPL, LGPL or AGPL
anywhere**, and exactly one third-party package ships to the player
(`break_eternity.js`, MIT).

**Changed GPL-3.0 → proprietary source-available, repo stays public.** The
deciding argument is asymmetry: you can open-source later, you can never un-GPL
what you published. GPL and a paid Steam release are compatible only in the
Mindustry sense — legal to sell, but any buyer may lawfully repost the build
with source attached — and nothing in the requirements says the owner chose
that. `package.json` and `LICENSE` now agree; `THIRD-PARTY-NOTICES.md` is new.

### What the research concluded, and what I would cut

Three findings reshaped the plan: **`pearlMultiplier` is applied twice** so
income scales as its square while the panel shows the unsquared figure — that,
not the cost curves, is why runs collapse to 4 seconds; **nothing in the genre
ships a random-timing deep reset**; and **"paradigm shift" already means a
phase of completely distinct gameplay**, so players will expect the loop
replaced, not multiplied.

**Cut:** police fines (inverted into a value penalty on unlicensed water —
every fix that makes the fine safe removes the idea, and it contradicts the
project's own never-a-fail-state rule); two thirds of "knowledge-based profit",
already shipped as `DEX_BONUS_PER_SPECIES`; a real fluctuating market, which
needs the hold rebuilt from 6 type buckets to 47 species buckets behind an
information-destroying migration.

**Changed:** the probabilistic trigger becomes a visible Tide meter arming a
player-pressed button — the owner's escalating curve kept exactly, the agency
kept too.

**The strongest ideas in the file** are the bicycle-and-cooldown (real economic
design, and it touches nothing in the engine because the manual and automatic
paths are already separate), the one-time story beats, and nested reset layers.
**The weakest** are the map (a reskin of `SourcePicker` until it has something
to contain) and shopkeeper gating (half of it already ships as
`LICENCES.requires`).

### The auto-fisher

**0.20 of human speed at level 1 — 5× slower.** Not a round number: the anchor
is `DECKHAND_BASE_EFFICIENCY = 0.42`. At 0.42 or faster the rig strictly
dominates the crew track, out-casting a deckhand while needing no per-source
purchase, so nobody would hire anyone. Below about 0.15 the game's own
cheapest-thing-first advice would never buy it. 0.20 is just under half a
deckhand.

Level 12 is `START^0` — **exactly** 1, by construction rather than by a
multiplier that lands near it, so the test asserts `toBe(1)`. It stands down
while the player holds the rod, so it can match a hand but never stack with one.

Pacing: **100% uptime 2h25m44s → 2h28m13s (+1.7%); 50% uptime 3h30m39s →
2h43m03s (−22.5%).** No retune needed. It raises the floor rather than the
ceiling: the gap between attentive and casual play narrows from 45 minutes to
15, and the attentive player still finishes first.

### SvelteKit 3

**Green on all five gates at 3.0.0-next.25, and deliberately not merged.** I ran
the migration rather than reasoning about it. There is no dependency wall —
every peer was already satisfied. The codemod left floating `next` dist-tags,
which I pinned, and one inapplicable migration task, which I deleted.

Not merged because the project imports three build-time SvelteKit symbols and
zero runtime APIs, so 3.x buys nothing measurable — the Vite 8 win it is famous
for is already in hand on Kit 2 — against a 64-file diff landing immediately
before the roadmap. Branch kept green and pinned so it is a one-command merge.
Revisit when `latest` is `3.0.0`.

### Compromises, with the real figures

- **No quality gate was relaxed.** `check` 0 errors, `lint` clean, `build` ok,
  `test` 321 passing, `audit:ui` 100/100/100/100 — on every commit that touched
  code.
- **One commit briefly failed lint.** The Stage 1 write-up was committed before
  prettier ran on `DECISIONS.md`; fixed forward in `91fb5c3` rather than by
  amending, because the rules forbid rewriting history.
- **`design/RESEARCH.md` and `design/PLAN.md` are not committed.** `design/` is in
  `.git/info/exclude` and the brief forbids editing it; force-adding would
  defeat the same intention. They exist on disk and this file is the tracked
  record.
- **The first research workflow lost 7 of 9 agents to a session limit
  mid-flight.** Resuming replayed the two survivors from cache and re-ran the
  rest — the only reason the research survived.
- **A research subagent wrote a 132 KB TV Tropes page into the repo root**,
  which broke `pnpm lint`. Moved to the scratchpad, not committed.
- **`npx sv` left pnpm 8.15.9 shadowing 9.4.0 on `PATH`**, and 8.x cannot read a
  `lockfileVersion: '9.0'` lockfile. If installs start refusing the lockfile,
  check `pnpm --version` first.

### Nothing was cut

All five stages were completed, including Stage 4, which the brief nominated as
the first thing to drop.

### What to read first

1. **`design/PLAN.md`, Part 4** — the five questions only the owner can answer.
   The first one, whether the pearl bonus keeps being squared, gates the whole
   second-layer roadmap and is a pacing decision rather than a bug fix.
2. **`design/PLAN.md`, Part 1 §1** — why the probabilistic paradigm shift becomes
   a meter. It is the biggest change to the owner's stated intent in this pass,
   and the reasoning is the part most worth disagreeing with.
3. **`design/RESEARCH.md`, the method section** — the 91/31/19/14 tally. It is
   the reason to trust the rest of that document, and the reason not to trust
   any single unverified research pass.
4. **`src/lib/game/lifecycle.test.ts`** — the first test in this repo that
   drives the `Game` class. The audit's central point was that every confirmed
   defect lived in the one layer with no tests; this is the start of closing
   that.
5. **The licensing section of this file**, if a Steam release is still the plan.

# FOURTH PASS

Brief: `design/promt_goals/FOURTH_GOAL.md`. Authority: `design/archive/ANSWERS.md` — the
owner's own decisions, which override `PLAN.md` wherever they disagree.

**The rule that governed the whole pass: build only what the owner has
answered.** `ANSWERS.md` is answered down to and including §4D, plus Q2 and Q5.
Everything after §4D — police fines, knowledge profit, the fish market, the
one-time beats, layer implementation, and the N1 minigame licences — was left
untouched. `ideas.txt` was treated as closed.

---

## Stage 0 — Foundations

Branch `fix/foundations`, merged `--no-ff` as `0d8b905`.

### One modal host

`OfflineModal`, `PrestigeModal` and `LipfishModal` were siblings in
`+page.svelte`, each rendering its own `Modal.svelte`, each mounting its own
`<svelte:window onkeydown>`. One Escape therefore closed every open dialog — and
the audit had reproduced the collision with a _natural_ save: a nine-hour gap
with a crew and no lipfish in the dex raises both at once, and the payment
report for eight hours of work went with the keystroke.

`game.activeModal` now picks exactly one, in a declared `MODAL_ORDER`, and
`ModalHost` renders only that. The rest queue behind it. **Offline is first**
because it is the only one carrying information the player cannot get back; the
two joke reveals persist until dismissed and can wait.

`Modal.svelte` gained the three things it had been claiming with `aria-modal`
and did not have:

- **A Tab focus trap.** The second Tab press previously reached a toast button
  painted _behind_ the backdrop — toasts sit at `z-index: 15`, the backdrop at 20.
- **Focus restore.** `activeElement` used to end up on `BODY`, dropping a
  keyboard user at the top of the page with no idea where they had been.
- **An inert background**, on both the shell and the toasts.

That closes audit debt 12 as well as the stacking defect. Six tests cover the
priority order, the queue, and the exact offline+lipfish collision.

### Contrast, measured rather than assumed

**Lighthouse cannot see this.** axe returns colour-contrast as _incomplete_
against the gradient backgrounds, so the 1.00 accessibility score is not
evidence either way. The ratios were computed directly, against the six real
composited backgrounds — including the `.75`-alpha panel gradient sitting over
the page's radial highlight, which is the worst case and the one a naive check
misses.

| Token                   | Worst ratio | Verdict                                        |
| ----------------------- | ----------- | ---------------------------------------------- |
| `--ink-faint` `#6d89a1` | **3.59:1**  | fails AA on 4 of 6 backgrounds                 |
| `--ink-faint` `#8aa4bb` | **5.07:1**  | passes everywhere                              |
| `--coral` `#f2695c`     | **4.35:1**  | fails — the "Wipe the save" button, as audited |
| `--coral` `#f57f73`     | **5.11:1**  | passes everywhere                              |

Both were changed. `--ink-faint` stops at `#8aa4bb` rather than going lighter
because `#9db4c8` is `--ink-dim`, and matching it would collapse two type tiers
into one.

### The pearl readout tells the truth

`pearlMultiplier` is applied to both `fishPerCast` (`engine.ts:299`) and
`sellMultiplier` (`:305`), so income moves by its **square**, while the panel
printed the single application. It now shows both — "N× twice" and the real
income effect — with a sentence explaining why.

**Display only.** Whether the squaring itself stays is Q1, and Q1 is answered
"show me both", which was Stage 3's job.

---

## Stage 1 — The opening act

Branch `feat/opening-act`, merged `--no-ff` as `df09754`. Four items, with
`simulateRun` re-run after each.

### The shape that emerged

The four items are not four features; they are one three-stage economy, and
that only became clear while building item 3. **Who buys your fish is now the
spine of the opening:**

1. **No transport.** There is no on-demand sale at all. The trader comes when he
   comes and pays `TRADER_RATE` (0.55). The bucket fills in between.
2. **A bicycle.** Ride to town for the full price, at the cost of
   `TOWN_TRIP_SECONDS` (75 s) off the water. The crew never stop.
3. **An Assistant.** Full price, no trip, no cooldown — and no bucket.

Buying your way out of that is the opening act. The instant Sell button that
used to exist is now the _third_ graduation rather than the starting state.

### 1. The bicycle and the town trip (§4C)

Reading (a) only: manual casting stops, deckhands do not. `accumulate` never
consults the cooldown.

- **The deadline is an absolute `Date.now()` timestamp in `GameState`**, not a
  countdown and not on `Game`. A hidden tab throttles timers to roughly once a
  minute and `#settleOffline` never calls `tick()`, so a counted-down trip would
  never end while the player was away; and on `Game` it would survive prestige
  the way `strandedFrom` already wrongly does.
- **Clamped on load.** `num()` only checks finiteness, so a hand-edited
  `fishingBlockedUntil` of `Date.now() + 1e15` would refuse manual casting
  forever. `clampDeadline` caps it at one trip and treats negatives as no trip.
- **`#frame` bails _and_ calls `endCast()`.** Guarding `beginCast` alone is not
  enough — the catch-up loop lands up to 25 casts per frame.

Pacing: 2h28m13s → **2h47m37s** (+13%).

### 2. The bucket and the Assistant (§4A)

The owner changed my proposal: retire the bucket at an Assistant, not at the
first deckhand.

**The cap is applied before `takeWhole`, never trimmed after it.** `takeWhole`
mutates `state.carry` — it banks the incoming fraction and returns the whole
part. Letting it run and discarding the result would spend the banked fraction
and lose the fish with no credit anywhere. `distributeCatch` clamps its _input_.
Two tests pin it: `state.carry` is byte-identical after a refused catch, and the
Fishdex gains no entries.

**The check is at the top of `accumulate`'s per-source loop**, before
`takeWhole(castCarryKey)` and before `runBoat` — otherwise casts, fuel and hull
condition are all spent on a fish there is nowhere to put. A test asserts all
three are untouched.

**The tuning had to be measured, and the first attempt was wrong.** Offline
throughput is `chunks × capacity`, so the bucket must outrun the crew or an
implementation detail becomes the offline income ceiling. At capacity ×2.6
against cost ×3.15, twenty Pond deckhands land 6,574 fish per chunk and the
level covering that cost **78,697 cumulative — three times the Assistant's
26,000**, so the player would always retire the bucket before ever upgrading it.
Doubling the crew returned **1.41×** the night instead of 2×.

Retuned to capacity **×3.4** against cost **×2.9**: level 5 holds 6,815 for
17,190 cumulative, inside the Assistant's price. Doubling the crew now returns
**>1.8×**, and the two purchases genuinely compete for the same coins.

Sixteen existing tests across seven files began failing — all long-run
accumulation on fresh states. They assert accumulation maths, not bucket
behaviour, so each now opts out the in-game way (`state.hasAssistant = true`)
with a comment saying so. Same pattern the licence gate used in the second pass.

Pacing: 2h47m37s → **2h52m49s** (+3%).

### 3. The trader (§4B)

Agreed as specified, and it is what makes items 1 and 2 mean anything.

- **`nextTraderAt` is an absolute deadline**, for the same reason as the trip.
- **`runTrader` walks the deadline forward** rather than sampling the clock, so
  a settle split into 24 chunks and one done in a single step resolve the _same_
  number of arrivals. There is a test that asserts exactly that.
- **`OfflineReport` gained `traderVisits` and `traderEarned`**, and the modal
  shows "N traders came past". Without it the coins figure is unreconcilable.
- **The standing fuel order still gets funded.** `OFFLINE_CHUNKS` exists so
  selling happens periodically offline; at a 45-second period there is at least
  one arrival in every chunk of any real length. With an Assistant the old
  once-per-chunk full-price sale is unchanged.

Stock rotates over a three-item catalogue, two at a time, indexed by visit
count — so an offer can be a visit or two away. **That is the one thing a vendor
adds over a price tag: a wait you cannot buy through**, bounded by the arrival
period rather than by luck. When two or fewer offers remain open they are all in
stock, so the opening can never stall waiting for the bicycle.

`TRADER_PERIOD_SECONDS` is **45**, not 90. At 90 a starting bucket filled in
about a fifth of the wait and the opening was mostly idling. The starting bucket
went 15 → 20 for the same reason, and later to 30.

Pacing: 2h52m49s → **3h08m32s** (+9%).

### 4. The mud pool (§4D)

**The four literals are gone, and `save.ts` was the one that mattered:**

| Site                          | Was                          | Now                         |
| ----------------------------- | ---------------------------- | --------------------------- |
| `engine.ts` `shoreSource`     | `return FishingSources.Pond` | `SOURCE_ORDER[0]`           |
| `engine.ts` `reachableSource` | `return FishingSources.Pond` | `SOURCE_ORDER[0]`           |
| **`save.ts` `readUnlocked`**  | **`unlocked[Pond] = true`**  | `unlocked[SOURCE_ORDER[0]]` |
| `save.ts` `activeSource`      | `: FishingSources.Pond`      | `: SOURCE_ORDER[0]`         |

Left as it was, `readUnlocked` would have handed **every reloading player the
Pond for free, permanently**, bypassing an unlock cost that now exists. Silent
and economy-breaking. Both call sites carry a comment saying why the literal
must never come back. `guide.ts`'s two `deckhandCost(Pond, 0)` calls — meaning
"the cheapest hire there is" — became `SOURCE_ORDER[0]` for the same reason.

Stocked with five existing Small species, the muddy ones: Guppy, Platy,
Corydoras Catfish, Kuhli Loach, Rosy Barb. Five clears the ≥4 floor that stops
`buildCatchTable` producing `totalWeight = 0`, whose `RandomIndex.pick()` throws
from inside a `setInterval` on the first cast; and five of fifteen Small species
keeps the "never lists every species of a category" invariant. **No new
species**, so the Fishdex count and its bonus are untouched.

`valueMultiplier` is **0.25 and not 0.3 on purpose**. `holdValue` accumulates
per catch while the hold is priced in one multiplication, and 0.3 is not
representable in binary: 300 casts drifted to 179.999999999999 against 180. A
quarter is exact, and a cleaner design number anyway.

**The prologue needed tuning.** At the first attempt it ran 20m16s before the
Pond, which is too long to spend in a puddle. The binding constraint was the
bucket against the trader's period, not the price: 20 fish per 45 seconds is
0.12 coins/s whatever the rod does. Starting bucket 20 → 30 and Pond 120 → 75
brings the Pond to **8m16s**, which is a prologue rather than a chapter.

Forty-one tests failed on the first run, almost all using `Pond` to mean "the
source you start in". Those now say `SOURCE_ORDER[0]`, which is what they meant.
The handful that genuinely meant the Pond name it explicitly and say why.

Pacing: 3h08m32s → **3h25m12s**.

### What the opening act cost, and why that is acceptable

| After    | Full uptime  | Half uptime  |
| -------- | ------------ | ------------ |
| baseline | 2h28m13s     | 2h43m03s     |
| bicycle  | 2h47m37s     | 3h02m50s     |
| bucket   | 2h52m49s     | 3h11m01s     |
| trader   | 3h08m32s     | 3h20m58s     |
| mud pool | **3h25m12s** | **3h40m12s** |

**+38% on the first prestige.** That is a deliberate consequence, not drift: the
opening is _supposed_ to be poor, and everything before the Assistant now sells
at 55% of face value. Once the Assistant is bought the game is back at full
rate, so the change is confined to the opening.

It is also comfortably inside the genre. `RESEARCH.md` records the nearest
comparables at **8 h (Cookie Clicker) to ~28 h (Antimatter Dimensions) for a
first reset, both cited as quit-reasons for being too long**, and 2h25m as
already at the short end. 3h25m sits between, with four distinct chapters in it
rather than one.

`balance.test.ts`'s prestige chain needed its session cap raised from 3 h to
4 h: the first run no longer fits in three hours, so the chain reported a single
unfinished run. That is a harness budget, not a balance figure, and the comment
in the file says so.

Sources at full uptime: Mud Pool 0m, Pond 8m16s, Stream 20m16s, River 49m31s,
Lake 1h09m, Lagoon 1h19m, Sea 1h30m, Offshore 1h46m, Ocean 2h06m.

---

## Stage 2 — The map and the shopkeeper chain

Branch `feat/map`, merged `--no-ff` as `1d383bc`.

### The shopkeeper chain

`SHOPKEEPER_REACH` is **one array** indexed by position in `SOURCE_ORDER` — the
fraction of a track the shopkeeper in that place will sell. One array rather
than a per-track table so the ladder cannot drift between tracks, and so adding
a source cannot silently leave a track ungated.

| Place    | rod | net | lure | market | crew |
| -------- | --: | --: | ---: | -----: | ---: |
| Mud Pool |   5 |   6 |    3 |      6 |    4 |
| Pond     |  11 |  12 |    7 |     12 |    9 |
| Stream   |  18 |  20 |   11 |     20 |   15 |
| River    |  28 |  32 |   18 |     32 |   24 |
| Ocean    |  70 |  80 |   45 |     80 |   60 |

**The guard is in the engine, not the component.** `buyUpgrade` and
`buyBoatUpgrade` clamp to the ceiling, and `affordableUpgradeLevels` takes it as
a parameter — without that the max button goes on offering "buy 14" for
something the purchase then refuses.

**`cheapestPurchase` compares against the ceiling**, not `maxLevel`. Against
`maxLevel` it would pick a gated track as cheapest every step, buy nothing, and
stall the whole reference strategy _silently_, because `buyUpgrade` returns 0
rather than throwing.

**Fuel and repairs are never gated**, and there is a test named for it.
`runBoat` buys fuel out of coins inside the offline settle.

**An honest measurement: the gate does not move the pacing at all.** The first
prestige is 3h25m12s with and without it, to the second. Price already gates
harder than shopkeepers do — rod level 5 costs 4,776 cumulative, which is forty
thousand seconds of mud-pool income, so the money runs out long before the
shopkeeper does. I tightened the early end from 0.14 to 0.08 to check this was
not a tuning artefact; the figure did not move.

That is the right shape rather than a disappointment, and two tests pin both
halves: **the gate is invisible to a player who keeps moving, and binds hard on
one who camps in shallow water** trying to max a track before leaving. It shapes
without punishing. What it adds for everyone is legibility — the panel shows
"lv 3 / 5" and names the place that stocks the next tier.

### The map

The owner overruled me here and was right to. **A correction I owed them:**
`SourcePicker.svelte:29` already renders only `{#if open || isNext}`, so the
concealment half of the request was already shipped — the player already saw
what they owned plus exactly one thing beyond. What the map adds is **place**:
spatial memory, a home, a world instead of a list.

**Decision on whether it replaces `SourcePicker`: it does not.** The chart sits
above the list and they do different jobs. The chart is the navigation and gives
the water a shape; the list carries the blocker reasons, cast times and average
values an SVG cannot say well, and it guarantees every source stays reachable by
keyboard and by screen reader. An SVG-only map would have been a step backwards
on both counts.

**The inaccuracy hook is in, and it lies about position only:**

- Every `SceneConfig` gained a true `at: {x, y}`. The chart draws each place
  displaced by `mapOffset()`, shrinking to exactly zero at the top level.
- **The displacement is derived from a hash of `startedAt`** and the place's
  name. `startedAt` survives prestige, so a chart is wrong in the _same_ way
  every time you look at it rather than reshuffling on every render. **A map you
  cannot learn is not a map.**
- **The paper runs out.** Locked places beyond `mapSight()` are not drawn at
  all, and the edge is marked with a `?`. A better chart moves the edge outward,
  so somewhere further along becomes a rumour before it becomes a purchase —
  which is the owner's _"only when they purchase a better map do they learn
  there are more things"_.
- **It never hides a place already unlocked**, and there is a test named for it.
- **It never lies about worth.** No `perceivedCatchTable`, no shadow economy, no
  permanent "which table am I reading" hazard.

Lighthouse after Stage 2: **100 / 100 / 100 / 100**.

---

## Stage 3 — Three documents

Implemented nothing, as required. All three are on disk under `design/`, which is
locally excluded, so they are untracked by design — this section is the tracked
record that they exist.

### `design/archive/PEARL-SIMULATION.md` — answering Q1

Both ladders run ten runs deep on the same seed, the un-squared one produced by
a runtime toggle in a throwaway worktree that was then discarded. **The balance
was not changed.**

The finding that matters is not the recommendation, it is this: **runs 1–3 are
bit-for-bit identical either way.** Run 1 starts with zero pearls and squaring 1
is 1, and through run 3 `spendPearls` converts the pile into shop levels before
it can matter — `pearlMultiplier` reads _unspent_ pearls. **The squaring is dead
weight for the first four hours of the game.**

It only differs from run 4 (58 s vs 2m28s), delays the first sub-ten-second run
by exactly **one run**, and buys **1m50s across the first six prestiges**.

Recommendation: un-square it, on `sellMultiplier` rather than `fishPerCast`
since pacing is indifferent (≤1 s across ten runs) and `fishPerCast` also feeds
the hold, `totalFish` and Fishdex discovery. **And do not book it as a fix for
the collapse** — the numbers forbid that claim.

The report also found the shop is never a budget under either ladder: it goes
from unaffordable to overshot by millions inside a single cash-in, because
`spendPearls` leaves 99.997% of the pile in `state.pearls` where
`pearlMultiplier` reads it.

### `design/archive/VOICE-SAMPLE.md` — answering Q3

Three rewrites — Guppy (24 baseChance, the first fish anyone lands), Redtail
Catfish (mid), Whale Shark (rarest at 1) — current and rewritten side by side,
inside the existing 171–256 character band. All three current descriptions were
read from the source and quoted verbatim; the `baseChance` / `category` /
`sources` values were verified.

All 47 are costed (~10,400 characters, copy only, no code path, no test change),
with one honest paragraph on the risk: **the failure mode is sameness, not
offence.** Nothing was rewritten.

### `design/SHIFTS-SPEC.md` — the structure

The arithmetic was computed twice, independently, and agrees to the digit.

**The structural insight the whole spec turns on:** if a shift fires the instant
lifetime crosses a _fixed_ threshold, then `award = pearlsFor(threshold)` is a
function of the shift index alone. **Overshoot cannot inflate it** — a faster
player gets the shift sooner, not bigger. Today's design has the opposite
property, which is why the shop is overshot by millions in one direction and
why resetting on sight pays exactly 1 pearl forever in the other. Both failure
modes have the same cause: the player picks the moment the award is measured.

**The ladder: 96 shifts, 32 per tier, thresholds a quarter-decade apart.**
Cumulative award **43,957,984,998 = 1.362 × the 32,267,256,758-pearl shop** —
enough to buy it with 36% headroom rather than six orders of magnitude of it.
Each tier buys almost exactly a third of the shop's 90 levels (30 / 62 / 90)
without that having been tuned for.

The single-event jump shrinks from **43 million times the shop to five times**,
and no shift ever hands over more than 29% of it — so there is a real
bank-or-spend decision on every shift, where today there is not one.

**Why a quarter-decade is not an arbitrary number:** measured run lengths sit
between 108 s and 152 s for **82 consecutive shifts**, drifting down 0.29% per
shift. 0.25 decades is almost exactly the break-even step under the current
pearl economy — coarser and runs lengthen, finer and they collapse. It is a
measured equilibrium.

**Three findings in the spec that were measured rather than reasoned:**

1. **A tier boundary cannot wipe Pearls.** A player finishing Storm holds 8,357
   pearls, worth ×1,695 un-squared and ×2.87e6 squared; a restarted ladder needs
   _the entire next tier_ just to get back to level. So tiers keep Pearls and are
   depth, not currency resets. This is also an independent argument for
   un-squaring that `PEARL-SIMULATION.md` did not make — squaring exactly doubles
   the shifts needed to recover from any wipe.
2. **Granting the bicycle before the Assistant is worse than granting nothing.**
   Measured: 9h43m to shift 16 against 9h11m with no milestones at all. A bicycle
   without an Assistant parks the player in town 75 seconds out of every 76.
3. **A "start with sources open" milestone cannot be a post-hoc patch.** Writing
   `state.unlocked[src] = true` after the reset made shifts 6–10 blow a four-hour
   budget — `createInitialState` derives `activeSource` from `unlocked` _before_
   any later patch, so the player is left pointing at the mud pool with eight
   sources open. It must flow through `CarryOver`, the way `pearl_headstart`
   already does.

**And the offline trace, which is the nastiest case in the feature.** A
threshold shift can fire inside `#settleOffline`, which a player-initiated
prestige never could. Traced against a real mid-game save: the report's coins
figure comes out at **−99,999,829,151,271.86** because it computes
`state.coins.minus(coinsBefore)` after the reset has zeroed coins; the hold is
**duplicated across the reset** because `#settleOffline` restores its snapshot
onto the fresh state; 23 of 24 chunks are dead; **586 phantom trader visits**
fire because `chunkEnd` is computed from a `lastUpdate` the reset just moved
forward; and the trader ends up **eight hours away** while the reset has removed
the only other buyer, leaving the run unplayable from the moment the tab opens.
Seven distinct failures, all mechanical, with a seven-item fix list.

---

## Closing summary

Four stages, all complete. Nothing pushed. `feat/going-ham` is at `d798632`
plus the merges below; `fix/foundations`, `feat/opening-act` and `feat/map` are
all kept.

### What shipped

**Stage 0 — foundations.** One modal host with a focus trap, focus restore and
an inert background, replacing three siblings that shared one Escape key.
Contrast measured directly rather than trusted to a Lighthouse score that
cannot see it: `--ink-faint` 3.59:1 → 5.07:1, `--coral` 4.35:1 → 5.11:1. The
pearl readout stopped understating its own effect.

**Stage 1 — the opening act.** Four items that turned out to be one economy:
who buys your fish. A trader who comes when he comes and pays 55%; a bicycle
that buys you the full price for 75 seconds off the water; an Assistant who
removes the trip, the cooldown and the bucket. A mud pool underneath all of it.

**Stage 2 — the map and the shopkeepers.** Upgrade tiers gated by place, and a
literal chart that is wrong on purpose in a way you can learn.

**Stage 3 — three documents**, implementing nothing.

### Every number that moved

|                           | Full uptime              | Half uptime  |
| ------------------------- | ------------------------ | ------------ |
| Before                    | 2h28m13s                 | 2h43m03s     |
| After the bicycle         | 2h47m37s                 | 3h02m50s     |
| After the bucket          | 2h52m49s                 | 3h11m01s     |
| After the trader          | 3h08m32s                 | 3h20m58s     |
| After the mud pool        | **3h25m12s**             | **3h40m12s** |
| After the shopkeeper gate | **3h25m12s** (unchanged) | —            |

Tests **327 → 406**. Lighthouse 100/100/100/100 after Stage 0 and Stage 2.

### Judgement calls, with reasons

- **The instant Sell button was removed before the bicycle.** Without that the
  trader adds nothing and the bucket has no consequence. It is the third
  graduation now, not the starting state. This was not in the brief; it is what
  the four items required to mean anything together.
- **`TRADER_PERIOD_SECONDS` 90 → 45** and the starting bucket 15 → 20 → 30, both
  because the first tuning left the opening mostly idling.
- **The mud pool's `valueMultiplier` is 0.25, not 0.3**, because 0.3 is not
  representable in binary and 300 accumulated catches drifted to
  179.999999999999 against a single multiplication's 180.
- **The map sits above `SourcePicker` rather than replacing it.** The chart is
  navigation; the list carries blocker reasons and keyboard access.
- **Sixteen existing tests opt out of the bucket** with `hasAssistant = true`
  rather than being loosened. They assert accumulation maths, and an Assistant is
  the in-game way to say the hold is unlimited.
- **`balance.test.ts`'s prestige chain cap went 3h → 4h.** The first run no
  longer fits in three hours. A harness budget, not a balance figure.

### Compromises

- **No quality gate was relaxed.** `check` 0 errors, `lint` clean, `build` ok,
  406 tests, Lighthouse 100/100/100/100.
- **The shopkeeper gate does not do what it was expected to do.** It moves the
  pacing by zero seconds, because price already gates harder. Recorded as a
  measurement rather than dressed up: it shapes a camper and is invisible to
  everyone else.
- **`.claude/` had to be excluded from eslint and prettier.** A background agent
  runs in a git worktree there, and a nested tsconfig made typescript-eslint
  refuse to pick a root — 162 parse errors across the project. `.gitignore` is
  off-limits per the brief, so the directory is untracked by pathspec instead.

### Cut, and why

**Fishing up the bicycle.** The owner asked for it and the trader purchase
shipped, but the drop did not: `distributeCatch` can only produce a `Fish` and
`FishType` is a six-member enum, so a junk drop needs a parallel table, a hold
that is not a fish, a Fishdex that does not count it and a sale path that does
not price it per-type. The brief said to add it only if it stayed small. It did
not. Recorded as `design/IDEAS.md` **N2** with a five-step plan, not forgotten.

Nothing else was cut. The map's inaccuracy hook, vendor attachment and the map
itself — the first three things the brief nominated for cutting — all shipped.

### What to read first

1. **`design/archive/PEARL-SIMULATION.md`** and **`design/archive/VOICE-SAMPLE.md`** — two
   decisions waiting on you, both with the work already done. Q1 blocks the
   entire second layer.
2. **`design/SHIFTS-SPEC.md` §9** — the offline trace. If the shift feature is
   built without those seven fixes, the first player to reload at the wrong
   moment is told they sold minus a hundred trillion coins and then cannot play.
3. **Play the first ten minutes.** That is what changed most: a mud pool, a
   bucket that fills, a trader on a bar, and a bicycle that is the first thing
   you actually want.
4. **`design/archive/ANSWERS.md`** — every answered item now carries a short note saying
   what was built, under your own words, which were left untouched.

---

## Addendum — a design pass, and a second front-end

Asked afterwards whether I had used the `frontend-design` skill for this pass.
**I had not** — three new components and ~716 lines of UI went in without it.
This addendum is the correction: the skill was loaded, applied to the existing
screen, and used to build a second front-end from scratch.

Branch `feat/frontend-design`.

### Typography is now real, and self-hosted

Five OFL fonts in `static/fonts/`, latin subset, **152 KB total**. Nothing is
fetched at runtime: the game is a static bundle that has to work with no
network, so a webfont CDN would be a dependency it cannot honour. Recorded in
`THIRD-PARTY-NOTICES.md`, which a desktop build must ship.

### 1. The instrument panel, refined

Kept its identity — a dark marine instrument — and made it read like one.

- **Barlow Condensed** for headings, uppercase and widely tracked, so they read
  as stencilled onto the panel rather than typed on top of it. **IBM Plex Mono**
  for every figure, because the whole game is numbers changing and they must not
  reflow as they climb.
- **Grain.** A single fixed noise layer at 3.5% over the viewport. The panels
  were flat fills over a flat gradient, which is what made the screen read as a
  diagram rather than an object.
- **Machined controls.** A hairline top highlight and a cast shadow on buttons
  and panels, so they sit _in_ the hull instead of being painted on it.
- **One orchestrated arrival** — panels rise in sequence on load, ~45 ms apart.
  Both reduced-motion routes remove it outright rather than shortening it.

### 2. The Logbook — a second front-end at `/logbook`

Not a reskin. A different aesthetic, a different information architecture, and
a different set of type.

**The concept: a fisherman's ledger.** Warm paper, deep ink, one red rubber
stamp doing all the shouting. Young Serif for the masthead, Spectral for prose,
Courier Prime for every figure. Ruled paper drawn as a repeating gradient so
every baseline lands on a line, dotted leaders between label and value, roman
numerals hanging in the margin, and a paper-fibre texture multiplied into the
stock.

**A single scrolling ledger instead of tabs** — six numbered entries: the line,
the bucket, the shore, the water, gear, crew. That is a real IA difference, not
a coat of paint.

It drives the same `game` singleton, so there is no second copy of the rules.

**Why the CSS had to be split.** `app.css` was imported by the shared layout, so
the instrument theme leaked into the ledger — blue-grey headings, brass currency
marks. Fixed at the root: a new `base.css` holds the genuinely universal rules
and is the only thing the layout loads; each route imports its own theme.

### Verified by driving it, not by looking at it

Screenshots prove layout. They do not prove a front-end works, so the ledger was
driven in headless Chrome over CDP:

- 8 seconds of holding the rod → **8 fish in the bucket**, 6 entries in the
  catch list, hold worth ¤4.3.
- Then a full wait for a real trader: countdown 33 → 27 → 21 → 15 → 9 → 3, and
  at **t+46s the bucket emptied 10 → 0 and coins went ¤0 → ¤3.**
- Zero JavaScript errors.

Two false alarms along the way, recorded because they cost time: a run where the
fonts 404'd and the rod did nothing turned out to be **stale preview servers from
earlier runs colliding on ports**, so the browser was loading an old build. I
briefly concluded that every Lighthouse score in this project had been measured
against an un-hydrated page. **That was wrong** — `vite preview` serves the
bundle correctly, and the scores stand.

### Contrast, measured again — and Lighthouse was wrong again

The ledger scored **100 on accessibility while failing AA**:

| Token                                                 |     Before |      After |
| ----------------------------------------------------- | ---------: | ---------: |
| `--ink-faded` (margin notes, table notes, level tags) | **4.23:1** | **5.08:1** |

Same blind spot as the panel: axe cannot resolve the backgrounds and returns
colour-contrast as _incomplete_, so a perfect score is not evidence. Measured
directly against all three paper tones. The rest of the palette passes with room
— ink 11.05:1, ink-soft 6.61:1, stamp 4.80:1.

**`lighthouserc.cjs` now gates both routes.** They are separate documents with
separate CSS and separate fonts, so a score on one said nothing about the other.

### Where the map got fixed

Building the ledger sent me back to the chart three times, all found by looking
at rendered output rather than code:

1. **"Home" was clipped** off the bottom of the viewBox.
2. **Place labels overflowed the left edge** — they are centred on their marker,
   and a place near the frame had its name cut in half. The viewBox now carries
   10 units of bleed on each side.
3. **"Home" rendered centred on its own roof**, because `.place text` is (0,1,1)
   and out-specified the `.home-label` rule meant to left-anchor it.

The empty half of the chart also now reads as deliberate rather than unfinished:
depth contours across the paper, and diagonal hatching over the unsurveyed
region.

### What the Logbook does not do

It covers the core loop — casting, the bucket, the shore, the water, gear and
crew — and links back to the panel. **It has no Fishdex, no achievements, no
Pearls panel and no settings.** It is a genuine alternative front-end for
playing, not a replacement for the whole application, and the panel remains the
complete one.

### Gates

`pnpm check` 0 errors · `pnpm lint` clean · `pnpm build` ok · `pnpm test`
**406 passing** · `pnpm audit:ui` **100/100/100 on both routes**.

---

# FIFTH PASS

The finishing pass. Brief: `design/promt_goals/FIFTH_GOAL.md`.

## Stage 0 — Unbreak offline (`fix/offline`)

### The merge, fixed first and on its own

`#settleOffline` snapshotted the hold, settled, and restored it by
**assignment**. That was correct only because `sellHold` emptied the hold on
every chunk, so by the end of the loop there was never anything of the night's
work left to overwrite. Removing offline selling — which is the whole of R51 —
turns that assignment into silent deletion of the entire night.

So it was fixed first, in its own commit, with a test that failed against the
previous code: a crewed player, the trader's appointment pushed past the window,
one hour away. Before: the hold came back exactly as it was left. After: the
night is added on top of it.

The passive-only change then made the snapshot unnecessary altogether. The hold
now simply stays where it is for the duration of the settle, so the room the
keepnet has is measured against what is genuinely in it and the bucket is
enforced by `accumulate` on the way in, rather than by trimming afterwards.

### Offline is passive (R51)

`sellHold` and `runTrader` are gone from the settle. The crew fish, the boat
burns fuel, and nothing else happens. With no order-dependent call left, the
settle is closed form — one `accumulate` over the whole window — so
**`OFFLINE_CHUNKS` is deleted**.

### The fuel hole: banked coins, capped at half

`runBoat` buys fuel out of `state.coins`, and under R51 no coins arrive while
away. It therefore draws on coins banked before leaving, and that is now
explicit: `OFFLINE_FUEL_SHARE = 0.5`. The settle hands `runBoat` half the purse
for the duration and reconciles afterwards.

Half rather than all, because coming back to an empty purse because the boat
sailed all night is a worse outcome than the boat stopping — and the boat
stopping is a state the game already handles and already reports (`fellBack`).
The mechanism is a smaller `state.coins` during the settle, so no engine code
has to know that this is a night rather than a tick.

### What a night is worth: 24 bucketfuls, deliberately

With nothing selling, the hold is the only place the night can go, and a
thirty-fish bucket would make eight hours worth about forty-five seconds of
watched play.

**`OFFLINE_HOLD_MULTIPLIER = 24`.** This is not a new number. The settle used to
run in `OFFLINE_CHUNKS = 24` chunks and sell between each, so the night's ceiling
was _already_ `24 x capacity`. Keeping 24 keeps that ceiling exactly and changes
only what the player comes back to: fish in the keepnet rather than coins in the
purse, sold by them, at their price, when they choose. It also preserves the
bucket's reason to exist — it is still what sizes a night, times 24.

### The best water gets the room

`SOURCE_ORDER` runs cheapest first, so a bucket-limited crew filled the bucket
with mud pool fish and the open-water crew landed nothing: the deeper the water
you had bought your way into, the less of it you came back to. This was survivable
while the hold was emptied twenty-four times a night. It is not survivable now.

When the bucket binds, `accumulate` works the sources in reverse — best water
first, shallows get what is left. With an Assistant there is no bucket and the
order cannot matter, so nothing changes there.

`accumulate` also now returns `bucketBound`, so "the keepnet filled" is decided
by the arithmetic that did the stopping. Inspecting the leftovers does not work:
the bulk catch path banks per-species remainders, so a genuinely full bucket
reads a few fish short of capacity.

### The trader stops buying once there is an Assistant (R63)

`runTrader` was called unguarded from the live tick, so the trader kept arriving
every forty-five seconds and taking the whole hold at `TRADER_RATE = 0.55` while
`saleRate` told that same player they were on `TOWN_RATE`. The most expensive
purchase of the opening act made them 45% poorer per fish, and nothing said so.

The guard is inside `runTrader`, in the one place a visit is resolved, so no
caller can forget it. The appointment keeps moving while the Assistant is on the
books, so shelving one is not a windfall of two hundred banked arrivals. The
arrival panel and its progress bar are hidden. Four regression tests.

**This exposed a second hole:** nothing requires the bicycle before the
Assistant, and a player who bought the Assistant first would have had no buyer at
all — the trader stops coming and `rideToTown` refuses without a bicycle. The
Assistant is sold as _no trip, no cooldown, full price_, so it now counts as
transport on its own: `saleRate` and the new `canSell` both accept it.

### Pacing, re-measured (seed 7)

|                |                             |
| -------------- | --------------------------- |
| First prestige | **3h23m59s** (was 3h25m12s) |
| Idle crossover | 0h27m02s                    |
| Boat           | 1h29m11s                    |
| Ocean open     | 2h05m00s                    |

Unmoved, as expected: `simulateRun` sells constantly while online and never goes
offline, so none of the above touches it. The figure is recorded to establish the
pass's baseline rather than to claim an effect.

**The prestige chain is the collapse Stage 3 exists to fix**, and it is worse
than the headline suggests:

| Run | Time   | Lifetime coins |
| --- | ------ | -------------- |
| 1   | 3h23m  | 3.5e16         |
| 2   | 20m00s | 9.2e19         |
| 3   | 3m30s  | 4.8e25         |
| 4   | 1m35s  | 2.3e41         |
| 5   | 48s    | 6.4e65         |
| 6   | 46s    | 4.6e84         |

`src/lib/game/ladder.probe.test.ts` prints this ladder. It asserts nothing —
it is a measuring stick for a human — and is off unless `LADDER=1` is set,
because a full chain is ninety seconds of CPU.

## Stage 1 — One front end (`chore/one-frontend`)

R64. `/logbook` is deleted: `src/routes/logbook/`, `src/lib/logbook/`,
`src/logbook.css`, the "Open the Logbook" link and its styles in
`SettingsPanel.svelte`, and the second URL in `lighthouserc.cjs`. 1,283 lines
gone.

Done early and on purpose. Every stage after this one adds UI — a Sell button, a
price board, ponds, minigames, Setback notices, a Help surface — and each of them
would otherwise have had to be built twice, in two visual languages, or
knowingly shipped to only one of the two front ends.

`src/base.css` stays. It is the layout reset that `+layout.svelte` imports, and
keeping the layout free of any opinion about how the game looks is worth doing on
its own merits, not only because there were once two themes.
