<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { tweened } from 'svelte/motion';
	  import { linear } from 'svelte/easing';

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
        count ++;
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

  <button on:mousedown={handleMouseDown} on:mouseup={handleMouseUp}>
    Increment ({count})
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
  