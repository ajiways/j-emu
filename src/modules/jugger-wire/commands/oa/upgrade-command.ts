import type { CharacterService } from "../../../character/application/character-service.ts";
import type { CombatPort } from "../../../combat/ports/combat-port.ts";
import type { InventoryService } from "../../../inventory/domain/inventory-service.ts";
import { UpgradeDeniedError } from "../../../inventory/domain/upgrade-denied-error.ts";
import { UPGRADE_UNSUPPORTED } from "../../../inventory/domain/upgrade-tables.ts";
import type { UnitOfWork } from "../../../../shared/kernel/unit-of-work.ts";
import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import type { OaCommand, OaCommandContext, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";
import { requireNoActiveFight } from "./require-no-active-fight.ts";

type UpgradeRequest = Readonly<{
  crystalItemId: number;
  targetItemId: number;
}>;

export class UpgradeCommand implements OaCommand {
  static readonly key = "common|object:UPGRADE";
  readonly key = UpgradeCommand.key;

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly bootstrap: BootstrapReadModel,
    private readonly characters: CharacterService,
    private readonly inventory: InventoryService,
    private readonly combat: CombatPort,
  ) {}

  decode(envelope: ObjectActionEnvelope): UpgradeRequest {
    return {
      crystalItemId: requireItemId(envelope.form?.["object_id"] ?? envelope.form?.["artifact_id"]),
      targetItemId: requireItemId(envelope.input?.["artifact_id"]),
    };
  }

  async handle(context: OaCommandContext, request: UpgradeRequest): Promise<object> {
    try {
      return await this.unitOfWork.run(async () => {
        const locked = await this.characters.lockByAccountId(context.accountId);
        await this.characters.syncResources({ characterId: locked.id });
        const hero = await this.characters.lockByAccountId(context.accountId);
        await requireNoActiveFight(this.combat, context.accountId);
        await this.inventory.ensureStarterInventory(hero.id);
        const result = await this.inventory.applyGearUpgrade({
          characterId: hero.id,
          crystalItemId: request.crystalItemId,
          targetItemId: request.targetItemId,
        });
        return this.bootstrap.upgradeMutation(context.accountId, result);
      });
    } catch (error) {
      if (error instanceof UpgradeDeniedError) throw new ProtocolError(203, error.message);
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
      if (error instanceof UpgradeDeniedError) throw new ProtocolError(203, error.message);
      throw error;
    }
  }
}

function requireItemId(raw: unknown): number {
  if (typeof raw !== "number" && typeof raw !== "string") {
    throw new UpgradeDeniedError(UPGRADE_UNSUPPORTED);
  }
  const itemId = Number(raw);
  if (!Number.isInteger(itemId) || itemId < 1) {
    throw new UpgradeDeniedError(UPGRADE_UNSUPPORTED);
  }
  return itemId;
}
