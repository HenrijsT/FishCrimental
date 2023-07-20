import { get, writable, type Writable } from 'svelte/store';
import Big from 'big.js';
import { RandomIndex } from './random_picker';

//TODO: Jelly fish description opens up during the gameplay. After finishing the game -
// A popup shows up about you not having any Jelly fish with "Don't be too Jelly" :D

export enum FishType {
	Small,
	Medium,
	Large,
	Shark,
	Erotic,
	Jelly
}

export const fishTypeCurrentCount: Map<FishType, Writable<Big>> = new Map();

Object.values(FishType)
	.filter((t): t is FishType => typeof t !== 'string')
	.forEach((i) => fishTypeCurrentCount.set(i, writable(new Big(0))));

export const fishTypeBaseValue: Record<FishType, number> = {
	[FishType.Small]: 2,
	[FishType.Medium]: 5,
	[FishType.Large]: 10,
	[FishType.Shark]: 250,
	[FishType.Erotic]: 999,
	[FishType.Jelly]: 0
};

export const fishTypeBaseChance = new Map([
	[FishType.Small, 90],
	[FishType.Medium, 7],
	[FishType.Large, 2],
	[FishType.Shark, 1],
	[FishType.Erotic, 0]
]);

const fishTypeChanceIndex = new RandomIndex([...fishTypeBaseChance.entries()]);

export function fishAction() {
	const caughtFishType = fishTypeChanceIndex.pick();
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	fishTypeCurrentCount
		.get(caughtFishType)!
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		.set(get(fishTypeCurrentCount.get(caughtFishType)!).plus(1));
	console.log('I fished: ' + Object.values(FishType).at(caughtFishType) + ' fish!');
}

// test fish random picker
/*console.log('random fish:', fishTypeChanceIndex.pick());
  console.time("a");
  const picks: Record<string, number> = {};
  for (let i = 0; i < 100; i++) {
    const item = fishTypeChanceIndex.pick();
    picks[item] = (picks[item] || 0) + 1
  }
  console.timeEnd("a");
  console.log(picks);
  */
