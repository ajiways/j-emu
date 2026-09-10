const FLAG_MY_LOT = 1;
const FLAG_MY_BID = 2;
const FLAG_WHOLE_STACK = 4;

export function lotFlags(
  ownerHeroId: number,
  bidderHeroId: number | null,
  viewerId: number,
  wholeStackOnly: 0 | 1,
): number {
  let flags = 0;
  if (ownerHeroId === viewerId) flags |= FLAG_MY_LOT;
  if (bidderHeroId === viewerId) flags |= FLAG_MY_BID;
  if (wholeStackOnly === 1) flags |= FLAG_WHOLE_STACK;
  return flags;
}
