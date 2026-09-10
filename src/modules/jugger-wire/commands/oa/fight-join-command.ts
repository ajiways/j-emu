import type { UnitOfWork } from "../../../../shared/kernel/unit-of-work.ts";
import type { Catalog } from "../../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import type { CombatPort } from "../../../combat/ports/combat-port.ts";
import { HuntJoinDenied } from "../../../combat/domain/hunt-join-denied.ts";
import type { InventoryService } from "../../../inventory/domain/inventory-service.ts";
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
import { HuntCombatLoadout } from "../../application/hunt-combat-loadout.ts";
import { asHelpFightError } from "../../application/help-fight-error.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import type { OaCommand, OaCommandContext, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

type FightJoinRequest =
  | Readonly<{ kind: "join"; fightId: string; team: 1 | 2 }>
  | Readonly<{ kind: "help"; nick: string }>;

type FightJoinBlocks = Readonly<{
  "common|action": Readonly<{ status: 100 }>;
  "fight|conf": FightConfigurationBlock;
  "common|hunt": HuntBlock;
  "user|unitframe": UserUnitframeBlock;
  state: HeroStateBlock;
}>;

export class FightJoinCommand implements OaCommand {
  constructor(
    readonly key: "common|object:FIGHT_JOIN" | "common|object:FIGHT_HELP",
    private readonly unitOfWork: UnitOfWork,
    private readonly bootstrap: BootstrapReadModel,
    private readonly characters: CharacterService,
    private readonly inventory: InventoryService,
    private readonly catalog: Catalog,
    private readonly combat: CombatPort,
    private readonly fightWire: FightWireMapper,
    private readonly huntFanout: HuntAreaFanout,
  ) {}

  decode(envelope: ObjectActionEnvelope): FightJoinRequest {
    const fields = { ...(envelope.form ?? {}), ...(envelope.input ?? {}) };
    if (this.key === "common|object:FIGHT_HELP") {
      const nick = String(fields["nick"] ?? "").trim();
      if (!nick) throw new ProtocolError(204, "Данный игрок сейчас не участвует в боях!");
      return { kind: "help", nick };
    }
    const fightId = String(fields["fight"] ?? fields["fight_id"] ?? "");
    const teamNum = Number(fields["team"] ?? 1);
    const team = teamNum === 2 ? 2 : 1;
    if (!fightId) throw asHelpFightError(new HuntJoinDenied("бой не найден"));
    return { kind: "join", fightId, team };
  }

  async handle(context: OaCommandContext, request: FightJoinRequest): Promise<FightJoinBlocks> {
    const hero = await this.unitOfWork.run(async () => {
      const locked = await this.characters.lockByAccountId(context.accountId);
      await this.characters.syncResources({ characterId: locked.id });
      const current = await this.characters.getByAccountId(context.accountId);
      if (!current) throw new Error(`Hero for account ${context.accountId} is missing`);
      return current;
    });
    if (hero.ghost) throw new ProtocolError(204, "призрак не может войти в бой");
    if ((await this.combat.activeFightId(context.accountId)) !== null) {
      throw new ProtocolError(203, "нельзя во время боя");
    }
    try {
      const fightId =
        request.kind === "join" ? request.fightId : await this.fightIdByNick(request.nick);
      const team = request.kind === "join" ? request.team : 1;
      if (team !== 1) throw new HuntJoinDenied("бой не найден");
      await this.inventory.ensureStarterInventory(hero.id);
      const loadout = await new HuntCombatLoadout(this.inventory, this.catalog).snapshot(hero.id);
      const heroStrength = await this.characters.combatStrength(hero.id);
      const fight = await this.combat.joinHunt({
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
        fightId,
        areaId: hero.areaId,
        team: 1,
        loadout,
      });
      await this.huntFanout.wakeArea(hero.areaId);
      return {
        "common|action": { status: 100 },
        "fight|conf": this.fightWire.fightConfiguration(fight),
        "common|hunt": await this.bootstrap.hunt(context.accountId),
        "user|unitframe": await this.bootstrap.unitframe(context.accountId),
        state: await this.bootstrap.state(context.accountId),
      };
    } catch (error) {
      throw asHelpFightError(error);
    }
  }

  encode(response: FightJoinBlocks): OaEncodedResponse {
    return { kind: "flat", blocks: response };
  }

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    return this.encode(await this.handle({ accountId }, this.decode(envelope)));
  }

  private async fightIdByNick(nick: string): Promise<string> {
    const target = await this.characters.getByNick(nick);
    if (!target) throw new HuntJoinDenied("игрок не в бою");
    const fightId = await this.combat.activeFightId(target.accountId);
    if (fightId === null) throw new HuntJoinDenied("игрок не в бою");
    return fightId;
  }
}
