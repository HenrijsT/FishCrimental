<script lang="ts">
	import { onMount } from 'svelte';
	import { game } from '$lib/game/state.svelte';
	import { TABS, availableTabs } from '$lib/game/guide';
	import AchievementsPanel from '$lib/components/AchievementsPanel.svelte';
	import CastPanel from '$lib/components/CastPanel.svelte';
	import CatchTicker from '$lib/components/CatchTicker.svelte';
	import CrewPanel from '$lib/components/CrewPanel.svelte';
	import Fishdex from '$lib/components/Fishdex.svelte';
	import HarbourPanel from '$lib/components/HarbourPanel.svelte';
	import HoldPanel from '$lib/components/HoldPanel.svelte';
	import LipfishModal from '$lib/components/LipfishModal.svelte';
	import NextStep from '$lib/components/NextStep.svelte';
	import OfflineModal from '$lib/components/OfflineModal.svelte';
	import PrestigeModal from '$lib/components/PrestigeModal.svelte';
	import PrestigePanel from '$lib/components/PrestigePanel.svelte';
	import SaveProblemBanner from '$lib/components/SaveProblemBanner.svelte';
	import SettingsPanel from '$lib/components/SettingsPanel.svelte';
	import SourcePicker from '$lib/components/SourcePicker.svelte';
	import StrandedBanner from '$lib/components/StrandedBanner.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import Toasts from '$lib/components/Toasts.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import UpgradePanel from '$lib/components/UpgradePanel.svelte';

	let active = $state('water');
	/** Set when a toast is tapped, so the panel can open and scroll to the thing. */
	let focus = $state<string | null>(null);
	/** Tabs the player has already seen, so a new one can announce itself once. */
	let seen = $state<string[]>(['water']);

	const tabs = $derived(
		availableTabs(game.state).map((tab) => ({
			id: tab.id,
			label: tab.label,
			badge:
				tab.id === 'pearls' && game.prestigeReady ? '!' : seen.includes(tab.id) ? undefined : 'new'
		}))
	);
	const current = $derived(TABS.find((tab) => tab.id === active));
	const isNew = $derived(current !== undefined && !seen.includes(current.id));

	// A tab can disappear again after a prestige; never strand the player on it.
	$effect(() => {
		if (!tabs.some((tab) => tab.id === active)) active = 'water';
	});

	function selectTab(id: string, target: string | null = null) {
		active = id;
		focus = target;
		if (typeof history !== 'undefined') {
			history.replaceState(history.state, '', `#${id}`);
		}
	}

	function markSeen() {
		if (current && !seen.includes(current.id)) seen = [...seen, current.id];
	}

	onMount(() => {
		const fromHash = location.hash.replace('#', '');
		if (TABS.some((tab) => tab.id === fromHash)) active = fromHash;

		game.init();

		const save = () => game.save();
		const onVisibility = () => (document.hidden ? game.save() : game.resume());

		document.addEventListener('visibilitychange', onVisibility);
		window.addEventListener('pagehide', save);

		return () => {
			save();
			game.stop();
			document.removeEventListener('visibilitychange', onVisibility);
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

<div class="shell" class:reduce-motion={game.state.settings.reduceMotion}>
	<TopBar />
	<SaveProblemBanner />
	<StrandedBanner onnavigate={(tab) => selectTab(tab)} />
	<NextStep onnavigate={(tab) => selectTab(tab)} />

	<div class="grid">
		<aside class="rig">
			<CastPanel />
			<HoldPanel />
			<CatchTicker />
		</aside>

		<main class="content">
			<Tabs {tabs} {active} onselect={(id) => selectTab(id)} />

			<div id="panel-{active}" role="tabpanel" aria-labelledby="tab-{active}" tabindex="-1">
				{#if isNew && current}
					<p class="blurb">
						{current.blurb}
						<button class="got-it" onclick={markSeen}>Got it</button>
					</p>
				{/if}

				{#if active === 'water'}
					<SourcePicker />
				{:else if active === 'gear'}
					<UpgradePanel />
				{:else if active === 'harbour'}
					<HarbourPanel />
				{:else if active === 'crew'}
					<CrewPanel />
				{:else if active === 'dex'}
					<Fishdex {focus} />
				{:else if active === 'pearls'}
					<PrestigePanel />
				{:else if active === 'records'}
					<AchievementsPanel {focus} />
				{:else if active === 'settings'}
					<SettingsPanel />
				{/if}
			</div>
		</main>
	</div>
</div>

<OfflineModal />
<PrestigeModal />
<LipfishModal />
<Toasts onnavigate={(tab, target) => selectTab(tab, target ?? null)} />

<style>
	.shell {
		max-width: 66rem;
		margin: 0 auto;
		padding: 1rem 1rem 3rem;
		display: grid;
		gap: 0.85rem;
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

	[role='tabpanel'] {
		display: grid;
		gap: 0.75rem;
	}

	[role='tabpanel']:focus {
		outline: none;
	}

	.blurb {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		font-size: 0.8rem;
		color: var(--ink-dim);
		padding: 0.5rem 0.7rem;
		border: 1px dashed var(--edge);
		border-radius: var(--radius-sm);
	}

	.got-it {
		font-size: 0.7rem;
		padding: 0.15rem 0.5rem;
	}

	@media (min-width: 54rem) {
		.grid {
			grid-template-columns: minmax(16rem, 1fr) minmax(0, 1.55fr);
		}

		.rig {
			position: sticky;
			top: 1rem;
		}
	}
</style>
