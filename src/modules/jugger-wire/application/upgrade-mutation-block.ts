import type { GearUpgradeResult } from "../../inventory/domain/apply-gear-upgrade.ts";
import type { UserBagBlock } from "./user-bag-block.ts";
import type { UserSkillsBlock } from "./user-skills-block.ts";

export function upgradeMutation(
  result: GearUpgradeResult,
  bag: UserBagBlock,
  skills: UserSkillsBlock,
): Readonly<Record<string, unknown>> {
  return {
    "common|action": result.ok
      ? { status: 100, action: "UPGRADE" }
      : { action: "UPGRADE", status: 203, error: result.error },
    "user|bag": bag,
    "user|skills": skills,
  };
}
