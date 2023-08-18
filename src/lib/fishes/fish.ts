import type { FishType } from "$lib/fish_types";
import type { FishingSources } from "$lib/fishing_sources";

export interface Fish {
	name: string;
	category: FishType;
	sources: FishingSources[];
    baseChance: number;
	description: string;
}