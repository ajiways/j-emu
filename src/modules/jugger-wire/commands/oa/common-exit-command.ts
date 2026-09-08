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
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import { requireNoActiveFight } from "./require-no-active-fight.ts";

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
  ) {}

  async execute(accountId: number): Promise<OaEncodedResponse> {
    const blocks = await this.unitOfWork.run(async () => {
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
      await this.characters.setArea({
        characterId: locked.id,
        areaId: parent.id,
        moveReadyAt: locked.moveReadyAt,
      });
      return this.bootstrap.travelMutation(accountId, "exit");
    });
    return { kind: "flat", blocks };
  }
}
