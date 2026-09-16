import type { UserBagBlock } from "./user-bag-block.ts";
import type { UserConfBlock } from "./user-conf-block.ts";
import type { UserMagicBlock } from "./user-magic-block.ts";
import type { UserPocketBlock } from "./user-pocket-block.ts";
import type { UserSkillsBlock } from "./user-skills-block.ts";
import type { UserUnitframeBlock } from "./user-unitframe-block.ts";
import type { UserViewBlock } from "./user-view-block.ts";
import type { HeroStateBlock } from "./hero-state-block.ts";

export function equipmentMutationBlocks(
  bag: UserBagBlock,
  view: UserViewBlock,
  magic: UserMagicBlock,
  pocket: UserPocketBlock,
  skills: UserSkillsBlock,
  unitframe: UserUnitframeBlock,
  conf: UserConfBlock,
  state: HeroStateBlock,
): Readonly<Record<string, unknown>> {
  return {
    "common|action": { status: 100 },
    "user|bag": bag,
    "user|view": view,
    "user|magic": magic,
    "user|pocket": pocket,
    "user|skills": skills,
    "user|unitframe": unitframe,
    "user|conf": conf,
    state,
  };
}
