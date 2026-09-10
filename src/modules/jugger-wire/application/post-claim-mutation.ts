import type { UserBagBlock } from "./user-bag-block.ts";
import type { HeroStateBlock } from "./hero-state-block.ts";

export function postPickMutation(
  list: object,
  bag: UserBagBlock,
  state: HeroStateBlock,
  deleteLetter: boolean,
): Readonly<Record<string, unknown>> {
  const blocks: Record<string, unknown> = {
    "post|pick": { status: 100 },
    "post|list": list,
    "user|bag": bag,
    state,
  };
  if (deleteLetter) blocks["post|delete"] = { status: 100 };
  return blocks;
}

export function postBatchPickMutation(
  list: object,
  bag: UserBagBlock,
  state: HeroStateBlock,
): Readonly<Record<string, unknown>> {
  return {
    "post|batch_pick": { status: 100 },
    "post|list": list,
    "user|bag": bag,
    state,
  };
}

export function postRetractMutation(
  list: object,
  bag: UserBagBlock,
  state: HeroStateBlock,
): Readonly<Record<string, unknown>> {
  return {
    "post|retract": { status: 100 },
    "post|list": list,
    "user|bag": bag,
    state,
  };
}
