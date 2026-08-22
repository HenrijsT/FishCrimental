<script lang="ts">
	import { progressBar } from '$lib/functions_generic.js';
</script>

<!--	New progress bar-->

<div class="outer">
	<div class="inner" style="width: {$progressBar}%"></div>
</div>

<style>
	.inner,
	.outer {
		width: 40px;
		height: 20px;
		border-radius: 10px;
	}
	/* Customize outer bar*/
	.outer {
		width: 90vw;
		margin: 20px auto;
		background-color: transparent;
		border: 1px solid darkblue;
	}

	/* Customize inner bar*/
	.inner {
		width: 0;
		max-width: 100vw;
		background-color: blue;
	}
</style>
