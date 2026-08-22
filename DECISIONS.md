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

| Licence | Covers | Cost |
|---|---|---|
| Inland Angling Licence | Stream, River | 360 |
| Lake & Lagoon Permit | Lake, Lagoon | 14,000 |
| Coastal Waters Licence | Sea, Offshore | 640,000 |
| Deep Sea Charter | Ocean | 38,000,000 |

The Pond needs nothing — the first two minutes of the game must not have a form to
fill in. A licence is separate from the source's coin cost, so opening new water has
two beats: qualify, then afford.

### The boat

**Decision: Offshore and Ocean need it; the Sea does not.** The brief left the Sea to
judgement. Keeping it shore-accessible means the boat arrives *after* the player has
met licences, deckhands, upgrades and the Fishdex, rather than piling a fifth system on
top of a fourth. It also gives the fallback somewhere real to fall back *to* — the Sea
is a genuinely productive place to be stranded, not a punishment.

- **Boat** — 1,950,000 coins, bought once.
- **Fuel** — 0.85 L per open-water cast at 5,400 coins/L, from a 400 L tank.
- **Condition** — 0–100, 0.006 lost per open-water cast, 74,000 coins per point to repair.
- **Fit-out** — Reinforced Hull (wear ×0.72/level), Efficient Engine (fuel ×0.74/level),
  Larger Tank (×1.85/level), and Standing Fuel Order (one-off).

### Never a fail state — and what that actually took

The brief's hard constraint drove four separate design choices, each with a test:

1. **Condition never stops the boat.** `boatEfficiency` maps 0–100 onto 0.4–1.0 and is
   applied as *drag on cast time*. A completely neglected boat is 60% slower. It is
   never 0, and it costs nothing to leave broken except speed.
2. **An empty tank falls back, it does not halt.** `reachableSource` walks back to the
   deepest water that is unlocked, licensed and shore-accessible. In `accumulate`, the
   casts the boat could not cover are *worked inshore instead* and still pay. A test
   runs eight hours with an empty tank, zero condition and no money and asserts the
   value earned is greater than zero and nothing was destroyed.
3. **The player is told, in plain words.** A persistent banner names the water they were
   moved from and to, says nothing was lost, and offers a jump to the harbour. The
   offline summary carries the same line when it happened while they were away.
4. **A standing order removes the chore entirely.** It is a *delivery*, not a tank
   top-up — it buys exactly what the trip needs, capped only by coins, and bills for it.
   An empty tank with a standing order and coins in hand counts as able to sail.

**Two bugs came out of playtesting this, not out of the type checker:**

- The stranded banner cleared itself on the very next 200 ms tick, because
  `#keepFishable` tested the source the player had just been *moved to* rather than the
  one they were moved *from*. Reproduced live: the banner never appeared at all.
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

| | before Stage 2 | after |
|---|---|---|
| First prestige | 2 h 18 m at 1.00e15 | **2 h 25 m at 1.00e15** |
| Mostly-idle player | 3 h 08 m | 3 h 30 m |
| Sources open at | 5/12/18/27/37/49/67 m | 6/14/21/30/39/53/71 m |
| Licences taken at | — | 3 / 14 / 23 / 33 m |
| Boat bought at | — | 39 m |
| Run 2 / 3 / 4 | 1 h 02 m / 24 m / 1 m 25 s | 1 h 03 m / 24 m / 57 s |
| Run 6 lifetime (3 h) | 1.18e45 | **1.79e55** |

Source unlock costs were also cut 20% to soften the double charge of licence-plus-price
at each tier.

**Save format 3**, with a migration that grandfathers an existing run: the licences
covering water it had already opened are granted, and a save that had already reached
open water is handed a boat. Nobody loses access to water mid-run.

**Gates:** `pnpm check` 0 errors · `pnpm lint` clean · `pnpm build` ok ·
`pnpm test` 213 passing · `pnpm audit:ui` 1.00 / 1.00 / 1.00 / 1.00.
