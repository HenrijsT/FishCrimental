<script lang="ts">
	import { BUY_AMOUNTS, game } from '$lib/game/state.svelte';
</script>

<div class="picker" role="group" aria-label="How many levels to buy at once">
	{#each BUY_AMOUNTS as amount (amount)}
		<button
			class:active={game.buyAmount === amount}
			aria-pressed={game.buyAmount === amount}
			onclick={() => (game.buyAmount = amount)}
		>
			{amount === 'max' ? 'Max' : `×${amount}`}
		</button>
	{/each}
</div>

<style>
	.picker {
		display: inline-flex;
		gap: 0.25rem;
	}

	button {
		padding: 0.2rem 0.55rem;
		font-size: 0.75rem;
	}

	.active {
		border-color: var(--brass);
		background: rgba(242, 181, 68, 0.16);
	}
</style>
