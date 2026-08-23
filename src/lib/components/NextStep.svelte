<script lang="ts">
	import { availableTabs, nextStep, type TabId } from '$lib/game/guide';
	import { game } from '$lib/game/state.svelte';

	interface Props {
		onnavigate: (tab: TabId) => void;
	}

	let { onnavigate }: Props = $props();

	const step = $derived(nextStep(game.state));

	/**
	 * Only offer the jump where there is somewhere to land.
	 *
	 * A hint can name a tab the player has not unlocked yet: the opening
	 * "list them" line points at Shore, and Shore does not appear until the
	 * third cast — so on casts one and two "Take me there" set the tab and the
	 * effect in `+page.svelte` snapped it straight back to Water. That is the
	 * one moment the hint exists for.
	 */
	const jumpTo = $derived(
		step?.tab !== undefined && availableTabs(game.state).some((tab) => tab.id === step.tab)
			? step.tab
			: null
	);
</script>

{#if step}
	<div class="step">
		<span class="mark" aria-hidden="true">▸</span>
		<p>{step.text}</p>
		{#if jumpTo}
			<button onclick={() => onnavigate(jumpTo)}>Take me there</button>
		{/if}
	</div>
{/if}

<style>
	.step {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		flex-wrap: wrap;
		padding: 0.5rem 0.75rem;
		border: 1px solid rgba(79, 209, 197, 0.4);
		border-left-width: 3px;
		border-radius: var(--radius-sm);
		background: rgba(79, 209, 197, 0.08);
	}

	.mark {
		color: var(--foam);
	}

	p {
		flex: 1;
		min-width: 12rem;
		font-size: 0.83rem;
	}

	button {
		font-size: 0.75rem;
		padding: 0.25rem 0.6rem;
	}
</style>
