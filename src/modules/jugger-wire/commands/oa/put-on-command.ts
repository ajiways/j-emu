import type { Catalog } from "../../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import type { CombatPort } from "../../../combat/ports/combat-port.ts";
import { BrokenItemError } from "../../../inventory/domain/broken-item-error.ts";
import { PocketDeniedError } from "../../../inventory/domain/pocket-denied-error.ts";
import type { InventoryService } from "../../../inventory/domain/inventory-service.ts";
import type { PocketTarget } from "../../../inventory/domain/put-on-pocket.ts";
import { MixDeniedError } from "../../../inventory/domain/mix-denied-error.ts";
import { WearDeniedError } from "../../../inventory/domain/wear-denied-error.ts";
import type { UnitOfWork } from "../../../../shared/kernel/unit-of-work.ts";
import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { equippedSkillBonuses } from "../../application/equipped-skill-bonuses.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import { syncWornBody } from "../../application/sync-worn-body.ts";
import { artifactInstanceIdFrom } from "./artifact-instance-id.ts";
import type { OaCommand, OaCommandContext, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";
import { pocketTargetFromEnvelope } from "./pocket-target-from-envelope.ts";
import { requireNoActiveFight } from "./require-no-active-fight.ts";
import type { QuestDesk } from "../../../../app/quest-desk.ts";

type PutOnRequest = Readonly<{ itemId: number; pocketTarget?: PocketTarget }>;

export class PutOnCommand implements OaCommand {
  static readonly key = "common|object:PUT_ON";
  readonly key = PutOnCommand.key;

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly bootstrap: BootstrapReadModel,
    private readonly characters: CharacterService,
    private readonly inventory: InventoryService,
    private readonly catalog: Catalog,
    private readonly combat: CombatPort,
    private readonly quests: QuestDesk,
  ) {}

  decode(envelope: ObjectActionEnvelope): PutOnRequest {
    const pocketTarget = pocketTargetFromEnvelope(envelope);
    return pocketTarget === undefined
      ? { itemId: artifactInstanceIdFrom(envelope) }
      : { itemId: artifactInstanceIdFrom(envelope), pocketTarget };
  }

  async handle(context: OaCommandContext, request: PutOnRequest): Promise<object> {
    try {
      return await this.unitOfWork.run(async () => {
        const locked = await this.characters.lockByAccountId(context.accountId);
        await this.characters.syncResources({ characterId: locked.id });
        const hero = await this.characters.lockByAccountId(context.accountId);
        await requireNoActiveFight(this.combat, context.accountId);
        await this.inventory.ensureStarterInventory(hero.id);
        const items = await this.inventory.list(hero.id);
        const matches = items.filter((item) => item.id === request.itemId);
        if (matches.length > 1) throw new Error(`Multiple items found for ${request.itemId}`);
        const item = matches[0];
        if (!item) throw new Error(`Item ${request.itemId} for hero ${hero.id} is missing`);
        const definition = await this.catalog.artifact(item.artifactId);
        if (!definition) throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
        const kind = await this.inventory.putOn(
          hero,
          request.itemId,
          definition,
          request.pocketTarget,
        );
        if (kind === "paperdoll") {
          await this.characters.applyEquipmentVitals(
            hero,
            await equippedSkillBonuses(this.inventory, this.catalog, hero.id),
          );
          await syncWornBody(this.characters, this.inventory, this.catalog, hero);
        }
        const mutation = await this.bootstrap.equipmentMutation(context.accountId);
        const book = await this.quests.recordEquip(hero.id, item.artifactId);
        return book ? { ...mutation, ...book } : mutation;
      });
    } catch (error) {
      if (error instanceof WearDeniedError) throw new ProtocolError(203, error.message);
      if (error instanceof MixDeniedError) throw new ProtocolError(204, error.message);
      if (error instanceof PocketDeniedError) throw new ProtocolError(204, error.message);
      if (error instanceof BrokenItemError) throw new ProtocolError(204, error.message);
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
      if (error instanceof MixDeniedError) throw new ProtocolError(204, error.message);
      if (error instanceof PocketDeniedError) throw new ProtocolError(204, error.message);
      if (error instanceof BrokenItemError) throw new ProtocolError(204, error.message);
      throw error;
    }
  }
}
