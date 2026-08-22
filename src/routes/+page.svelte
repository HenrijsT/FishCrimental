<script lang="ts">
	import FishCount from '$lib/components/FishCount.svelte';
	import { FishType, fishTypeCurrentCount } from '$lib/fish_types';
	import { fishAction, handleMouseDown, handleMouseUp } from '$lib/functions_generic';
	import { marketCoinCount, sellFish } from '$lib/market_coins';
	import { FishingSources, sources } from '$lib/fishing_sources';
	import ProgressBars from '$lib/components/ProgressBars.svelte';

	let selectedSource: FishingSources = FishingSources.Pond;

	const sellable = [FishType.Small, FishType.Medium, FishType.Large, FishType.Shark];
</script>

<h1>FishCrimental</h1>

<label>
	Source:
	<select bind:value={selectedSource}>
		{#each Object.values(FishingSources) as source (source)}
			<option value={source}>{sources[source].name}</option>
		{/each}
	</select>
</label>

<ProgressBars />

<button
	on:mousedown={() => handleMouseDown(selectedSource)}
	on:mouseup={handleMouseUp}
	on:mouseleave={handleMouseUp}
	on:touchstart={() => handleMouseDown(selectedSource)}
	on:touchend={handleMouseUp}
>
	Hold to fish
</button>

<button on:click={() => fishAction(selectedSource)}>Cast once</button>

<ul>
	{#each [...fishTypeCurrentCount.entries()] as [key, val] (key)}
		{#if sellable.indexOf(key) >= 0}
			<li><FishCount count={val}>{key} Fish:</FishCount></li>
		{/if}
	{/each}
</ul>

<p>MarketCoins: {$marketCoinCount.toFixed(0)}</p>

<button on:click={sellFish}>Sell</button>
