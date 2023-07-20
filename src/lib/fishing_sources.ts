export enum FishingSources {
	Pond = 'Pond',
	Lake = 'Lake',
	River = 'River',
	Stream = 'Stream',
	Offshore = 'Offshore',
	Sea = 'Sea',
	Ocean = 'Ocean',
	Lagoon = 'Lagoon'
}

interface Source {
	name: string;
	description: string;
}

export const sources = {
	[FishingSources.Pond]: {
		name: 'Pond',
		description:
			' It is a small, still body of freshwater often found in parks or natural settings. Ponds are home to various aquatic plants and animals, making them an ideal spot for leisurely fishing.'
	},
	[FishingSources.Lake]: {
		name: 'Lake',
		description:
			'A lake is a larger body of water compared to a pond, usually freshwater and surrounded by land. Lakes offer a diverse range of fish species, making them popular fishing destinations for both recreational and sport anglers.'
	},
	[FishingSources.River]: {
		name: 'River',
		description:
			'A river is a natural flowing watercourse, typically originating from a source like a spring or glacier. Rivers are abundant in fish, providing opportunities for different fishing techniques such as fly fishing and baitcasting.'
	},
	[FishingSources.Stream]: {
		name: 'Stream',
		description:
			'Similar to rivers, streams are smaller flowing bodies of water. They often originate from springs or runoff and can be found in various landscapes. Streams are known for their fast-flowing water and can be challenging yet rewarding for anglers.'
	},
	[FishingSources.Offshore]: {
		name: 'Offshore',
		description:
			'Offshore fishing refers to fishing in deep ocean waters, away from the coastline. It involves targeting larger marine species like tuna, marlin, and swordfish. Offshore fishing is typically done on boats equipped to handle the open sea.'
	},
	[FishingSources.Sea]: {
		name: 'Sea',
		description:
			"The sea refers to the vast expanse of saltwater that covers much of the Earth's surface. Sea fishing involves various techniques and can yield a diverse range of fish species, depending on the region and habitat."
	},
	[FishingSources.Ocean]: {
		name: 'Ocean',
		description:
			' The ocean is the largest body of water on Earth, comprising five major basins: the Atlantic, Pacific, Indian, Southern, and Arctic Oceans. Ocean fishing offers a wide array of opportunities, from coastal fishing to deep-sea expeditions.'
	},
	[FishingSources.Lagoon]: {
		name: 'Lagoon',
		description:
			'A lagoon is a shallow body of water separated from larger bodies of water by sandbars, coral reefs, or other natural barriers. Lagoons provide a unique fishing environment, often with calmer waters and distinct fish species.'
	}
} satisfies Record<FishingSources, Source>;
