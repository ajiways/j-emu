import type { BootstrapReadModel } from "./bootstrap-read-model.ts";
import { fightInfoBlock } from "./fight-info-block.ts";
import type { FightResultInfo } from "../../combat/domain/fight-result-info.ts";

export async function buildFightFinishBlocks(
  bootstrap: BootstrapReadModel,
  accountId: number,
  info: FightResultInfo | null,
  areaTitle: string | null,
): Promise<Readonly<Record<string, unknown>>> {
  const blocks: Record<string, unknown> = {
    "fight|finish": { status: 100 },
    "fight|conf": { expire: 0 },
    "user|unitframe": await bootstrap.unitframe(accountId),
    "user|bag": await bootstrap.bag(accountId),
    "user|view": await bootstrap.view(accountId),
    "user|magic": await bootstrap.magic(accountId),
    "user|skills": await bootstrap.skills(accountId),
    state: await bootstrap.state(accountId),
  };
  if (info) {
    if (!areaTitle) throw new Error(`Fight ${info.fightId} area title is required`);
    blocks["fight|info"] = fightInfoBlock(info, areaTitle);
  }
  return blocks;
}
