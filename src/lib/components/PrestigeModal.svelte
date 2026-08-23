<script lang="ts">
	import { game } from '$lib/game/state.svelte';
	import { lastTier, shiftName } from '$lib/game/shifts';
	import Modal from './Modal.svelte';
	import Num from './Num.svelte';

	const result = $derived(game.prestigeResult);
	// `prestigeCount` has already been incremented by the time this shows, so
	// the shift just ridden out is the one before the next.
	const ridden = $derived(lastTier(game.state.prestigeCount));
	const name = $derived(shiftName(game.state.prestigeCount.minus(1)));
</script>

{#if result}
	<Modal
		title={result.firstTime ? 'You finished it' : `${name} — ridden out`}
		closeLabel="Start the next run"
		onclose={() => game.dismissPrestigeResult()}
	>
		<p>
			<strong>{name}</strong> took the whole operation and left
			<strong><Num value={result.gained} tone="pearl" /></strong> Pearls behind it. Everything starts
			again at the Pond, and you keep the Fishdex and the Pearls.
		</p>
		{#if ridden}
			<p class="faint small">{ridden.blurb}</p>
		{/if}

		{#if result.firstTime}
			{#if result.jellyFree}
				<div class="gag">
					<p class="punch">Don’t be too Jelly</p>
					<p class="small">
						You got from the Pond to the Ocean and back without landing a single jellyfish. Nobody
						does that. Everyone else is going to be — well.
					</p>
				</div>
			{:else}
				<div class="gag mild">
					<p class="punch">Nothing but jelly to show for it</p>
					<p class="small">
						You did land jellyfish. Quite a lot of them. They were worth exactly nothing, and there
						was a version of this run where you avoided every last one — and got a better joke.
					</p>
				</div>
			{/if}
		{/if}
	</Modal>
{/if}

<style>
	.gag {
		border: 1px solid var(--brass);
		border-radius: var(--radius-sm);
		padding: 0.75rem;
		background: rgba(242, 181, 68, 0.12);
		display: grid;
		gap: 0.35rem;
	}

	.gag.mild {
		border-color: var(--edge);
		background: rgba(4, 16, 27, 0.6);
	}

	.punch {
		font-size: 1.15rem;
		font-weight: 700;
		letter-spacing: 0.01em;
	}

	.small {
		font-size: 0.8rem;
		color: var(--ink-dim);
	}
</style>
