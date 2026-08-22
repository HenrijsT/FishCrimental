<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import '../../logbook.css';

	import { game } from '$lib/game/state.svelte';
	import { sources } from '$lib/fishing_sources';
	import { FISH_TYPES, fishTypeBaseValue } from '$lib/fish_types';
	import {
		ASSISTANT_COST,
		BICYCLE_COST,
		BUCKET_MAX_LEVEL,
		MAP_MAX_LEVEL,
		SOURCE_CONFIG,
		SOURCE_ORDER,
		TOWN_TRIP_SECONDS,
		TRADER_RATE,
		UPGRADES,
		UPGRADE_IDS
	} from '$lib/game/config';
	import {
		catchTable,
		deckhandCost,
		missingLicence,
		nextLockedSource,
		sourceBlocker,
		traderInStock,
		upgradeBulkCost
	} from '$lib/game/engine';
	import { formatDuration } from '$lib/format';
	import Figure from '$lib/logbook/Figure.svelte';

	const g = $derived(game.state);
	const here = $derived(sources[g.activeSource].name);
	const next = $derived(nextLockedSource(g));

	/** The stamp in the top corner says the one thing that matters right now. */
	const stamp = $derived(
		game.inTown
			? 'IN TOWN'
			: game.holdRoom !== null && game.holdRoom.lte(0)
				? 'BUCKET FULL'
				: game.boatBlocker === 'fuel'
					? 'NO FUEL'
					: here.toUpperCase()
	);

	let captured: { element: HTMLElement; pointerId: number } | null = null;

	function hold(event: PointerEvent) {
		const element = event.currentTarget as HTMLElement;
		try {
			element.setPointerCapture(event.pointerId);
			captured = { element, pointerId: event.pointerId };
		} catch {
			captured = null;
		}
		game.beginCast();
	}

	function release(event: PointerEvent) {
		// Only the pointer that started the cast may end it — a second finger
		// landing and lifting must not cancel the first one's work.
		if (captured && captured.pointerId !== event.pointerId) return;
		if (captured) {
			try {
				captured.element.releasePointerCapture(captured.pointerId);
			} catch {
				/* already gone */
			}
			captured = null;
		}
		game.endCast();
	}

	function keyCast(event: KeyboardEvent) {
		if (event.key !== ' ' && event.key !== 'Enter') return;
		event.preventDefault();
		if (!event.repeat) game.beginCast();
	}

	function keyRelease(event: KeyboardEvent) {
		if (event.key !== ' ' && event.key !== 'Enter') return;
		game.endCast();
	}

	onMount(() => {
		game.init();

		const save = () => game.save();
		const onVisibility = () => (document.hidden ? game.save() : game.resume());

		document.addEventListener('visibilitychange', onVisibility);
		window.addEventListener('pagehide', save);

		return () => {
			save();
			game.stop();
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('pagehide', save);
		};
	});
</script>

<svelte:head>
	<title>The Logbook — FishCrimental</title>
	<meta name="description" content="A fisherman's ledger. The same game, kept on paper." />
</svelte:head>

<div class="logbook" class:reduce-motion={g.settings.reduceMotion}>
	<div class="sheet">
		<!-- ── Masthead ─────────────────────────────────────────────────── -->
		<header class="masthead">
			<div class="title">
				<p class="kicker">Being a true and complete account of</p>
				<h1>The Logbook</h1>
				<p class="byline">
					kept at the <em>{here}</em>, day
					<Figure value={Math.max(1, Math.floor(g.playTime / 600) + 1)} precision={0} />
				</p>
			</div>
			<div class="stamp" aria-hidden="true">{stamp}</div>
		</header>

		<dl class="tally">
			<div>
				<dt>On hand</dt>
				<dd><Figure value={g.coins} coin /></dd>
			</div>
			<div>
				<dt>Coming in</dt>
				<dd><Figure value={game.incomePerSecond} coin />/s</dd>
			</div>
			<div>
				<dt>Species known</dt>
				<dd><Figure value={game.discovered} precision={0} /> of 47</dd>
			</div>
			<div>
				<dt>Pearls</dt>
				<dd><Figure value={g.pearls} precision={0} /></dd>
			</div>
		</dl>

		<!-- ── The line ─────────────────────────────────────────────────── -->
		<section class="entry">
			<h2><span class="rule-no">i.</span> The line</h2>
			<p class="margin-note">
				Hold it. Let go to stop.
				{#if game.inTown}You are in town — nothing is in the water.{/if}
			</p>

			<button
				class="rod"
				class:working={game.casting}
				disabled={game.inTown}
				onpointerdown={hold}
				onpointerup={release}
				onpointercancel={release}
				onlostpointercapture={release}
				onkeydown={keyCast}
				onkeyup={keyRelease}
				onblur={() => game.endCast()}
			>
				<span class="rod-face">
					{#if game.inTown}
						back in {Math.ceil(game.townLeft)}s
					{:else if game.casting}
						waiting on a bite
					{:else}
						cast the line
					{/if}
				</span>
				<span class="rod-fill" style:width="{game.castProgress * 100}%"></span>
			</button>

			<p class="beneath">
				<Figure value={game.activeCastSeconds} /> seconds a cast ·
				<Figure value={game.modifiers.fishPerCast} /> fish a time
			</p>

			{#if game.recentCatches.length}
				<ol class="catches">
					{#each game.recentCatches.slice(0, 6) as entry (entry.id)}
						<li>
							<span class="what">{entry.fish.name}</span>
							<span class="leader" aria-hidden="true"></span>
							<span class="count"><Figure value={entry.count} /></span>
						</li>
					{/each}
				</ol>
			{/if}
		</section>

		<!-- ── The bucket ───────────────────────────────────────────────── -->
		<section class="entry">
			<h2><span class="rule-no">ii.</span> The bucket</h2>
			<p class="margin-note">
				{#if game.holdRoom === null}
					The assistant empties it as fast as it fills.
				{:else}
					<Figure value={game.holdSize} precision={0} /> of
					<Figure value={game.bucketSize} precision={0} />. A full bucket stops the crew too.
				{/if}
			</p>

			{#if game.holdRoom !== null}
				{@const full = game.bucketSize.gt(0)
					? Math.min(1, game.holdSize.div(game.bucketSize).toNumber())
					: 0}
				<div class="gauge" role="presentation">
					<span style:width="{full * 100}%"></span>
				</div>
			{/if}

			<table class="ledger">
				<tbody>
					{#each FISH_TYPES.filter((t) => g.hold[t].gt(0)) as type (type)}
						<tr>
							<th scope="row">{type}</th>
							<td class="dots" aria-hidden="true"></td>
							<td class="qty"><Figure value={g.hold[type]} precision={0} /></td>
							<td class="worth">
								{#if fishTypeBaseValue[type] === 0}
									<span class="nil">nothing</span>
								{:else}
									<Figure value={fishTypeBaseValue[type]} coin />
								{/if}
							</td>
						</tr>
					{:else}
						<tr class="empty">
							<td colspan="4">Empty. Nothing has come up yet.</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<p class="total">
				Worth <strong
					><Figure value={g.holdValue.times(game.modifiers.sellMultiplier)} coin /></strong
				>
				at the full price{#if !g.hasBicycle}, which is not the price you can get{/if}.
			</p>
		</section>

		<!-- ── The shore ────────────────────────────────────────────────── -->
		<section class="entry">
			<h2><span class="rule-no">iii.</span> The shore</h2>
			<p class="margin-note">
				A man with no cart sells to whoever walks past, at whatever they feel like paying.
			</p>

			<div class="trader">
				<div class="trader-line">
					<span>Next trader</span>
					<span class="leader" aria-hidden="true"></span>
					<span class="when"><Figure value={Math.ceil(game.traderLeft)} precision={0} />s</span>
				</div>
				<div class="gauge tide" role="presentation">
					<span style:width="{game.traderFill * 100}%"></span>
				</div>
				<p class="beneath">
					He takes the lot at {Math.round(TRADER_RATE * 100)}% —
					<Figure
						value={g.holdValue.times(game.modifiers.sellMultiplier).times(TRADER_RATE)}
						coin
					/> as it stands.
				</p>
			</div>

			<ul class="offers">
				{#if g.hasBicycle}
					<li>
						<div>
							<h3>Ride into town</h3>
							<p>
								Full price.
								{#if g.hasAssistant}
									The assistant goes, so you never leave the water.
								{:else}
									You are off the water {TOWN_TRIP_SECONDS}s. The crew keep working.
								{/if}
							</p>
						</div>
						<button
							class="ink"
							onclick={() => game.ride()}
							disabled={g.holdValue.lte(0) || game.inTown}
						>
							{#if game.inTown}
								gone
							{:else}
								<Figure value={g.holdValue.times(game.modifiers.sellMultiplier)} coin />
							{/if}
						</button>
					</li>
				{:else}
					<li>
						<div>
							<h3>A bicycle</h3>
							<p>Sell in town at the full price instead of taking what you are offered.</p>
						</div>
						<button
							class="ink"
							onclick={() => game.purchaseBicycle()}
							disabled={!traderInStock(g, 'bicycle') || g.coins.lt(BICYCLE_COST)}
						>
							{#if traderInStock(g, 'bicycle')}<Figure value={BICYCLE_COST} coin />{:else}not
								carried{/if}
						</button>
					</li>
				{/if}

				{#if !g.hasAssistant}
					{#if g.bucketLevel.lt(BUCKET_MAX_LEVEL)}
						<li>
							<div>
								<h3>A bigger bucket <span class="lv">no. {g.bucketLevel.toFixed(0)}</span></h3>
								<p>Holds <Figure value={game.bucketSize} precision={0} /> as it is.</p>
							</div>
							<button
								class="ink"
								onclick={() => game.upgradeBucket()}
								disabled={!traderInStock(g, 'bucket') || g.coins.lt(game.bucketPrice)}
							>
								{#if traderInStock(g, 'bucket')}<Figure value={game.bucketPrice} coin />{:else}not
									carried{/if}
							</button>
						</li>
					{/if}
					<li>
						<div>
							<h3>An assistant</h3>
							<p>
								Sells at full price with no trip, and empties the bucket as fast as you fill it.
							</p>
						</div>
						<button
							class="ink"
							onclick={() => game.purchaseAssistant()}
							disabled={!traderInStock(g, 'assistant') || g.coins.lt(ASSISTANT_COST)}
						>
							{#if traderInStock(g, 'assistant')}<Figure value={ASSISTANT_COST} coin />{:else}not
								carried{/if}
						</button>
					</li>
				{/if}

				{#if g.mapLevel.lt(MAP_MAX_LEVEL)}
					<li>
						<div>
							<h3>A better chart <span class="lv">no. {g.mapLevel.toFixed(0)}</span></h3>
							<p>
								Puts the places closer to where they really are, and reaches further along the
								coast.
							</p>
						</div>
						<button class="ink" onclick={() => game.buyMap()} disabled={g.coins.lt(game.mapPrice)}>
							<Figure value={game.mapPrice} coin />
						</button>
					</li>
				{/if}
			</ul>
		</section>

		<!-- ── The water ────────────────────────────────────────────────── -->
		<section class="entry">
			<h2><span class="rule-no">iv.</span> The water</h2>
			<p class="margin-note">Everywhere known to me, and what it is worth going there for.</p>

			<table class="ledger water">
				<thead>
					<tr>
						<th scope="col">Place</th>
						<th scope="col" class="right">Per cast</th>
						<th scope="col" class="right">A fish is worth</th>
						<th scope="col"></th>
					</tr>
				</thead>
				<tbody>
					{#each SOURCE_ORDER as source (source)}
						{@const open = g.unlocked[source]}
						{@const isNext = next === source}
						{#if open || isNext}
							{@const config = SOURCE_CONFIG[source]}
							{@const blocker = sourceBlocker(g, source, game.modifiers)}
							{@const licence = missingLicence(g, source)}
							<tr class:current={g.activeSource === source} class:shut={!open}>
								<th scope="row">
									{sources[source].name}
									{#if g.activeSource === source}<span class="mark-here">— here</span>{/if}
								</th>
								<td class="right"><Figure value={game.modifiers.castSeconds[source]} />s</td>
								<td class="right">
									<Figure value={catchTable(source, game.modifiers.luck).averageSourceValue} coin />
								</td>
								<td class="act">
									{#if !open}
										<button
											class="ink small"
											onclick={() => game.unlock(source)}
											disabled={g.coins.lt(config.unlockCost) || licence !== null}
										>
											{#if licence}needs paper{:else}<Figure value={config.unlockCost} coin />{/if}
										</button>
									{:else if g.activeSource === source}
										<span class="nil">—</span>
									{:else}
										<button
											class="ink small"
											onclick={() => game.setSource(source)}
											disabled={blocker !== null}
										>
											{#if blocker === 'fuel'}no fuel{:else if blocker === 'boat'}needs a boat{:else}go{/if}
										</button>
									{/if}
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</section>

		<!-- ── Gear ─────────────────────────────────────────────────────── -->
		<section class="entry">
			<h2><span class="rule-no">v.</span> Gear</h2>
			<p class="margin-note">
				Everything here multiplies everything else. Whoever is nearest sells only so far up the
				list.
			</p>

			<table class="ledger">
				<tbody>
					{#each UPGRADE_IDS as id (id)}
						{@const config = UPGRADES[id]}
						{@const level = g.upgrades[id]}
						{@const ceiling = game.ceilings[id]}
						{@const capped = level.gte(ceiling) && level.lt(config.maxLevel)}
						{@const step = game.upgradeStep(id)}
						{@const cost = step.gt(0) ? upgradeBulkCost(id, level, step) : null}
						<tr class:shut={capped}>
							<th scope="row">
								{config.name}
								<span class="lv">no. {level.toFixed(0)} / {ceiling}</span>
							</th>
							<td class="dots" aria-hidden="true"></td>
							<td class="note">
								{#if capped}
									best sold {game.stockedAt[id]
										? `at the ${sources[game.stockedAt[id]!].name}`
										: 'further out'}
								{:else}
									{config.format(level.toNumber())}
								{/if}
							</td>
							<td class="act">
								<button
									class="ink small"
									onclick={() => game.buy(id)}
									disabled={capped || cost === null || g.coins.lt(cost)}
								>
									{#if capped}—{:else if cost}<Figure value={cost} coin />{:else}maxed{/if}
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

		<!-- ── Crew ─────────────────────────────────────────────────────── -->
		<section class="entry">
			<h2><span class="rule-no">vi.</span> Crew</h2>
			<p class="margin-note">
				They fish whether you are here or not. Hire them where you want them.
			</p>

			<table class="ledger">
				<tbody>
					{#each SOURCE_ORDER.filter((s) => g.unlocked[s]) as source (source)}
						{@const owned = g.deckhands[source]}
						{@const step = game.deckhandStep(source)}
						{@const price = deckhandCost(source, owned)}
						<tr>
							<th scope="row">
								{sources[source].name}
								<span class="lv"><Figure value={owned} precision={0} /> hired</span>
							</th>
							<td class="dots" aria-hidden="true"></td>
							<td class="act">
								<button
									class="ink small"
									onclick={() => game.hire(source)}
									disabled={g.coins.lt(price) || step.lte(0)}
								>
									<Figure value={price} coin />
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

		<footer class="colophon">
			<p>
				Kept for {formatDuration(g.playTime)}.
				<a href={resolve('/')}>Back to the instrument panel</a>
			</p>
		</footer>
	</div>
</div>

<style>
	/* The sheet. Generous margins because paper has them and screens rarely do. */
	.sheet {
		max-width: 46rem;
		margin: 0 auto;
		padding: clamp(1.5rem, 5vw, 4rem) clamp(1rem, 5vw, 3.5rem) 6rem;
	}

	/* ── Masthead ──────────────────────────────────────────────────────── */

	.masthead {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1.5rem;
		padding-bottom: 1.2rem;
		border-bottom: 2px solid var(--ink);
		margin-bottom: 0.6rem;
	}

	.kicker {
		margin: 0;
		font-size: 0.78rem;
		font-style: italic;
		color: var(--ink-faded);
		letter-spacing: 0.02em;
	}

	h1 {
		font-family: var(--display);
		font-size: clamp(2.6rem, 9vw, 4.2rem);
		line-height: 0.92;
		margin: 0.1rem 0 0.2rem;
		letter-spacing: -0.015em;
		/* Letterpress: ink bitten into the sheet, lifted a hair on the underside. */
		text-shadow: 0 1px 0 rgba(255, 252, 240, 0.55);
	}

	.byline {
		margin: 0;
		font-size: 0.9rem;
		color: var(--ink-soft);
	}

	.byline em {
		font-weight: 600;
		font-style: normal;
		border-bottom: 1px solid var(--rule);
	}

	/*
	 * The stamp. One red mark on the whole page, so it is never ambiguous what
	 * it is drawing attention to. Rotated and multiplied into the paper so the
	 * fibre shows through the ink.
	 */
	.stamp {
		flex: 0 0 auto;
		align-self: center;
		font-family: var(--display);
		font-size: 0.82rem;
		letter-spacing: 0.14em;
		color: var(--stamp);
		border: 2px solid var(--stamp);
		border-radius: 2px;
		padding: 0.35rem 0.7rem;
		transform: rotate(-6deg);
		opacity: 0.82;
		mix-blend-mode: multiply;
		white-space: nowrap;
		box-shadow: inset 0 0 0 1px var(--stamp-soft);
	}

	/* ── The running tally ─────────────────────────────────────────────── */

	.tally {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
		gap: 0 1.5rem;
		margin: 0 0 2.2rem;
		padding-bottom: 0.8rem;
		border-bottom: 1px solid var(--rule);
	}

	.tally dt {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.11em;
		color: var(--ink-faded);
	}

	.tally dd {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 600;
	}

	/* ── Entries ───────────────────────────────────────────────────────── */

	.entry {
		margin-bottom: 2.6rem;
		position: relative;
	}

	h2 {
		font-family: var(--display);
		font-size: 1.5rem;
		font-weight: 400;
		margin: 0 0 0.1rem;
		letter-spacing: -0.01em;
	}

	/* Roman numerals hang in the margin, the way a printed index does. */
	.rule-no {
		color: var(--stamp);
		margin-right: 0.5rem;
		font-size: 0.85em;
	}

	.margin-note {
		margin: 0 0 1rem;
		font-size: 0.86rem;
		font-style: italic;
		color: var(--ink-faded);
		max-width: 44ch;
	}

	.beneath {
		margin: 0.5rem 0 0;
		font-size: 0.82rem;
		color: var(--ink-faded);
	}

	/* ── The rod ───────────────────────────────────────────────────────── */

	.rod {
		position: relative;
		display: block;
		width: 100%;
		overflow: hidden;
		font-family: var(--display);
		font-size: 1.3rem;
		letter-spacing: 0.01em;
		color: var(--paper-lit);
		background: var(--ink);
		border: none;
		border-radius: 3px;
		padding: 1.1rem 1rem;
		cursor: pointer;
		touch-action: none;
		user-select: none;
		box-shadow: 0 2px 0 var(--ink-soft);
		transition: transform 90ms ease;
	}

	.rod:active:not(:disabled) {
		transform: translateY(2px);
		box-shadow: 0 0 0 var(--ink-soft);
	}

	.rod:disabled {
		background: var(--ink-faded);
		cursor: not-allowed;
	}

	.rod-face {
		position: relative;
		z-index: 1;
	}

	/* The fill is the line going out — ink washing across from the left. */
	.rod-fill {
		position: absolute;
		inset: 0 auto 0 0;
		background: var(--sea);
		transition: width 70ms linear;
	}

	.rod.working .rod-face {
		color: var(--paper-lit);
	}

	/* ── Catch list ────────────────────────────────────────────────────── */

	.catches {
		list-style: none;
		margin: 1rem 0 0;
		padding: 0;
		font-size: 0.88rem;
	}

	.catches li {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.what {
		white-space: nowrap;
	}

	.count {
		white-space: nowrap;
		color: var(--ink-soft);
	}

	/* Dotted leaders. The single most ledger-ish thing on the page. */
	.leader,
	.dots {
		flex: 1 1 auto;
		border-bottom: 1px dotted var(--rule);
		transform: translateY(-0.28em);
		min-width: 1.5rem;
	}

	/* ── Gauges ────────────────────────────────────────────────────────── */

	/* Drawn as a rule on the page, not a widget floating above it: a hairline
	   trough with ink filling along it. */
	.gauge {
		height: 9px;
		background: var(--paper-shade);
		border: 1px solid var(--ink-faded);
		border-radius: 1px;
		overflow: hidden;
		box-shadow: inset 0 1px 2px rgba(60, 45, 25, 0.16);
	}

	.gauge span {
		display: block;
		height: 100%;
		min-width: 2px;
		background: repeating-linear-gradient(45deg, var(--ink-soft) 0 4px, var(--ink) 4px 8px);
		transition: width 160ms linear;
	}

	.gauge.tide span {
		background: repeating-linear-gradient(45deg, var(--sea) 0 4px, #1f3a46 4px 8px);
	}

	/* ── Ledger tables ─────────────────────────────────────────────────── */

	.ledger {
		width: 100%;
		border-collapse: collapse;
		margin-top: 0.9rem;
		font-size: 0.92rem;
	}

	.ledger th,
	.ledger td {
		text-align: left;
		padding: 0.28rem 0;
		vertical-align: baseline;
		font-weight: 400;
	}

	.ledger thead th {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--ink-faded);
		border-bottom: 1px solid var(--ink);
		padding-bottom: 0.3rem;
	}

	.ledger tbody tr {
		border-bottom: 1px solid var(--rule-faint);
	}

	.ledger tbody tr:last-child {
		border-bottom: none;
	}

	.ledger th[scope='row'] {
		font-weight: 600;
		white-space: nowrap;
		padding-right: 0.5rem;
	}

	.right {
		text-align: right;
	}

	.qty,
	.worth {
		text-align: right;
		padding-left: 0.9rem;
		white-space: nowrap;
	}

	.note {
		color: var(--ink-faded);
		font-size: 0.84rem;
		padding-left: 0.9rem;
	}

	.act {
		text-align: right;
		padding-left: 0.9rem;
		white-space: nowrap;
	}

	.lv {
		font-family: var(--figure);
		font-size: 0.72rem;
		font-weight: 400;
		color: var(--ink-faded);
		margin-left: 0.4rem;
	}

	.mark-here {
		color: var(--stamp);
		font-weight: 400;
		font-style: italic;
		font-size: 0.82rem;
	}

	.ledger .empty td {
		color: var(--ink-faded);
		font-style: italic;
	}

	.shut th[scope='row'],
	.shut .note {
		color: var(--ink-faded);
	}

	.current th[scope='row'] {
		color: var(--stamp);
	}

	.nil {
		color: var(--ink-faded);
	}

	.total {
		margin: 0.8rem 0 0;
		font-size: 0.9rem;
	}

	/* ── Offers ────────────────────────────────────────────────────────── */

	.trader {
		margin-bottom: 1.4rem;
	}

	.trader-line {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		font-size: 0.9rem;
		margin-bottom: 0.35rem;
	}

	.when {
		font-family: var(--figure);
		color: var(--stamp);
	}

	.offers {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.offers li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.2rem;
		padding: 0.7rem 0;
		border-bottom: 1px solid var(--rule-faint);
	}

	.offers li:last-child {
		border-bottom: none;
	}

	.offers h3 {
		margin: 0;
		font-family: var(--body);
		font-size: 0.98rem;
		font-weight: 600;
	}

	.offers p {
		margin: 0.1rem 0 0;
		font-size: 0.83rem;
		color: var(--ink-faded);
		max-width: 42ch;
	}

	/* ── Buttons ───────────────────────────────────────────────────────── */

	/* Ink on paper: a hairline box, filled on hover the way a stamp presses. */
	.ink {
		font-family: var(--figure);
		font-size: 0.85rem;
		color: var(--ink);
		background: transparent;
		border: 1px solid var(--ink);
		border-radius: 2px;
		padding: 0.32rem 0.7rem;
		cursor: pointer;
		white-space: nowrap;
		transition:
			background 110ms ease,
			color 110ms ease;
	}

	.ink:hover:not(:disabled) {
		background: var(--ink);
		color: var(--paper-lit);
	}

	.ink:active:not(:disabled) {
		background: var(--stamp);
		border-color: var(--stamp);
		color: var(--paper-lit);
	}

	.ink:disabled {
		color: var(--ink-faded);
		border-color: var(--rule);
		cursor: not-allowed;
	}

	.ink.small {
		font-size: 0.78rem;
		padding: 0.22rem 0.55rem;
	}

	:global(.logbook) :where(button, a):focus-visible {
		outline: 2px solid var(--stamp);
		outline-offset: 2px;
	}

	/* ── Colophon ──────────────────────────────────────────────────────── */

	.colophon {
		margin-top: 3rem;
		padding-top: 1rem;
		border-top: 2px solid var(--ink);
		font-size: 0.82rem;
		color: var(--ink-faded);
		font-style: italic;
	}

	.colophon a {
		color: var(--stamp);
	}

	/* ── Arrival ───────────────────────────────────────────────────────── */

	/*
	 * The page is written, not assembled: entries settle in sequence like ink
	 * drying down the sheet. One orchestrated moment, then nothing moves again.
	 */
	@keyframes settle {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	.masthead,
	.tally,
	.entry,
	.colophon {
		animation: settle 500ms cubic-bezier(0.2, 0.7, 0.3, 1) backwards;
	}

	.tally {
		animation-delay: 70ms;
	}
	.entry:nth-of-type(1) {
		animation-delay: 130ms;
	}
	.entry:nth-of-type(2) {
		animation-delay: 190ms;
	}
	.entry:nth-of-type(3) {
		animation-delay: 250ms;
	}
	.entry:nth-of-type(4) {
		animation-delay: 310ms;
	}
	.entry:nth-of-type(5) {
		animation-delay: 370ms;
	}
	.entry:nth-of-type(6) {
		animation-delay: 430ms;
	}
	.colophon {
		animation-delay: 490ms;
	}

	.reduce-motion .masthead,
	.reduce-motion .tally,
	.reduce-motion .entry,
	.reduce-motion .colophon {
		animation: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.masthead,
		.tally,
		.entry,
		.colophon {
			animation: none;
		}

		.rod-fill,
		.gauge span {
			transition: none;
		}
	}

	@media (max-width: 34rem) {
		.masthead {
			flex-direction: column;
			gap: 0.8rem;
		}

		.stamp {
			align-self: flex-start;
		}

		.worth {
			display: none;
		}
	}
</style>
