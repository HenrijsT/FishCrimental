<script lang="ts">
	import FishCount from '$lib/components/FishCount.svelte';
	import { FishType, fishAction, fishTypeCurrentCount } from '$lib/fish_types';
	import { handleMouseDown, handleMouseUp, progressBar } from '$lib/functions_generic';
	import { marketCoinCount, sellFish } from '$lib/market_coins';
	import '$lib/random_picker';
	import '$lib/fishes';

	let smallFishCount = fishTypeCurrentCount.get(FishType.Small);
	let testCheck = false;
</script>

<body>
	<progress value={$progressBar} max="1000" />

	<button
		on:mousedown={handleMouseDown}
		on:mouseup={handleMouseUp}
		on:touchstart={handleMouseDown}
		on:touchend={handleMouseUp}
	>
		Fish
	</button>

	{#each [...fishTypeCurrentCount.entries()] as [key, val]}
		{#if [FishType.Small, FishType.Medium, FishType.Large, FishType.Shark].indexOf(key) >= 0}
			<FishCount count={val}>/ {FishType[key]} Fish:</FishCount>
		{/if}
	{/each}

	- market Coins: {$marketCoinCount.toFixed(0)} -

	<button on:click={sellFish}> Sell </button>
<div>
	<button on:click={() => marketCoinCount.set($marketCoinCount.plus(10000))}> Add Coins </button>
</div>
<div>
	<button on:click={fishAction}> testFishing </button>
</div>

</body>

<!-- EXAMPLES. TODO: REMOVE -->
<!--   {#each [...fishTypeCurrentCount.entries()] as [key, val]} 
    {#if key != FishType.Erotic}
      <FishCount count={val}>{FishType[key]}:</FishCount>
    {:else if key == 3 && testCheck }
      <FishCount count={val}>{FishType[key]}:</FishCount>
    {/if}
  {/each} -->

<!--   <button on:click={() => testCheck = !testCheck}> showErotic </button> -->
