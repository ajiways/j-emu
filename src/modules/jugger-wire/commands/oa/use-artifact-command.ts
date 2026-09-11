import type { CharacterService } from "../../../character/application/character-service.ts";
import { LearnBonusDeniedError } from "../../../character/domain/learn-bonus-denied-error.ts";
import type { CombatPort } from "../../../combat/ports/combat-port.ts";
import type { InventoryService } from "../../../inventory/domain/inventory-service.ts";
import { UseDeniedError } from "../../../inventory/domain/use-denied-error.ts";
import { ProfessionDeniedError } from "../../../professions/domain/profession-denied-error.ts";
import type { CraftService } from "../../../professions/application/craft-service.ts";
import type { QuestDesk } from "../../../../app/quest-desk.ts";
import type { Clock } from "../../../../shared/kernel/clock.ts";
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
    private readonly clock: Clock,
    private readonly craft: CraftService,
    private readonly quests: QuestDesk,
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
        let hero = await this.characters.lockByAccountId(context.accountId);
        await requireNoActiveFight(this.combat, context.accountId);
        await this.inventory.ensureStarterInventory(hero.id);
        const nowSec = this.clock.unixSeconds();
        const purged = await this.inventory.purgeExpiredDrinks(hero.id, nowSec);
        if (purged) {
          hero = await this.characters.applyEquipmentVitals(
            hero,
            await this.inventory.equippedSkillBonuses(hero.id),
          );
        }
        const used = await this.inventory.useFromBag({
          characterId: hero.id,
          itemId: request.itemId,
          hpMax: hero.maxHp,
          mpMax: hero.maxMp,
          heroLevel: hero.level,
          nowSec,
        });
        if (used.kind === "add_hp") {
          await this.characters.noteHp({
            characterId: hero.id,
            hp: Math.min(hero.maxHp, hero.hp + used.gain),
          });
          return this.bootstrap.useMutation(context.accountId, {
            msgText: null,
            includeView: false,
          });
        }
        if (used.kind === "add_mp") {
          await this.characters.noteMp({
            characterId: hero.id,
            mp: Math.min(hero.maxMp, hero.mp + used.gain),
          });
          return this.bootstrap.useMutation(context.accountId, {
            msgText: null,
            includeView: false,
          });
        }
        if (used.kind === "drink") {
          hero = await this.characters.lockByAccountId(context.accountId);
          await this.characters.applyEquipmentVitals(
            hero,
            await this.inventory.equippedSkillBonuses(hero.id),
          );
          return this.bootstrap.useMutation(context.accountId, {
            msgText: `Вы использовали ${used.title}.`,
            includeView: true,
          });
        }
        if (used.kind === "script") {
          return this.bootstrap.useMutation(context.accountId, {
            msgText: null,
            includeView: false,
          });
        }
        if (used.kind === "open_npc") {
          return {
            "common|action": { status: 100, action: "USE" },
            ...(await this.quests.openNpc(context.accountId, used.npcId)),
          };
        }
        if (used.kind === "learn_recipe") {
          await this.craft.learnFromBook(hero.id, used.artikulId);
          if (used.dispose === 1) {
            await this.inventory.consumeBagCharge({
              characterId: hero.id,
              itemId: used.itemId,
            });
          }
          const mutation = await this.bootstrap.useMutation(context.accountId, {
            msgText: null,
            includeView: false,
          });
          return {
            ...mutation,
            "craft|user_recipes_list": await this.craft.recipesList(hero.id),
          };
        }
        await this.characters.learnArtifactBonus({
          characterId: hero.id,
          bonus: used.bonus,
          artikulId: used.artikulId,
        });
        if (used.dispose === 1) {
          await this.inventory.consumeBagCharge({
            characterId: hero.id,
            itemId: used.itemId,
          });
        }
        return this.bootstrap.useMutation(context.accountId, {
          msgText: null,
          includeView: false,
        });
      });
    } catch (error) {
      mapUseError(error);
    }
  }

  encode(response: object): OaEncodedResponse {
    return { kind: "flat", blocks: response };
  }

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    try {
      return this.encode(await this.handle({ accountId }, this.decode(envelope)));
    } catch (error) {
      mapUseError(error);
    }
  }
}

function mapUseError(error: unknown): never {
  if (error instanceof UseDeniedError) throw new ProtocolError(203, error.message);
  if (error instanceof LearnBonusDeniedError) throw new ProtocolError(203, error.message);
  if (error instanceof ProfessionDeniedError) throw new ProtocolError(203, error.message);
  throw error;
}
