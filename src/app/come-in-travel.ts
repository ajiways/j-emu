import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { Hero } from "../modules/character/domain/hero.ts";
import type { CombatPort } from "../modules/combat/ports/combat-port.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { Clock } from "../shared/kernel/clock.ts";
import { ProtocolError } from "../modules/jugger-wire/application/protocol-error.ts";
import { requireNoActiveFight } from "../modules/jugger-wire/commands/oa/require-no-active-fight.ts";
import { InstanceDeniedError } from "../modules/instance/domain/instance-denied-error.ts";
import { PartyDeniedError } from "../modules/party/domain/party-denied-error.ts";
import type { Area } from "../modules/world/domain/area.ts";
import { MissingLinkError } from "../modules/world/domain/missing-link-error.ts";
import {
  addTravelSeconds,
  travelFtime,
  travelLockActive,
  waitLockError,
  waitLockSeconds,
} from "../modules/world/domain/travel-ftime.ts";
import type { WorldService } from "../modules/world/domain/world-service.ts";
import type { InstanceDesk, InstanceTravelPlan } from "./instance-desk.ts";
import { leftoverOpenStore } from "../modules/quests/domain/quest-script-leftover.ts";
import type { QuestScriptEffect } from "../modules/quests/domain/quest-script-effect.ts";

const SLICE_SPEED = 0;
const OVERLOAD_ERROR = "Вы не можете перемещаться, т.к. рюкзак перегружен!";

export type ComeInMove = Readonly<{
  fromAreaId: string;
  toAreaId: string;
  fromCopyId: number | null;
  plan: InstanceTravelPlan;
}>;

export function requireStoreAreaCode(area: Pick<Area, "id" | "code">): void {
  if (area.code !== "store") {
    throw new ProtocolError(204, `area ${area.id} is not a store`);
  }
}

export class ComeInTravel {
  constructor(
    private readonly characters: CharacterService,
    private readonly inventory: InventoryService,
    private readonly world: WorldService,
    private readonly combat: CombatPort,
    private readonly clock: Clock,
    private readonly instances: InstanceDesk,
  ) {}

  async move(accountId: number, locked: Hero, destAreaId: string): Promise<ComeInMove> {
    return this.travelTo(accountId, locked, destAreaId, false);
  }

  async moveToStore(accountId: number, locked: Hero, areaId: number): Promise<ComeInMove> {
    if (!Number.isInteger(areaId) || areaId <= 0) {
      throw new ProtocolError(204, "OPEN_STORE areaId must be a positive integer");
    }
    return this.travelTo(accountId, locked, String(areaId), true);
  }

  private async travelTo(
    accountId: number,
    locked: Hero,
    destAreaId: string,
    requireStore: boolean,
  ): Promise<ComeInMove> {
    try {
      await requireNoActiveFight(this.combat, accountId);
      const load = await this.inventory.bagLoad({ characterId: locked.id });
      if (load.amount > load.amountMax) throw new ProtocolError(204, OVERLOAD_ERROR);
      const now = this.clock.now();
      if (travelLockActive(locked.moveReadyAt, now) && locked.moveReadyAt) {
        throw new ProtocolError(204, waitLockError(waitLockSeconds(locked.moveReadyAt, now)));
      }
      await this.world.requireLink(locked.areaId, destAreaId);
      const dest = await this.world.area(destAreaId);
      if (requireStore) requireStoreAreaCode(dest);
      await this.characters.syncResources({ characterId: locked.id });
      const ftime = travelFtime(dest.ftimeMax, SLICE_SPEED);
      const fromAreaId = locked.areaId;
      const fromCopyId = locked.instanceCopyId;
      const plan = await this.instances.prepareTravel(locked, dest.id);
      await this.characters.setArea({
        characterId: locked.id,
        areaId: dest.id,
        moveReadyAt: ftime > 0 ? addTravelSeconds(this.clock.now(), ftime) : null,
        instanceCopyId: plan.copyId,
      });
      return { fromAreaId, toAreaId: dest.id, fromCopyId, plan };
    } catch (error) {
      if (error instanceof MissingLinkError) throw new ProtocolError(203, error.message);
      if (error instanceof InstanceDeniedError)
        throw new ProtocolError(error.status, error.message);
      if (error instanceof PartyDeniedError) throw new ProtocolError(2, error.message);
      throw error;
    }
  }
}

export async function applyOpenStoreLeftover(
  travel: ComeInTravel,
  accountId: number,
  locked: Hero,
  effects: readonly QuestScriptEffect[],
): Promise<ComeInMove | null> {
  const store = leftoverOpenStore(effects);
  if (!store) return null;
  return travel.moveToStore(accountId, locked, store.areaId);
}
