import type { Catalog } from "../../modules/catalog/ports/catalog.ts";
import type { CharacterService } from "../../modules/character/application/character-service.ts";
import type { HuntRosterBotInput } from "../../modules/combat/ports/combat-port.ts";
import type {
  CombatGloveLoadout,
  CombatGloveSpell,
} from "../../modules/combat/domain/combat-loadout.ts";
import type { HuntBotSpellBook } from "../../modules/combat/domain/hunt-bot-spell-book.ts";
import { unpublishedBotFightStats } from "../../modules/combat/domain/combatant-fight-stats.ts";
import type { FightWireMapper } from "../../modules/jugger-wire/application/fight-wire-mapper.ts";
import { heroFightConfLook } from "../../modules/jugger-wire/application/hero-fight-appearance.ts";
import { toCombatSpell } from "../../modules/jugger-wire/application/to-combat-spell.ts";
import type { ChatDesk } from "../chat-desk.ts";
import { startHuntWithRoster, type FightStartDeps } from "../quest-fight-start.ts";
import { PocketDeniedError } from "../../modules/inventory/domain/pocket-denied-error.ts";
import { provisionPocket } from "./scenario-hero-pocket.ts";
import type { FightScenario, FightScenarioBot } from "./fight-scenario.ts";
import type { FightScenarioCatalog } from "./fight-scenario-catalog.ts";

const COMMAND = "/scenario";

type ScenarioDeskDeps = Readonly<{
  scenarios: FightScenarioCatalog;
  characters: CharacterService;
  chat: ChatDesk;
  fightWire: FightWireMapper;
  start: FightStartDeps;
  pocket: Parameters<typeof provisionPocket>[2];
}>;

/**
 * Manual-testing entry: a chat message `/scenario <name>` starts the named scripted fight for the
 * sender, and `/scenario` lists them. Not a scenario command → `null`, the message is ordinary chat.
 */
export class ScenarioDesk {
  constructor(private readonly deps: ScenarioDeskDeps) {}

  async tryRun(accountId: number, text: string): Promise<Readonly<Record<string, unknown>> | null> {
    const [command, name, ...rest] = text.split(/\s+/);
    if (command !== COMMAND) return null;
    if (name === undefined || rest.length > 0) {
      await this.deps.chat.deliverSystem(accountId, this.usage());
      return {};
    }
    const scenario = this.deps.scenarios.find(name);
    if (!scenario) {
      await this.deps.chat.deliverSystem(
        accountId,
        `Сценарий «${name}» не найден. ${this.usage()}`,
      );
      return {};
    }
    const hero = await this.deps.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    const maxHp = scenario.hero.maxHp ?? hero.maxHp;
    if (scenario.hero.hp > maxHp) {
      await this.deps.chat.deliverSystem(
        accountId,
        `Сценарий «${name}» требует ${scenario.hero.hp} HP, у героя максимум ${maxHp}.`,
      );
      return {};
    }
    let pocket: string;
    try {
      pocket = await provisionPocket(hero, scenario.hero.pocket, this.deps.pocket);
    } catch (error) {
      if (!(error instanceof PocketDeniedError)) throw error;
      await this.deps.chat.deliverSystem(
        accountId,
        `Сценарий «${name}» не запущен: в боевом кармане нет места, освободите ячейки.`,
      );
      return {};
    }
    const started = await startHuntWithRoster(hero, this.deps.start, {
      purpose: scenario.purpose,
      heroHp: scenario.hero.hp,
      heroMaxHp: maxHp,
      gloveOverride: await this.glove(scenario),
      enemies: await this.roster(scenario, scenario.enemies),
      allies: await this.roster(scenario, scenario.allies),
      chatWin: "",
      chatLose: "",
    });
    await this.deps.chat.deliverSystem(
      accountId,
      `Сценарий «${name}»: ${scenario.description} Боевой карман: ${pocket}.`,
    );
    return {
      "fight|conf": this.deps.fightWire.fightConfiguration(started, heroFightConfLook(hero)),
    };
  }

  private usage(): string {
    const listed = this.deps.scenarios.describe();
    if (listed.length === 0) return "Сценариев нет.";
    return `Использование: /scenario <имя>. Доступны: ${listed
      .map((entry) => entry.name)
      .join(", ")}.`;
  }

  private async glove(scenario: FightScenario): Promise<CombatGloveLoadout | null> {
    const glove = scenario.hero.glove;
    if (glove === null) return null;
    const spells: CombatGloveSpell[] = [];
    for (const entry of glove.spells) {
      const artifact = await this.deps.start.catalog.artifact(entry.artikulId);
      if (!artifact?.extra.spell) {
        throw new Error(`Scenario ${scenario.name}: glove spell ${entry.artikulId} has no spell`);
      }
      spells.push({
        artikulId: artifact.id,
        cost: entry.cost,
        row: entry.row,
        title: artifact.title,
        picture: artifact.picture,
        spell: toCombatSpell(artifact.extra.spell),
      });
    }
    return { hits: glove.hits, spells };
  }

  private async roster(
    scenario: FightScenario,
    bots: readonly FightScenarioBot[],
  ): Promise<HuntRosterBotInput[]> {
    const out: HuntRosterBotInput[] = [];
    for (const entry of bots) {
      const base = await this.deps.start.catalog.bot(entry.botArtikulId);
      if (!base) {
        throw new Error(
          `Scenario ${scenario.name}: bot ${entry.botArtikulId} is not in the catalog`,
        );
      }
      const stats = unpublishedBotFightStats(entry.strength);
      out.push({
        artikulId: base.id,
        nick: base.title,
        level: base.level,
        hp: entry.hp,
        strength: entry.strength,
        initiative: stats.initiative,
        magPower: stats.mag.power,
        magResist: stats.mag.resist,
        avatar: base.hunt.avatar,
        sk: base.hunt.sk,
        body: base.hunt.body,
        spellBook: await spellBook(this.deps.start.catalog, scenario.name, entry),
      });
    }
    return out;
  }
}

async function spellBook(
  catalog: Catalog,
  scenario: string,
  entry: FightScenarioBot,
): Promise<HuntBotSpellBook> {
  const spells = [];
  for (const card of entry.spells) {
    const artifact = await catalog.artifact(card.artikulId);
    if (!artifact?.extra.spell) {
      throw new Error(`Scenario ${scenario}: artifact ${card.artikulId} has no spell`);
    }
    spells.push({
      artikulId: artifact.id,
      title: artifact.title,
      picture: artifact.picture,
      slot: card.slot,
      weight: card.weight,
      maxCasts: card.maxCasts,
      gate: card.gate,
      hpPct: card.hpPct,
      spell: toCombatSpell(artifact.extra.spell),
    });
  }
  return { nothingWeight: entry.nothingWeight, spells };
}
