<script lang="ts">
	import { onMount } from 'svelte';
	import { game } from '$lib/game/state.svelte';
	import CastPanel from '$lib/components/CastPanel.svelte';
	import CatchTicker from '$lib/components/CatchTicker.svelte';
	import HoldPanel from '$lib/components/HoldPanel.svelte';
	import OfflineModal from '$lib/components/OfflineModal.svelte';
	import SourcePicker from '$lib/components/SourcePicker.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import UpgradePanel from '$lib/components/UpgradePanel.svelte';

	let active = $state('water');

	const tabs = $derived([
		{ id: 'water', label: 'Water' },
		{ id: 'gear', label: 'Gear' }
	]);

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

	<div class="grid">
		<aside class="rig">
			<CastPanel />
			<HoldPanel />
			<CatchTicker />
		</aside>

		<main class="content">
			<Tabs {tabs} {active} onselect={(id) => (active = id)} />

			<div id="panel-{active}" role="tabpanel" aria-labelledby="tab-{active}" tabindex="-1">
				{#if active === 'water'}
					<SourcePicker />
				{:else if active === 'gear'}
					<UpgradePanel />
				{/if}
			</div>
		</main>
	</div>
</div>

<OfflineModal />

<style>
	.shell {
		max-width: 66rem;
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

	.rig,
	.content {
		display: grid;
		gap: 0.75rem;
		align-content: start;
		min-width: 0;
	}

	[role='tabpanel']:focus {
		outline: none;
	}

	@media (min-width: 54rem) {
		.grid {
			grid-template-columns: minmax(15rem, 1fr) minmax(0, 1.6fr);
		}

		.rig {
			position: sticky;
			top: 1rem;
		}
	}
</style>
