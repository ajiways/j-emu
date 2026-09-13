import { instanceConf, instanceCreatedChat } from "../modules/instance/domain/instance-wire.ts";
import {
  clearProgress,
  progressFinish,
} from "../modules/instance/domain/dungeon-clear-progress.ts";
import type { DungeonDefinition } from "../modules/catalog/domain/dungeon-definition.ts";
import type { InstanceService } from "../modules/instance/application/instance-service.ts";
import type { InstanceTravelPlan, InstanceDeskDeps } from "./instance-desk.ts";

export async function decorateInstanceComeIn(
  deps: Pick<InstanceDeskDeps, "instances" | "partySnapshot" | "chat">,
  blocks: Readonly<Record<string, unknown>>,
  plan: InstanceTravelPlan,
  accountId: number,
  heroId: number,
): Promise<Readonly<Record<string, unknown>>> {
  const conf = await instanceConfForPlan(deps.instances, plan);
  if (!plan.enter && conf === null) return blocks;
  const extra: Record<string, unknown> = { ...blocks };
  if (conf !== null) extra["common|instance_conf"] = conf;
  if (!plan.enter) return extra;
  if (plan.autoParty) {
    const party = await deps.partySnapshot.restore(heroId);
    if (!party) throw new Error(`Auto-party chrome for hero ${heroId} is missing`);
    extra["party|create"] = { status: 100 };
    extra["party|members"] = party["party|members"];
    extra["party|settings"] = party["party|settings"];
    extra["party|bag"] = party["party|bag"];
  }
  if (plan.enter.created) {
    await deps.chat.deliverSystem(
      accountId,
      instanceCreatedChat(plan.enter.dungeon.title, plan.enter.dungeon.durationSec),
    );
  }
  return extra;
}

async function instanceConfForPlan(
  instances: InstanceService,
  plan: InstanceTravelPlan,
): Promise<ReturnType<typeof instanceConf> | null> {
  if (plan.enter) {
    return confFromDungeon(plan.enter.dungeon, await instances.killedSpawnKeys(plan.enter.copy.id));
  }
  if (plan.copyId === null) return null;
  const copy = await instances.getCopy(plan.copyId);
  if (!copy) throw new Error(`Instance copy ${plan.copyId} is missing`);
  if (copy.copyType === "bg") return null;
  const dungeon = await instances.dungeonByArtikul(copy.artikulId);
  if (!dungeon) throw new Error(`Dungeon artikul ${copy.artikulId} is missing`);
  return confFromDungeon(dungeon, await instances.killedSpawnKeys(copy.id));
}

function confFromDungeon(
  dungeon: DungeonDefinition,
  killedKeys: readonly string[],
): ReturnType<typeof instanceConf> {
  if (!dungeon.hasClear) return instanceConf(dungeon.artikulId, false, null);
  return instanceConf(dungeon.artikulId, true, {
    finish: progressFinish(dungeon),
    value: clearProgress(dungeon, new Set(killedKeys)),
  });
}
