import type { Catalog } from "../../modules/catalog/ports/catalog.ts";
import type { CharacterService } from "../../modules/character/application/character-service.ts";
import { huntHeroStatFields } from "../../modules/combat/domain/combatant-fight-stats.ts";
import type { CombatGloveLoadout } from "../../modules/combat/domain/combat-loadout.ts";
import type { CombatPort } from "../../modules/combat/ports/combat-port.ts";
import type { EsrvOutbox } from "../../modules/jugger-wire/application/esrv-outbox.ts";
import type { FightWireMapper } from "../../modules/jugger-wire/application/fight-wire-mapper.ts";
import {
  heroFightAppearance,
  heroFightConfLook,
} from "../../modules/jugger-wire/application/hero-fight-appearance.ts";
import { HuntCombatLoadout } from "../../modules/jugger-wire/application/hunt-combat-loadout.ts";
import type { InventoryService } from "../../modules/inventory/domain/inventory-service.ts";
import { PocketDeniedError } from "../../modules/inventory/domain/pocket-denied-error.ts";
import type { PartyMembershipQuery } from "../../modules/party/ports/party-membership-query.ts";
import type { ChatDesk } from "../chat-desk.ts";
import type { FightScenario } from "./fight-scenario.ts";
import { provisionIdols, provisionPocket } from "./scenario-hero-pocket.ts";
import type { UnitOfWork } from "../../shared/kernel/unit-of-work.ts";

type ScenarioPartnersDeps = Readonly<{
  characters: CharacterService;
  catalog: Catalog;
  inventory: InventoryService;
  combat: CombatPort;
  parties: Pick<PartyMembershipQuery, "partyIdOf">;
  fightWire: FightWireMapper;
  chat: ChatDesk;
  outbox: EsrvOutbox;
  wake: Readonly<{ wake(accountId: number): void }>;
  unitOfWork: UnitOfWork;
}>;

/**
 * Other players put into the fight of a manual-test scenario: `/scenario <name> <nick> ...`. Each
 * gets the scenario's pocket, idols and glove like the one who typed the command, joins the same
 * fight on his side, and is sent the fight start the way a duel's challenger is.
 */
export class ScenarioPartners {
  constructor(private readonly deps: ScenarioPartnersDeps) {}

  /** One line per nick: what became of him. */
  async join(
    input: Readonly<{
      callerAccountId: number;
      nicks: readonly string[];
      scenario: FightScenario;
      glove: CombatGloveLoadout | null;
      fightId: string;
      team: 1 | 2;
    }>,
  ): Promise<readonly string[]> {
    const lines: string[] = [];
    for (const nick of input.nicks) lines.push(await this.joinOne(nick, input));
    return lines;
  }

  private async joinOne(
    nick: string,
    input: Parameters<ScenarioPartners["join"]>[0],
  ): Promise<string> {
    const { characters, combat } = this.deps;
    const known = await characters.getByNick(nick);
    if (!known) return `${nick}: такого игрока нет`;
    if (known.accountId === input.callerAccountId) return `${nick}: это вы сами`;
    if ((await combat.activeFightId(known.accountId)) !== null) return `${nick}: уже в бою`;
    await characters.syncResources({ characterId: known.id });
    const hero = await characters.getByAccountId(known.accountId);
    if (!hero) throw new Error(`Hero for account ${known.accountId} is missing`);
    if (hero.ghost) return `${nick}: призрак не может войти в бой`;
    const { scenario } = input;
    if (scenario.hero.hp > hero.maxHp) {
      return `${nick}: сценарий требует ${scenario.hero.hp} HP, максимум ${hero.maxHp}`;
    }
    const pocketDeps = {
      unitOfWork: this.deps.unitOfWork,
      inventory: this.deps.inventory,
      catalog: this.deps.catalog,
    };
    try {
      await provisionPocket(hero, scenario.hero.pocket, pocketDeps);
    } catch (error) {
      if (!(error instanceof PocketDeniedError)) throw error;
      return `${nick}: в боевом кармане нет места`;
    }
    await provisionIdols(hero, scenario.hero.idols, pocketDeps);
    await this.deps.inventory.ensureStarterInventory(hero.id);
    const equipped = await new HuntCombatLoadout(
      this.deps.inventory,
      this.deps.catalog,
      this.deps.parties,
    ).snapshot(hero.id);
    const fight = await combat.joinHunt({
      accountId: hero.accountId,
      heroId: hero.id,
      heroNick: hero.nick,
      heroLevel: hero.level,
      heroKind: hero.kind,
      heroHp: scenario.hero.hp,
      heroMaxHp: hero.maxHp,
      heroMp: hero.mp,
      heroMaxMp: hero.maxMp,
      ...huntHeroStatFields(await this.deps.characters.combatFightStats(hero.id)),
      fightId: input.fightId,
      areaId: hero.areaId,
      instanceCopyId: hero.instanceCopyId,
      team: input.team,
      appearance: await heroFightAppearance(this.deps.catalog, hero),
      loadout: input.glove === null ? equipped : { ...equipped, glove: input.glove },
    });
    const look = heroFightConfLook(hero);
    this.deps.outbox.enqueue(hero.accountId, {
      "fight|conf": this.deps.fightWire.fightConfiguration(
        fight,
        scenario.purpose === "quest" ? { ...look, flags: "8", canLeave: 0 } : look,
      ),
    });
    this.deps.wake.wake(hero.accountId);
    await this.deps.chat.deliverSystem(
      hero.accountId,
      `Вас включили в сценарий «${scenario.name}»: ${scenario.description}`,
    );
    return `${nick}: в бою`;
  }
}
