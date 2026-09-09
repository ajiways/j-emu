import type { UserBagBlock } from "./user-bag-block.ts";
import type { UserViewBlock } from "./user-view-block.ts";
import type { UserMagicBlock } from "./user-magic-block.ts";
import type { HeroStateBlock } from "./hero-state-block.ts";

export function storeRepairMutation(
  bag: UserBagBlock,
  view: UserViewBlock,
  magic: UserMagicBlock,
  state: HeroStateBlock,
): Readonly<Record<string, unknown>> {
  return {
    "store|repair": { status: 100 },
    "user|bag": bag,
    "user|view": view,
    "user|magic": magic,
    state,
  };
}
