<script lang="ts">
    import Big from 'big.js';
    import {Coin} from "../lib/currencies";

    let testCoin = new Coin();
    let fullValue = testCoin.marketCoin;
    fullValue = fullValue.plus(.0007);

</script>

<h1>Welcome to SvelteKit {fullValue.toFixed(3)}</h1>
<p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation</p>
