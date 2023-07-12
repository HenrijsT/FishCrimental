<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { tweened } from 'svelte/motion';
	  import { linear } from 'svelte/easing';
	  import { get } from 'svelte/store';
	  import { smallFishCount, mediumFishCount, largeFishCount, fishAction } from '$lib/fishes';
    import { marketCoinCount, sellFish } from '$lib/market_coins';

    const progress = tweened(1000, {
		  duration: 5000,
		  easing: linear
	  });
    let count = 0;
    let timer: number;

  
    const handleMouseDown = () => {
      progress.set(0,{duration:0});
      progress.set(1000);
      timer = setInterval(() => {
        progress.set(0,{duration:0});
        progress.set(1000);
        fishAction();
      }, 5000);
    };
  
    const handleMouseUp = () => {
      clearInterval(timer);
      progress.set(0);
    };
  
    onDestroy(() => {
      clearInterval(timer);
    });
  </script>
  
<body>
  <progress value={$progress} max=1000/>

  <button on:mousedown={handleMouseDown} on:mouseup={handleMouseUp} on:touchstart={handleMouseDown} on:touchend={handleMouseUp}>
    Fish
  </button>

  Small fishes: {$smallFishCount.toFixed(0)}
  Medium fishes: {$mediumFishCount.toFixed(0)}
  Large fishes: {$largeFishCount.toFixed(0)}

  <button on:click={sellFish}>
    Sell
  </button>

  market Coins: {$marketCoinCount.toFixed(0)}

  <button on:click={() => smallFishCount.set($smallFishCount.plus(10))}>
    Add Fishes
  </button>
  <button on:click={fishAction}>
    testFishing
  </button>

</body>
  
  <style>
    button {
      padding: 8px 16px;
      font-size: 16px;
    }

    progress {
		display: block;
		width: 100%;
	}

  </style>
  