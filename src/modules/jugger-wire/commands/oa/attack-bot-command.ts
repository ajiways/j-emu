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

  constructor(
    private readonly bootstrap: BootstrapReadModel,
    private readonly characters: CharacterService,
    private readonly inventory: InventoryService,
    private readonly world: WorldService,
    private readonly catalog: Catalog,
    private readonly combat: CombatPort,
    private readonly fightWire: FightWireMapper,
  ) {}

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
    const hero = await this.characters.getByAccountId(context.accountId);
    if (!hero) throw new Error(`Hero for account ${context.accountId} is missing`);
    const area = await this.world.area(hero.areaId);
    const matchingSpawns = area.spawns.filter((spawn) => spawn.botId === request.botId);
    if (matchingSpawns.length === 0) {
      throw new ProtocolError(203, `Bot ${request.botId} is not present in area ${area.id}`);
    }
    if (matchingSpawns.length > 1) {
      throw new Error(`Bot ${request.botId} is ambiguous in area ${area.id}; spawn id is required`);
    }
    const bot = await this.catalog.bot(request.botId);
    if (!bot) throw new Error(`Bot catalog entry ${request.botId} is missing`);
    await this.inventory.ensureStarterInventory(hero.id);
    const fight = await this.combat.startHunt({
      accountId: context.accountId,
      heroId: hero.id,
      heroNick: hero.nick,
      heroLevel: hero.level,
      heroKind: this.bootstrap.heroKind,
      heroHp: hero.hp,
      botId: bot.id,
      botNick: bot.title,
      botLevel: bot.level,
      botHp: bot.maxHp,
      arena: area.fightBackground,
      areaId: area.id,
    });
    const init2 = await this.bootstrap.init2(context.accountId);
    return {
      "common|action": { status: 100 },
      "fight|conf": this.fightWire.fightConfiguration(fight),
      "common|hunt": init2["common|hunt"],
      "user|unitframe": init2["user|unitframe"],
      state: init2.state,
    };
  }

  encode(response: AttackBotBlocks): OaEncodedResponse {
    return { kind: "flat", blocks: response };
  }

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    return this.encode(await this.handle({ accountId }, this.decode(envelope)));
  }
}
