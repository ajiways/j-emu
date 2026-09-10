import type { UnitOfWork } from "../../../../shared/kernel/unit-of-work.ts";
import type { Catalog } from "../../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import type { CombatPort } from "../../../combat/ports/combat-port.ts";
import type { InventoryService } from "../../../inventory/domain/inventory-service.ts";
import type { WorldService } from "../../../world/domain/world-service.ts";
import type {
  BootstrapReadModel,
  HeroStateBlock,
  HuntBlock,
  UserUnitframeBlock,
} from "../../application/bootstrap-read-model.ts";
import type {
  FightConfigurationBlock,
  FightWireMapper,
} from "../../application/fight-wire-mapper.ts";
import type { HuntAreaFanout } from "../../application/hunt-area-fanout.ts";
import type { ChatDesk } from "../../../../app/chat-desk.ts";
import { HuntCombatLoadout } from "../../application/hunt-combat-loadout.ts";
import { huntBotSpellBookFromCatalog } from "../../application/hunt-bot-spell-book-from-catalog.ts";
import { HuntMapAttack } from "../../application/hunt-map-attack.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import type { OaCommand, OaCommandContext, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

type AttackBotRequest = Readonly<{ botId: number }>;

type AttackBotBlocks = Readonly<{
  "common|action": Readonly<{ status: 100 }>;
  "fight|conf": FightConfigurationBlock;
  "common|hunt": HuntBlock;
  "user|unitframe": UserUnitframeBlock;
  state: HeroStateBlock;
}>;

export class AttackBotCommand implements OaCommand {
  static readonly key = "common|object:ATTACK_BOT";
  readonly key = AttackBotCommand.key;
  private readonly huntAttack: HuntMapAttack;

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly bootstrap: BootstrapReadModel,
    private readonly characters: CharacterService,
    private readonly inventory: InventoryService,
    private readonly world: WorldService,
    private readonly catalog: Catalog,
    private readonly combat: CombatPort,
    private readonly fightWire: FightWireMapper,
    huntFanout: HuntAreaFanout,
    private readonly chat: ChatDesk,
  ) {
    this.huntAttack = new HuntMapAttack(world, this.combat, huntFanout);
  }

  decode(envelope: ObjectActionEnvelope): AttackBotRequest {
    const form = envelope.form;
    if (!form) throw new ProtocolError(203, "common|object requires form");
    const rawBotId = form["bot_id"];
    if (typeof rawBotId !== "number" && typeof rawBotId !== "string") {
      throw new ProtocolError(203, "ATTACK_BOT requires bot_id");
    }
    const botId = Number(rawBotId);
    if (!Number.isInteger(botId) || botId <= 0) {
      throw new ProtocolError(203, "ATTACK_BOT bot_id is invalid");
    }
    return { botId };
  }

  async handle(context: OaCommandContext, request: AttackBotRequest): Promise<AttackBotBlocks> {
    const hero = await this.unitOfWork.run(async () => {
      const locked = await this.characters.lockByAccountId(context.accountId);
      await this.characters.syncResources({ characterId: locked.id });
      const current = await this.characters.getByAccountId(context.accountId);
      if (!current) throw new Error(`Hero for account ${context.accountId} is missing`);
      return current;
    });
    const area = await this.world.area(hero.areaId);
    const spawn = await this.world.spawn(area.id, request.botId);
    if (!spawn) {
      throw new ProtocolError(203, `Hunt spawn ${request.botId} is not present in area ${area.id}`);
    }
    const bot = await this.catalog.bot(spawn.botId);
    if (!bot) throw new Error(`Bot catalog entry ${spawn.botId} is missing`);
    await this.inventory.ensureStarterInventory(hero.id);
    const loadout = await new HuntCombatLoadout(this.inventory, this.catalog).snapshot(hero.id);
    const occupied = this.world.occupiedFightId(area.id, spawn.id);
    const joining = occupied !== null && (await this.combat.hasFight(occupied));
    const heroStrength = await this.characters.combatStrength(hero.id);
    const fight = await this.huntAttack.execute({
      accountId: context.accountId,
      heroId: hero.id,
      heroNick: hero.nick,
      heroLevel: hero.level,
      heroKind: hero.kind,
      heroHp: hero.hp,
      heroMaxHp: hero.maxHp,
      heroMp: hero.mp,
      heroMaxMp: hero.maxMp,
      heroStrength,
      spawnId: spawn.id,
      botId: bot.id,
      botNick: bot.title,
      botLevel: bot.level,
      botHp: bot.maxHp,
      botStrength: bot.strength,
      botAvatar: bot.hunt.avatar,
      botSk: bot.hunt.sk,
      botBody: bot.hunt.body,
      arena: area.fightBackground,
      areaId: area.id,
      loadout,
      botSpellBook: huntBotSpellBookFromCatalog(bot.spellBook),
    });
    if (!joining) {
      try {
        await this.chat.notifyHuntStarted({
          accountId: context.accountId,
          fightId: fight.fightId,
          areaId: area.id,
          heroNick: hero.nick,
          botNick: bot.title,
        });
      } catch (error) {
        const failure = error instanceof Error ? error : new Error(String(error));
        process.stderr.write(`hunt-start-chat ${fight.fightId}: ${failure.message}\n`);
      }
    }
    return {
      "common|action": { status: 100 },
      "fight|conf": this.fightWire.fightConfiguration(fight),
      "common|hunt": await this.bootstrap.hunt(context.accountId),
      "user|unitframe": await this.bootstrap.unitframe(context.accountId),
      state: await this.bootstrap.state(context.accountId),
    };
  }

  encode(response: AttackBotBlocks): OaEncodedResponse {
    return { kind: "flat", blocks: response };
  }

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    return this.encode(await this.handle({ accountId }, this.decode(envelope)));
  }
}
