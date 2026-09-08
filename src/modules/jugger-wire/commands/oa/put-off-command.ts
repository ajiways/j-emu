import type { Catalog } from "../../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import type { InventoryService } from "../../../inventory/domain/inventory-service.ts";
import { WearDeniedError } from "../../../inventory/domain/wear-denied-error.ts";
import type { UnitOfWork } from "../../../../shared/kernel/unit-of-work.ts";
import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { equippedSkillBonuses } from "../../application/equipped-skill-bonuses.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import { artifactInstanceIdFrom } from "./artifact-instance-id.ts";
import type { OaCommand, OaCommandContext, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

type PutOffRequest = Readonly<{ itemId: number }>;

export class PutOffCommand implements OaCommand {
  static readonly key = "common|object:PUT_OFF";
  readonly key = PutOffCommand.key;

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly bootstrap: BootstrapReadModel,
    private readonly characters: CharacterService,
    private readonly inventory: InventoryService,
    private readonly catalog: Catalog,
  ) {}

  decode(envelope: ObjectActionEnvelope): PutOffRequest {
    return { itemId: artifactInstanceIdFrom(envelope) };
  }

  async handle(context: OaCommandContext, request: PutOffRequest): Promise<object> {
    try {
      return await this.unitOfWork.run(async () => {
        const locked = await this.characters.lockByAccountId(context.accountId);
        await this.characters.syncResources({ characterId: locked.id });
        const hero = await this.characters.lockByAccountId(context.accountId);
        await this.inventory.putOff(hero.id, request.itemId);
        await this.characters.applyEquipmentVitals(
          hero,
          await equippedSkillBonuses(this.inventory, this.catalog, hero.id),
        );
        return this.bootstrap.equipmentMutation(context.accountId);
      });
    } catch (error) {
      if (error instanceof WearDeniedError) throw new ProtocolError(203, error.message);
      throw error;
    }
  }

  encode(response: object): OaEncodedResponse {
    return { kind: "flat", blocks: response };
  }

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    return this.encode(await this.handle({ accountId }, this.decode(envelope)));
  }
}
