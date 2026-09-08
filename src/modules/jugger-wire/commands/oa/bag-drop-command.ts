import type { CharacterService } from "../../../character/application/character-service.ts";
import type { CombatPort } from "../../../combat/ports/combat-port.ts";
import type { InventoryService } from "../../../inventory/domain/inventory-service.ts";
import { DropDeniedError } from "../../../inventory/domain/drop-denied-error.ts";
import type { UnitOfWork } from "../../../../shared/kernel/unit-of-work.ts";
import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import type { OaCommand, OaCommandContext, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";
import { requireNoActiveFight } from "./require-no-active-fight.ts";

type BagDropRequest = Readonly<{
  itemId: number;
  amount?: number;
}>;

export class BagDropCommand implements OaCommand {
  constructor(
    readonly key: "common|object:DROP" | "common|object:SELL",
    private readonly intent: "drop" | "sell",
    private readonly unitOfWork: UnitOfWork,
    private readonly bootstrap: BootstrapReadModel,
    private readonly characters: CharacterService,
    private readonly inventory: InventoryService,
    private readonly combat: CombatPort,
  ) {}

  decode(envelope: ObjectActionEnvelope): BagDropRequest {
    const form = envelope.form;
    if (!form) throw DropDeniedError.forIntent(this.intent);
    const raw = form["artifact_id"] ?? form["object_id"];
    if (typeof raw !== "number" && typeof raw !== "string") {
      throw DropDeniedError.forIntent(this.intent);
    }
    const itemId = Number(raw);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw DropDeniedError.forIntent(this.intent);
    }
    const amount = optionalAmount(envelope);
    return amount === undefined ? { itemId } : { itemId, amount };
  }

  async handle(context: OaCommandContext, request: BagDropRequest): Promise<object> {
    try {
      return await this.unitOfWork.run(async () => {
        const locked = await this.characters.lockByAccountId(context.accountId);
        await this.characters.syncResources({ characterId: locked.id });
        const hero = await this.characters.lockByAccountId(context.accountId);
        await requireNoActiveFight(this.combat, context.accountId);
        const settlement = await this.inventory.drop({
          characterId: hero.id,
          itemId: request.itemId,
          intent: this.intent,
          ...(request.amount === undefined ? {} : { amount: request.amount }),
        });
        if (settlement.creditMinor > 0) {
          await this.characters.creditMoney({
            characterId: hero.id,
            minorUnits: settlement.creditMinor,
          });
        }
        return this.bootstrap.bagDropMutation(
          context.accountId,
          this.intent === "sell" ? "SELL" : "DROP",
        );
      });
    } catch (error) {
      if (error instanceof DropDeniedError) throw new ProtocolError(204, error.message);
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
      if (error instanceof DropDeniedError) throw new ProtocolError(204, error.message);
      throw error;
    }
  }
}

function optionalAmount(envelope: ObjectActionEnvelope): number | undefined {
  const raw = envelope.input?.["amount"] ?? envelope.form?.["amount"];
  if (raw === undefined || raw === null || raw === "") return undefined;
  return Number(raw);
}
