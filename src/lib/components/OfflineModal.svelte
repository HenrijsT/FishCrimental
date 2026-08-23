<script lang="ts">
	import { game } from '$lib/game/state.svelte';
	import { MAX_OFFLINE_SECONDS } from '$lib/game/config';
	import { formatDuration } from '$lib/format';
	import Modal from './Modal.svelte';
	import Num from './Num.svelte';

	const report = $derived(game.offlineReport);
</script>

{#if report}
	<Modal
		title="While you were away"
		closeLabel="Back to the water"
		onclose={() => game.dismissOfflineReport()}
	>
		<p>
			The crew worked <strong>{formatDuration(report.cappedSeconds)}</strong> without you.
		</p>
		<ul class="lines">
			<li><span>Fish landed</span><Num value={report.fish} /></li>
			<li><span>Worth, at full price</span><Num value={report.value} tone="coin" /></li>
			{#if report.fuelSpent.gt(0)}
				<li class="expense">
					<span>Fuel, billed by the yard</span>−<Num value={report.fuelSpent} tone="coin" />
				</li>
			{/if}
			<li class="net"><span>In the hold now</span><Num value={report.holdAfter} /></li>
		</ul>

		<p class="faint small">
			Nobody sold anything while you were gone — the catch is still in the hold, waiting for you.
		</p>

		{#if report.holdFull}
			<p class="fell-back">
				The keepnet filled and everything after it went back in the water. A bigger bucket holds a
				bigger night, and an Assistant does away with the limit entirely.
			</p>
		{/if}
		{#if report.fellBack}
			<p class="fell-back">
				The boat ran out of fuel while you were away, so the crew worked inshore instead. They kept
				earning — just not open-water money. Fuel up at the harbour.
			</p>
		{/if}
		{#if report.seconds > MAX_OFFLINE_SECONDS}
			<p class="faint small">
				You were gone {formatDuration(report.seconds)}, but the crew only get paid for the first
				{formatDuration(MAX_OFFLINE_SECONDS)}.
			</p>
		{/if}
	</Modal>
{/if}

<style>
	.lines {
		display: grid;
		gap: 0.3rem;
	}

	.lines li {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.35rem 0.5rem;
		border-radius: var(--radius-sm);
		background: rgba(4, 16, 27, 0.5);
	}

	.small {
		font-size: 0.78rem;
	}

	.expense {
		color: var(--ink-dim);
	}

	.net {
		font-weight: 600;
		border: 1px solid var(--edge);
	}

	.fell-back {
		font-size: 0.8rem;
		color: var(--coral);
		border-left: 2px solid var(--coral);
		padding-left: 0.6rem;
	}
</style>
