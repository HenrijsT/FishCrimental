<script lang="ts">
	import { game } from '$lib/game/state.svelte';
	import LipfishModal from './LipfishModal.svelte';
	import OfflineModal from './OfflineModal.svelte';
	import PrestigeModal from './PrestigeModal.svelte';

	/**
	 * The single place a modal can appear.
	 *
	 * Renders at most one, in the priority `game.activeModal` decides, so the
	 * rest queue behind it rather than stacking at the same z-index. Dismissing
	 * the front one reveals the next.
	 */
	const active = $derived(game.activeModal);
</script>

{#if active === 'offline'}
	<OfflineModal />
{:else if active === 'prestige'}
	<PrestigeModal />
{:else if active === 'lipfish'}
	<LipfishModal />
{/if}
