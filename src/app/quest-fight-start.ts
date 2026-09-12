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
import { huntBotSpellBookFromCatalog } from "../modules/jugger-wire/application/hunt-bot-spell-book-from-catalog.ts";
import { QuestDeniedError } from "../modules/quests/domain/quest-denied-error.ts";
import type { QuestScriptEffect } from "../modules/quests/domain/quest-script-effect.ts";

export async function startQuestFight(
  hero: Hero,
  effect: Extract<QuestScriptEffect, { type: "START_FIGHT" }>,
  deps: Readonly<{
    catalog: Catalog;
    world: WorldService;
    inventory: InventoryService;
    combat: CombatPort;
    combatStrength: (heroId: number) => Promise<number>;
  }>,
): Promise<FightStart> {
  if (hero.ghost || hero.hp < 1) throw new QuestDeniedError("нельзя атаковать");
  const enemies = await loadRosterBots(deps.catalog, effect.enemies);
  const primary = enemies[0];
  if (!primary) throw new Error("START_FIGHT requires an enemy");
  const area = await deps.world.area(hero.areaId);
  await deps.inventory.ensureStarterInventory(hero.id);
  const loadout = await new HuntCombatLoadout(deps.inventory, deps.catalog).snapshot(hero.id);
  const fightId = await deps.combat.nextFightId();
  const fight = await deps.combat.startHunt({
    accountId: hero.accountId,
    heroId: hero.id,
    heroNick: hero.nick,
    heroLevel: hero.level,
    heroKind: hero.kind,
    heroHp: hero.hp,
    heroMaxHp: hero.maxHp,
    heroMp: hero.mp,
    heroMaxMp: hero.maxMp,
    heroStrength: await deps.combatStrength(hero.id),
    fightId,
    botId: primary.artikulId,
    botNick: primary.nick,
    botLevel: primary.level,
    botHp: primary.hp,
    botStrength: primary.strength,
    botAvatar: primary.avatar,
    botSk: primary.sk,
    botBody: primary.body,
    arena: area.fightBackground,
    areaId: area.id,
    loadout,
    botSpellBook: primary.spellBook,
    purpose: "quest",
    extraEnemies: enemies.slice(1),
    allies: await loadRosterBots(deps.catalog, effect.allies),
    chatWin: effect.chatWin,
    chatLose: effect.chatLose,
  });
  return fight;
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
        avatar: bot.hunt.avatar,
        sk: bot.hunt.sk,
        body: bot.hunt.body,
        spellBook: huntBotSpellBookFromCatalog(bot.spellBook),
      });
    }
  }
  return bots;
}
