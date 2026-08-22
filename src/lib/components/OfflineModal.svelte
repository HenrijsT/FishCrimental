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
			<li><span>Sold on the dock</span><Num value={report.coins} tone="coin" /></li>
		</ul>
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
</style>
