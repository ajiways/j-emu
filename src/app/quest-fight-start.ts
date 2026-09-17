import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { Hero } from "../modules/character/domain/hero.ts";
import type {
  CombatPort,
  FightStart,
  HuntRosterBotInput,
} from "../modules/combat/ports/combat-port.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { WorldService } from "../modules/world/domain/world-service.ts";
import { HuntCombatLoadout } from "../modules/jugger-wire/application/hunt-combat-loadout.ts";
import { heroFightAppearance } from "../modules/jugger-wire/application/hero-fight-appearance.ts";
import { huntBotSpellBookFromCatalog } from "../modules/jugger-wire/application/hunt-bot-spell-book-from-catalog.ts";
import {
  huntHeroStatFields,
  unpublishedBotFightStats,
  type CombatantFightStats,
} from "../modules/combat/domain/combatant-fight-stats.ts";
import { QuestDeniedError } from "../modules/quests/domain/quest-denied-error.ts";
import type { QuestStartFightOpDocument } from "../modules/content/domain/content-quest.ts";

type FightStartDeps = Readonly<{
  catalog: Catalog;
  world: WorldService;
  inventory: InventoryService;
  combat: CombatPort;
  combatFightStats: (heroId: number) => Promise<CombatantFightStats>;
}>;

export async function startQuestFight(
  hero: Hero,
  effect: QuestStartFightOpDocument,
  deps: FightStartDeps,
): Promise<FightStart> {
  return startAuthoredHunt(hero, deps, {
    purpose: "quest",
    enemies: effect.enemies,
    allies: effect.allies,
    chatWin: effect.chatWin,
    chatLose: effect.chatLose,
  });
}

export async function startAmbushHunt(
  hero: Hero,
  artikulId: number,
  deps: FightStartDeps,
): Promise<FightStart> {
  return startAuthoredHunt(hero, deps, {
    purpose: "hunt",
    enemies: [{ artikulId, count: 1 }],
    allies: [],
    chatWin: "",
    chatLose: "",
  });
}

async function startAuthoredHunt(
  hero: Hero,
  deps: FightStartDeps,
  input: Readonly<{
    purpose: "hunt" | "quest";
    enemies: readonly Readonly<{ artikulId: number; count: number }>[];
    allies: readonly Readonly<{ artikulId: number; count: number }>[];
    chatWin: string;
    chatLose: string;
  }>,
): Promise<FightStart> {
  if (hero.ghost || hero.hp < 1) throw new QuestDeniedError("нельзя атаковать");
  const enemies = await loadRosterBots(deps.catalog, input.enemies);
  const primary = enemies[0];
  if (!primary) throw new Error("START_FIGHT requires an enemy");
  const area = await deps.world.area(hero.areaId);
  await deps.inventory.ensureStarterInventory(hero.id);
  const loadout = await new HuntCombatLoadout(deps.inventory, deps.catalog).snapshot(hero.id);
  const fightId = await deps.combat.nextFightId();
  return deps.combat.startHunt({
    accountId: hero.accountId,
    heroId: hero.id,
    heroNick: hero.nick,
    heroLevel: hero.level,
    heroKind: hero.kind,
    heroHp: hero.hp,
    heroMaxHp: hero.maxHp,
    heroMp: hero.mp,
    heroMaxMp: hero.maxMp,
    ...huntHeroStatFields(await deps.combatFightStats(hero.id)),
    fightId,
    botId: primary.artikulId,
    botNick: primary.nick,
    botLevel: primary.level,
    botHp: primary.hp,
    botStrength: primary.strength,
    botInitiative: primary.initiative,
    botMagPower: primary.magPower,
    botMagResist: primary.magResist,
    botAvatar: primary.avatar,
    botSk: primary.sk,
    botBody: primary.body,
    arena: area.fightBackground,
    areaId: area.id,
    instanceCopyId: hero.instanceCopyId,
    appearance: await heroFightAppearance(deps.catalog, hero),
    loadout,
    botSpellBook: primary.spellBook,
    purpose: input.purpose,
    extraEnemies: enemies.slice(1),
    allies: await loadRosterBots(deps.catalog, input.allies),
    chatWin: input.chatWin,
    chatLose: input.chatLose,
  });
}

async function loadRosterBots(
  catalog: Catalog,
  entries: readonly Readonly<{ artikulId: number; count: number }>[],
): Promise<HuntRosterBotInput[]> {
  const bots: HuntRosterBotInput[] = [];
  for (const entry of entries) {
    const bot = await catalog.bot(entry.artikulId);
    if (!bot) throw new Error(`Bot catalog entry ${entry.artikulId} is missing`);
    for (let copy = 0; copy < entry.count; copy += 1) {
      bots.push({
        artikulId: bot.id,
        nick: bot.title,
        level: bot.level,
        hp: bot.maxHp,
        strength: bot.strength,
        initiative: unpublishedBotFightStats(bot.strength).initiative,
        magPower: unpublishedBotFightStats(bot.strength).mag.power,
        magResist: unpublishedBotFightStats(bot.strength).mag.resist,
        avatar: bot.hunt.avatar,
        sk: bot.hunt.sk,
        body: bot.hunt.body,
        spellBook: await huntBotSpellBookFromCatalog(bot.spellBook, catalog),
      });
    }
  }
  return bots;
}
