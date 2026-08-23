<script lang="ts">
	// The theme belongs to this route, not to the layout. `src/base.css` is the
	// layout reset every document gets; `app.css` is what this game looks like.
	import '../app.css';
	import { onMount } from 'svelte';
	import { game } from '$lib/game/state.svelte';
	import { AUTO_FISHER } from '$lib/game/config';
	import { TABS, availableTabs, type TabId } from '$lib/game/guide';
	import AchievementsPanel from '$lib/components/AchievementsPanel.svelte';
	import AutoFisherPanel from '$lib/components/AutoFisherPanel.svelte';
	import CastPanel from '$lib/components/CastPanel.svelte';
	import CatchTicker from '$lib/components/CatchTicker.svelte';
	import CrewPanel from '$lib/components/CrewPanel.svelte';
	import Fishdex from '$lib/components/Fishdex.svelte';
	import HarbourPanel from '$lib/components/HarbourPanel.svelte';
	import HoldPanel from '$lib/components/HoldPanel.svelte';
	import MapPanel from '$lib/components/MapPanel.svelte';
	import MarketPanel from '$lib/components/MarketPanel.svelte';
	import PondPanel from '$lib/components/PondPanel.svelte';
	import ModalHost from '$lib/components/ModalHost.svelte';
	import NextStep from '$lib/components/NextStep.svelte';
	import PrestigePanel from '$lib/components/PrestigePanel.svelte';
	import SaveProblemBanner from '$lib/components/SaveProblemBanner.svelte';
	import SettingsPanel from '$lib/components/SettingsPanel.svelte';
	import ShorePanel from '$lib/components/ShorePanel.svelte';
	import SourcePicker from '$lib/components/SourcePicker.svelte';
	import StrandedBanner from '$lib/components/StrandedBanner.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import Toasts from '$lib/components/Toasts.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import UpgradePanel from '$lib/components/UpgradePanel.svelte';

	let active = $state<TabId>('water');
	/** Set when a toast is tapped, so the panel can open and scroll to the thing. */
	let focus = $state<string | null>(null);
	/** Tabs the player has already seen, so a new one can announce itself once. */
	let seen = $state<TabId[]>(['water']);

	const tabs = $derived(
		availableTabs(game.state).map((tab) => ({
			id: tab.id,
			label: tab.label,
			badge:
				tab.id === 'pearls' && game.prestigeReady ? '!' : seen.includes(tab.id) ? undefined : 'new'
		}))
	);
	// The rig appears just before it is affordable, the same way every other
	// surface in the game arrives when there is a reason to look at it.
	const showRig = $derived(
		game.state.autoFisher.gt(0) || game.state.lifetimeCoins.gte(AUTO_FISHER.baseCost * 0.5)
	);
	const current = $derived(TABS.find((tab) => tab.id === active));
	const isNew = $derived(current !== undefined && !seen.includes(current.id));

	// A tab can disappear again after a prestige; never strand the player on it.
	$effect(() => {
		if (!tabs.some((tab) => tab.id === active)) active = 'water';
	});

	function selectTab(id: TabId, target: string | null = null) {
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
		const known = TABS.find((tab) => tab.id === fromHash);
		if (known) active = known.id;

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

<!-- Everything behind an open dialog is inert: not focusable, not clickable,
     and hidden from the accessibility tree. -->
<div
	class="shell"
	class:reduce-motion={game.state.settings.reduceMotion}
	inert={game.activeModal !== null}
>
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
					<!-- The chart is the navigation; the list underneath is the detail.
					     Two surfaces on purpose: the map gives the water a shape and a
					     place, and the list carries the blocker reasons, cast times and
					     values that an SVG cannot say well — and guarantees every source
					     stays reachable by keyboard and by screen reader. -->
					<MapPanel />
					<SourcePicker />
				{:else if active === 'shore'}
					<ShorePanel />
				{:else if active === 'gear'}
					<UpgradePanel />
					{#if showRig}
						<AutoFisherPanel />
					{/if}
				{:else if active === 'harbour'}
					<HarbourPanel />
				{:else if active === 'crew'}
					<CrewPanel />
					<PondPanel />
				{:else if active === 'market'}
					<MarketPanel />
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

<ModalHost />

<div inert={game.activeModal !== null} class="contents">
	<Toasts onnavigate={(tab, target) => selectTab(tab, target ?? null)} />
</div>

<style>
	.contents {
		display: contents;
	}

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
