<script lang="ts">
	import { KNOWLEDGE_COEFF, MARKET_HALF_LIFE, MARKET_IMPACT } from '$lib/game/config';
	import { knowledge, speciesMultiplier } from '$lib/game/market';
	import { game } from '$lib/game/state.svelte';
	import { formatDuration } from '$lib/format';
	import Num from './Num.svelte';

	const g = $derived(game.state);

	/**
	 * Everything the market currently has an opinion about, worst price first —
	 * what a player wants to see is what they have hurt.
	 */
	const book = $derived(
		game.marketBook.map((row) => ({
			...row,
			knowledge: knowledge(g, row.species),
			net: speciesMultiplier(g, row.species)
		}))
	);
</script>

<section class="panel">
	<h2>The fish market</h2>

	<p class="muted intro">
		Every species has its own price, and it is your own selling that moves it. Land a thousand
		Guppies and Guppies are worth less; leave them alone and the price comes back. Everything you
		have ever caught also makes you better at catching it, and that part is never lost.
	</p>

	<dl class="stats">
		<div>
			<dt>Market depth</dt>
			<dd><Num value={game.marketDepth} /></dd>
		</div>
		<div>
			<dt>Prices recover</dt>
			<dd>half in {formatDuration(MARKET_HALF_LIFE)}</dd>
		</div>
		<div>
			<dt>Species under pressure</dt>
			<dd>{book.length}</dd>
		</div>
	</dl>

	<p class="faint small">
		Selling as you go and selling in one lump are worth exactly the same — a sale is priced fish by
		fish as it moves the price, so there is nothing to be gained by sitting on a full bucket waiting
		for a number to tick up. Waiting only costs you the fishing.
	</p>

	{#if book.length === 0}
		<p class="muted empty">
			Nothing is under pressure. Every species is at its full price — which is what a market looks
			like when you have not been flooding it.
		</p>
	{:else}
		<table>
			<thead>
				<tr>
					<th scope="col">Species</th>
					<th scope="col">Price</th>
					<th scope="col">Knowledge</th>
					<th scope="col">You get</th>
				</tr>
			</thead>
			<tbody>
				{#each book as row (row.species)}
					<tr>
						<th scope="row">{row.species}</th>
						<td class:hurt={row.price.lt(0.75)}>×{row.price.toNumber().toFixed(3)}</td>
						<td class="good">×{row.knowledge.toNumber().toFixed(3)}</td>
						<td class:hurt={row.net.lt(1)} class:good={row.net.gte(1)}>
							×{row.net.toNumber().toFixed(3)}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}

	<h3>Cold Storage</h3>
	<p class="faint small">
		Depth is how much selling it takes to move a price at all, and Cold Storage buys it. Without it
		a growing operation walks its own prices down faster than it can grow — a bigger boat with
		nowhere to keep the catch is a bigger boat selling into a worse market. It is in Gear.
	</p>

	<p class="faint small">
		The arithmetic, for anyone who wants it: price is
		<code>(1 + sold / depth)<sup>−{MARKET_IMPACT}</sup></code>, and knowledge is
		<code>1 + {KNOWLEDGE_COEFF} · ln(1 + caught / 100)</code>. Both are gentle and neither ever
		reaches zero.
	</p>
</section>

<style>
	.intro {
		max-width: 62ch;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: 0.5rem;
		margin: 0.9rem 0 0.6rem;
	}

	.stats div {
		background: rgba(4, 16, 27, 0.5);
		border-radius: var(--radius-sm);
		padding: 0.4rem 0.6rem;
	}

	.stats dt {
		font-size: 0.7rem;
		color: var(--ink-dim);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.stats dd {
		margin: 0.15rem 0 0;
		font-variant-numeric: tabular-nums;
	}

	.small {
		font-size: 0.78rem;
		max-width: 62ch;
	}

	.empty {
		font-size: 0.85rem;
		margin-top: 0.8rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 0.8rem;
		font-size: 0.85rem;
	}

	th,
	td {
		text-align: right;
		padding: 0.3rem 0.5rem;
		font-variant-numeric: tabular-nums;
	}

	thead th {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ink-dim);
		border-bottom: 1px solid var(--rule);
	}

	th[scope='row'],
	thead th:first-child {
		text-align: left;
		font-weight: 500;
	}

	tbody tr:nth-child(even) {
		background: rgba(4, 16, 27, 0.4);
	}

	.hurt {
		color: var(--coral);
	}

	.good {
		color: var(--ink-dim);
	}

	h3 {
		margin-top: 1.2rem;
	}

	code {
		font-size: 0.95em;
	}
</style>
