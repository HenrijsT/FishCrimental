<script lang="ts">
	import { game } from '$lib/game/state.svelte';
	import { sources } from '$lib/fishing_sources';
	import type { TabId } from '$lib/game/guide';

	interface Props {
		onnavigate: (tab: TabId) => void;
	}

	let { onnavigate }: Props = $props();

	const from = $derived(game.strandedFrom);
</script>

{#if from}
	<div class="banner" role="status">
		<p>
			The tank ran dry, so you are working the
			<strong>{sources[game.state.activeSource].name}</strong> instead of the
			<strong>{sources[from].name}</strong>. Nothing was lost — the crew simply came inshore.
		</p>
		<div class="actions">
			<button
				onclick={() => {
					onnavigate('harbour');
					game.dismissStranded();
				}}>Fuel up</button
			>
			<button onclick={() => game.dismissStranded()}>Dismiss</button>
		</div>
	</div>
{/if}

<style>
	.banner {
		display: flex;
		flex-wrap: wrap;
		gap: var(--gap);
		align-items: center;
		justify-content: space-between;
		border: 1px solid var(--brass-dim);
		border-left-width: 3px;
		border-radius: var(--radius-sm);
		background: rgba(242, 181, 68, 0.1);
		padding: 0.55rem 0.75rem;
	}

	p {
		flex: 1;
		min-width: 14rem;
		font-size: 0.82rem;
	}

	.actions {
		display: flex;
		gap: 0.4rem;
	}

	button {
		font-size: 0.75rem;
		padding: 0.25rem 0.6rem;
	}
</style>
