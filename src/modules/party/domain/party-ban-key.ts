export function partyBanKey(partyId: number, targetHeroId: number): string {
  let hash = 0;
  const source = `party:${partyId}:${targetHeroId}`;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(32, "0").slice(0, 32);
}
