# FishCrimental

A fishing incremental. Start with a rod, a pond and nothing else. Hold the line, sell
what comes up, buy better gear, hire people to hold the line for you, and work your way
out to the open ocean — then trade the whole operation in for Pearls and do it again,
faster.

Everything runs in the browser. No server, no account, no network calls. The save lives
in `localStorage` and can be exported as a line of text.

```
pnpm install
pnpm dev        # http://localhost:5173
```

## How it plays

1. **Cast.** Hold the rod button (or hold space). Each completed cast lands a weighted
   random fish from whatever water you are standing in.
2. **Sell.** The hold shows what you have by type and what it is worth. Selling turns
   it into MarketCoins.
3. **Upgrade.** Five pieces of gear, each on an exponential cost curve: a faster rod, a
   wider net, a luckier lure, better market contacts, and crew quarters.
4. **Hire.** Deckhands fish a source on their own at a fraction of your speed. Enough
   of them and they out-earn you — the game tells you the moment they do, and you can
   put the rod down.
5. **Go deeper.** Pond → Stream → River → Lake → Lagoon → Sea → Offshore → Ocean. Each
   one is slower to fish and pays far better. Coins are not the only gate: moving and
   salt water need a **licence** (a chain of four, bought once each), and past the Sea
   you need a **boat**.
6. **Run the boat.** It burns fuel and wears down. Neither is a fail state — a worn
   boat is slower but never stops, and an empty tank simply puts the crew back on the
   nearest shore-accessible water until you fuel up. A Standing Fuel Order makes the
   tank stop being something you think about, including while the game is closed.
7. **Prestige.** Earn 1e15 coins in a single run with the Ocean open and cash the whole
   thing in for Pearls. Pearls are permanent: they multiply everything, and they buy a
   second upgrade tree that makes the next run dramatically shorter.

There are 47 species. The first time you land one it is written up in the Fishdex, with
a permanent bonus to everything you sell afterwards. Two of them are jokes. One of them
is worth nothing at all and there is an achievement for a run that never touches one.

## Scripts

| Command         | What it does                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| `pnpm dev`      | Dev server on the local network (`--host`)                                                              |
| `pnpm build`    | Static build into `build/static`                                                                        |
| `pnpm preview`  | Serve the built site                                                                                    |
| `pnpm check`    | `svelte-check` against `tsconfig.json` — must be 0 errors                                               |
| `pnpm lint`     | Prettier check + ESLint                                                                                 |
| `pnpm format`   | Prettier write                                                                                          |
| `pnpm test`     | Vitest — the game maths                                                                                 |
| `pnpm audit:ui` | Build, then Lighthouse against the preview; asserts performance, accessibility and best-practices ≥ 0.9 |

`pnpm audit:ui` needs Chrome. Point `CHROME_PATH` at it if it is not found automatically.

## Stack

SvelteKit 2 + Svelte 5 (runes throughout) + TypeScript, `adapter-static` with every
route prerendered, `break_eternity.js` for the numbers, plain CSS in `src/app.css`
through PostCSS, pnpm. No component library, no CSS framework, no backend.

## Layout

```
src/lib/
  decimal.ts            D()/d0()/d1() factories, and parseDecimal() — which
                        validates before parsing, because new Decimal('banana')
                        quietly returns 0 rather than throwing
  format.ts             the one number formatter: K/M/B/T → scientific → layered
  random_picker.ts      weighted picker (cumulative array + binary search)
  fish_types.ts         the six categories and their base values
  fishing_sources.ts    the eight sources and their flavour text
  fishes/               47 species with written descriptions
  game/
    config.ts           every tuned constant — sources, upgrades, prestige, costs
    types.ts            GameState and Modifiers
    engine.ts           catch tables, costs, modifiers, accumulation, prestige
    state.svelte.ts     the single reactive store and the tick loop
    save.ts             versioned saves, migrations, export/import blob
    achievements.ts     17 records, one hidden
    guide.ts            staged tab reveal and the one-next-action line
    scenes.ts           the eight water palettes
    balance.ts          a greedy simulated player, used to tune the curves
  components/           the UI
src/routes/+page.svelte the whole game
```

### Numbers

Every currency, count, cost and multiplier is a `Decimal`. Plain `number` is only used
for probabilities, cast durations, timestamps and play time. The two never mix in
arithmetic.

`Decimal` constants are never exported — break_eternity mutates in place, so one stray
`fromNumber` call on a shared `ZERO` would corrupt it for every importer. Use `d0()`.

### Simulation

Nothing is ticked per entity. Deckhand output is `casts = crew × castsPerSecond ×
elapsed`, computed once per source when observed, and spread across that source's
species by expected probability. That is what makes eight hours of offline progress a
single calculation instead of a replay.

### Balance

`src/lib/game/balance.ts` plays the game: hold the rod at the deepest open water, sell
constantly, unlock the next source when affordable, and always buy the cheapest thing
available. `balance.test.ts` asserts against it, so the curves cannot silently drift.

On the current numbers the first prestige takes about **2 h 25 m** of active play and
lands at 1.00e15 lifetime coins; a mostly-idle player gets there in about 3 h 30 m. The
second run takes an hour, the fourth under a minute, and a sixth run over the same
three-hour window reaches 1e55. Licences, the boat and its fuel are all bought by the
simulated player, so the pacing figures include those sinks.

## Licence

See `LICENSE`.
