import type { CharacterService } from "../../../character/application/character-service.ts";
import type { CombatPort } from "../../../combat/ports/combat-port.ts";
import type { InventoryService } from "../../../inventory/domain/inventory-service.ts";
import { UseDeniedError } from "../../../inventory/domain/use-denied-error.ts";
import type { UnitOfWork } from "../../../../shared/kernel/unit-of-work.ts";
import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import type { OaCommand, OaCommandContext, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";
import { requireNoActiveFight } from "./require-no-active-fight.ts";

type UseArtifactRequest = Readonly<{ itemId: number }>;

export class UseArtifactCommand implements OaCommand {
  static readonly key = "common|object:USE";
  readonly key = UseArtifactCommand.key;

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly bootstrap: BootstrapReadModel,
    private readonly characters: CharacterService,
    private readonly inventory: InventoryService,
    private readonly combat: CombatPort,
  ) {}

  decode(envelope: ObjectActionEnvelope): UseArtifactRequest {
    const form = envelope.form;
    if (!form) throw new ProtocolError(203, "common|object requires form");
    if (form["object_class"] !== "ARTIFACT") {
      throw new ProtocolError(203, "USE requires object_class ARTIFACT");
    }
    const raw = form["object_id"] ?? form["artifact_id"];
    if (typeof raw !== "number" && typeof raw !== "string") {
      throw new ProtocolError(203, "USE requires object_id");
    }
    const itemId = Number(raw);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw new ProtocolError(203, "USE object_id is invalid");
    }
    return { itemId };
  }

  async handle(context: OaCommandContext, request: UseArtifactRequest): Promise<object> {
    try {
      return await this.unitOfWork.run(async () => {
        const locked = await this.characters.lockByAccountId(context.accountId);
        await this.characters.syncResources({ characterId: locked.id });
        const hero = await this.characters.lockByAccountId(context.accountId);
        await requireNoActiveFight(this.combat, context.accountId);
        await this.inventory.ensureStarterInventory(hero.id);
        const used = await this.inventory.useFromBag({
          characterId: hero.id,
          itemId: request.itemId,
          hpMax: hero.maxHp,
        });
        await this.characters.noteHp({
          characterId: hero.id,
          hp: Math.min(hero.maxHp, hero.hp + used.gain),
        });
        return this.bootstrap.useMutation(context.accountId);
      });
    } catch (error) {
      if (error instanceof UseDeniedError) throw new ProtocolError(203, error.message);
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
      if (error instanceof UseDeniedError) throw new ProtocolError(203, error.message);
      throw error;
    }
  }
}
