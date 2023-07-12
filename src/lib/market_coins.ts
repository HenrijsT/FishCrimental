import { get, writable } from "svelte/store";
import Big from "big.js";
import { smallFishCount, mediumFishCount, largeFishCount, fishBaseValue, FishType} from '$lib/fishes';

export const marketCoinCount = writable(new Big("0"));

export function sellFish() {
    let smallFishToSell = get(smallFishCount);
    let mediumFishToSell = get(mediumFishCount);
    let largeFishToSell = get(largeFishCount);

    marketCoinCount.set(get(marketCoinCount)
    .plus(smallFishToSell.times(fishBaseValue[FishType.Small]))
    .plus(mediumFishToSell.times(fishBaseValue[FishType.Medium]))
    .plus(largeFishToSell.times(fishBaseValue[FishType.Large]))
    );

    smallFishCount.set(new Big(0));
    mediumFishCount.set(new Big(0));
    largeFishCount.set(new Big(0));
}