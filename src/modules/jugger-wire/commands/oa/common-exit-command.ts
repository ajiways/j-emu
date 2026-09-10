import type { CharacterService } from "../../../character/application/character-service.ts";
import type { CombatPort } from "../../../combat/ports/combat-port.ts";
import type { InventoryService } from "../../../inventory/domain/inventory-service.ts";
import type { Clock } from "../../../../shared/kernel/clock.ts";
import type { UnitOfWork } from "../../../../shared/kernel/unit-of-work.ts";
import { canExitInterior } from "../../../world/domain/interior-exit.ts";
import type { WorldService } from "../../../world/domain/world-service.ts";
import {
  travelLockActive,
  waitLockError,
  waitLockSeconds,
} from "../../../world/domain/travel-ftime.ts";
import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import type { PresenceFanout } from "../../application/presence-fanout.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import { requireNoActiveFight } from "./require-no-active-fight.ts";
import type { InstanceDesk } from "../../../../app/instance-desk.ts";
import { InstanceDeniedError } from "../../../instance/domain/instance-denied-error.ts";

const OVERLOAD_ERROR = "Вы не можете перемещаться, т.к. рюкзак перегружен!";
const CANNOT_MOVE = "Перемещение невозможно!";

export class CommonExitCommand implements OaCommand {
  static readonly key = "common|exit";
  readonly key = CommonExitCommand.key;

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly bootstrap: BootstrapReadModel,
    private readonly characters: CharacterService,
    private readonly inventory: InventoryService,
    private readonly world: WorldService,
    private readonly combat: CombatPort,
    private readonly clock: Clock,
    private readonly presence: PresenceFanout,
    private readonly instances: InstanceDesk,
  ) {}

  async execute(accountId: number): Promise<OaEncodedResponse> {
    try {
      const moved = await this.unitOfWork.run(async () => {
        const locked = await this.characters.lockByAccountId(accountId);
        await requireNoActiveFight(this.combat, accountId);
        const load = await this.inventory.bagLoad({ characterId: locked.id });
        if (load.amount > load.amountMax) throw new ProtocolError(204, OVERLOAD_ERROR);
        const now = this.clock.now();
        if (travelLockActive(locked.moveReadyAt, now) && locked.moveReadyAt) {
          throw new ProtocolError(204, waitLockError(waitLockSeconds(locked.moveReadyAt, now)));
        }
        const current = await this.world.area(locked.areaId);
        if (!canExitInterior(current)) throw new ProtocolError(204, CANNOT_MOVE);
        const parent = await this.world.area(current.parentId);
        await this.characters.syncResources({ characterId: locked.id });
        const fromAreaId = locked.areaId;
        const fromCopyId = locked.instanceCopyId;
        const plan = await this.instances.prepareTravel(locked, parent.id);
        await this.characters.setArea({
          characterId: locked.id,
          areaId: parent.id,
          moveReadyAt: locked.moveReadyAt,
          instanceCopyId: plan.copyId,
        });
        return {
          fromAreaId,
          toAreaId: parent.id,
          fromCopyId,
          blocks: await this.bootstrap.travelMutation(accountId, "exit"),
        };
      });
      await this.presence.afterMove(accountId, moved.fromAreaId, moved.toAreaId, moved.fromCopyId);
      return { kind: "flat", blocks: moved.blocks };
    } catch (error) {
      if (error instanceof InstanceDeniedError) {
        throw new ProtocolError(error.status, error.message);
      }
      throw error;
    }
  }
}
