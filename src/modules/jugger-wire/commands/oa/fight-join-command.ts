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
import { heroFightAppearance } from "../../application/hero-fight-appearance.ts";
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
    if (!fightId) throw asHelpFightError(new HuntJoinDenied("бой не найден"));
    const rawTeam = fields["team"];
    if (rawTeam === undefined || rawTeam === null || rawTeam === "") {
      throw new ProtocolError(203, "FIGHT_JOIN requires team");
    }
    const teamNum = Number(rawTeam);
    if (teamNum !== 1 && teamNum !== 2) {
      throw new ProtocolError(203, "FIGHT_JOIN team must be 1 or 2");
    }
    return { kind: "join", fightId, team: teamNum };
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
      const target =
        request.kind === "join"
          ? { fightId: request.fightId, team: request.team }
          : await this.helpTarget(request.nick);
      await this.inventory.ensureStarterInventory(hero.id);
      const loadout = await new HuntCombatLoadout(this.inventory, this.catalog).snapshot(hero.id);
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
        heroStrength: await this.characters.combatStrength(hero.id),
        fightId: target.fightId,
        areaId: hero.areaId,
        instanceCopyId: hero.instanceCopyId,
        team: target.team,
        appearance: await heroFightAppearance(this.catalog, hero),
        loadout,
      });
      await this.huntFanout.wakeArea(hero.areaId, hero.instanceCopyId);
      return {
        "common|action": { status: 100 },
        "fight|conf": this.fightWire.fightConfiguration(
          fight,
          hero.instanceCopyId === null
            ? {}
            : { canLeave: 0, instanceId: String(hero.instanceCopyId) },
        ),
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

  private async helpTarget(nick: string): Promise<Readonly<{ fightId: string; team: 1 | 2 }>> {
    const target = await this.characters.getByNick(nick);
    if (!target) throw new HuntJoinDenied("игрок не в бою");
    const fightId = await this.combat.activeFightId(target.accountId);
    if (fightId === null) throw new HuntJoinDenied("игрок не в бою");
    const team = await this.combat.participantTeam(target.accountId);
    if (team === null) throw new HuntJoinDenied("игрок не в бою");
    return { fightId, team };
  }
}
