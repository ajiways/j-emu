import type { UserBagBlock } from "./user-bag-block.ts";
import type { HeroStateBlock } from "./hero-state-block.ts";

export function auctionLotAddMutation(
  bag: UserBagBlock,
  state: HeroStateBlock,
): Readonly<Record<string, unknown>> {
  return {
    "auction|lot_add": { status: 100 },
    "user|bag": bag,
    state,
  };
}

export function auctionBidMutation(
  lotId: number,
  bidGold: number,
  bag: UserBagBlock,
  state: HeroStateBlock,
): Readonly<Record<string, unknown>> {
  return {
    "auction|bid": { status: 100, lot_id: lotId, bid: bidGold },
    "user|bag": bag,
    state,
  };
}

export function auctionBuyoutMutation(
  lotBlock: object,
  bag: UserBagBlock,
  state: HeroStateBlock,
): Readonly<Record<string, unknown>> {
  return {
    "auction|buyout": { status: 100 },
    "common|dummy": { status: 100 },
    "auction|lot": lotBlock,
    "user|bag": bag,
    state,
  };
}

export function auctionCancelMutation(
  myLot: object,
  bag: UserBagBlock,
  state: HeroStateBlock,
): Readonly<Record<string, unknown>> {
  return {
    "auction|cancel": { status: 100 },
    "auction|my_lot": myLot,
    "user|bag": bag,
    state,
  };
}
