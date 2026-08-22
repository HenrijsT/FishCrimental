<script lang="ts">
	import { onMount } from 'svelte';
	import { game } from '$lib/game/state.svelte';
	import CastPanel from '$lib/components/CastPanel.svelte';
	import CatchTicker from '$lib/components/CatchTicker.svelte';
	import HoldPanel from '$lib/components/HoldPanel.svelte';
	import OfflineModal from '$lib/components/OfflineModal.svelte';
	import SourcePicker from '$lib/components/SourcePicker.svelte';
	import TopBar from '$lib/components/TopBar.svelte';

	onMount(() => {
		game.init();

		const save = () => game.save();
		document.addEventListener('visibilitychange', save);
		window.addEventListener('pagehide', save);

		return () => {
			save();
			game.stop();
			document.removeEventListener('visibilitychange', save);
			window.removeEventListener('pagehide', save);
		};
	});
</script>

<svelte:head>
	<title>FishCrimental</title>
	<meta
		name="description"
		content="A fishing incremental. Cast a line, sell the catch, hire a crew, and work your way from a pond to the open ocean."
	/>
</svelte:head>

<div class="shell">
	<TopBar />

	<main class="grid">
		<div class="column">
			<SourcePicker />
			<CastPanel />
			<HoldPanel />
		</div>
		<div class="column side">
			<CatchTicker />
		</div>
	</main>
</div>

<OfflineModal />

<style>
	.shell {
		max-width: 62rem;
		margin: 0 auto;
		padding: 1rem 1rem 3rem;
		display: grid;
		gap: 1rem;
	}

	.grid {
		display: grid;
		gap: 1rem;
		align-items: start;
	}

	.column {
		display: grid;
		gap: 1rem;
		align-content: start;
	}

	@media (min-width: 52rem) {
		.grid {
			grid-template-columns: minmax(0, 2fr) minmax(14rem, 1fr);
		}

		.side {
			position: sticky;
			top: 1rem;
		}
	}
</style>
