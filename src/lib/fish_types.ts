import { writable, type Writable } from 'svelte/store';
import Decimal from 'break_eternity.js';

//TODO: Jelly fish description opens up during the gameplay. After finishing the game -
// A popup shows up about you not having any Jelly fish with "Don't be too Jelly" :D

export enum FishType {
	Small = 'Small',
	Medium = 'Medium',
	Large = 'Large',
	Shark = 'Shark',
	Erotic = 'Erotic',
	Jelly = 'Jelly'
}

export const fishTypeCurrentCount: Map<FishType, Writable<Decimal>> = new Map();

Object.values(FishType).forEach((i) => fishTypeCurrentCount.set(i, writable(new Decimal(0))));

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
