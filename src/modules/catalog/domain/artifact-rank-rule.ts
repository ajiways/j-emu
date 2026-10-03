/** The honor rank an item asks for: to be bought, to be worn, or both (the card's «Ограничения»). */
export type ArtifactRankRule = Readonly<{ rank: number; buy: boolean; wear: boolean }>;
