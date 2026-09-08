import type { CharacterService } from "../../../character/application/character-service.ts";
import type { CombatPort } from "../../../combat/ports/combat-port.ts";
import type { InventoryService } from "../../../inventory/domain/inventory-service.ts";
import type { Clock } from "../../../../shared/kernel/clock.ts";
import type { UnitOfWork } from "../../../../shared/kernel/unit-of-work.ts";
import { MissingLinkError } from "../../../world/domain/missing-link-error.ts";
import {
  addTravelSeconds,
  travelFtime,
  travelLockActive,
  waitLockError,
  waitLockSeconds,
} from "../../../world/domain/travel-ftime.ts";
import type { WorldService } from "../../../world/domain/world-service.ts";
import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import type { OaCommand, OaCommandContext, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";
import { requireNoActiveFight } from "./require-no-active-fight.ts";
import type { PresenceFanout } from "../../application/presence-fanout.ts";

const SLICE_SPEED = 0;
const OVERLOAD_ERROR = "Вы не можете перемещаться, т.к. рюкзак перегружен!";

type ComeInRequest = Readonly<{ areaId: string }>;

export class ComeInCommand implements OaCommand {
  static readonly key = "common|object:COME_IN";
  readonly key = ComeInCommand.key;

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly bootstrap: BootstrapReadModel,
    private readonly characters: CharacterService,
    private readonly inventory: InventoryService,
    private readonly world: WorldService,
    private readonly combat: CombatPort,
    private readonly clock: Clock,
    private readonly presence: PresenceFanout,
  ) {}

  decode(envelope: ObjectActionEnvelope): ComeInRequest {
    const form = envelope.form;
    if (!form) throw new ProtocolError(203, "некуда идти");
    const raw = form["area_id"];
    if (typeof raw !== "number" && typeof raw !== "string") {
      throw new ProtocolError(203, "некуда идти");
    }
    const areaId = String(raw);
    if (!areaId) throw new ProtocolError(203, "некуда идти");
    return { areaId };
  }

  async handle(context: OaCommandContext, request: ComeInRequest): Promise<object> {
    try {
      const moved = await this.unitOfWork.run(async () => {
        const locked = await this.characters.lockByAccountId(context.accountId);
        await requireNoActiveFight(this.combat, context.accountId);
        const load = await this.inventory.bagLoad({ characterId: locked.id });
        if (load.amount > load.amountMax) throw new ProtocolError(204, OVERLOAD_ERROR);
        const now = this.clock.now();
        if (travelLockActive(locked.moveReadyAt, now) && locked.moveReadyAt) {
          throw new ProtocolError(204, waitLockError(waitLockSeconds(locked.moveReadyAt, now)));
        }
        await this.world.requireLink(locked.areaId, request.areaId);
        const dest = await this.world.area(request.areaId);
        await this.characters.syncResources({ characterId: locked.id });
        const ftime = travelFtime(dest.ftimeMax, SLICE_SPEED);
        const fromAreaId = locked.areaId;
        await this.characters.setArea({
          characterId: locked.id,
          areaId: dest.id,
          moveReadyAt: ftime > 0 ? addTravelSeconds(this.clock.now(), ftime) : null,
        });
        return {
          fromAreaId,
          toAreaId: dest.id,
          blocks: await this.bootstrap.travelMutation(context.accountId, "COME_IN"),
        };
      });
      await this.presence.afterMove(context.accountId, moved.fromAreaId, moved.toAreaId);
      return moved.blocks;
    } catch (error) {
      if (error instanceof MissingLinkError) throw new ProtocolError(203, error.message);
      throw error;
    }
  }

  encode(response: object): OaEncodedResponse {
    return { kind: "flat", blocks: response };
  }

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    try {
      return this.encode(await this.handle({ accountId }, this.decode(envelope)));
    } catch (error) {
      if (error instanceof MissingLinkError) throw new ProtocolError(203, error.message);
      throw error;
    }
  }
}
