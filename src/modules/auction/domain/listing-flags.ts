const FLAG_MY_LOT = 1;
const FLAG_MY_BID = 2;

export function lotFlags(
  ownerHeroId: number,
  bidderHeroId: number | null,
  viewerId: number,
): number {
  let flags = 0;
  if (ownerHeroId === viewerId) flags |= FLAG_MY_LOT;
  if (bidderHeroId === viewerId) flags |= FLAG_MY_BID;
  return flags;
}
