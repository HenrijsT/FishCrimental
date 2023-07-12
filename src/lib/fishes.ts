import { get, writable } from "svelte/store";
import Big from "big.js";

export const smallFishCount = writable(new Big("0"));
export const mediumFishCount = writable(new Big("0"));
export const largeFishCount = writable(new Big("0"));
export const exoticFishCount = writable(new Big("0"));

export enum FishType {
    Small,
    Medium,
    Large,
    Exotic
}

export const fishBaseValue: Record<FishType, number> = {
    [FishType.Small]: 2,
    [FishType.Medium]: 5,
    [FishType.Large]: 10,
    [FishType.Exotic]: 999
};

function getRandomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

export function fishAction() {
    let randomNumber = getRandomNumber(1, 100);
    if(randomNumber <= 90){
        smallFishCount.set(get(smallFishCount).plus(1));
    } else if ( randomNumber > 90 && randomNumber <=98) {
        mediumFishCount.set(get(mediumFishCount).plus(1));
    } else {
        largeFishCount.set(get(largeFishCount).plus(1));
    }
}
