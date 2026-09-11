import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { Hero } from "../modules/character/domain/hero.ts";
import type { CombatPort, FightStart } from "../modules/combat/ports/combat-port.ts";
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
): Promise<Readonly<{ fight: FightStart; botTitle: string }>> {
  if (hero.ghost || hero.hp < 1) throw new QuestDeniedError("нельзя атаковать");
  const enemy = effect.enemies[0];
  if (!enemy) throw new Error("START_FIGHT requires an enemy");
  const bot = await deps.catalog.bot(enemy.artikulId);
  if (!bot) throw new Error(`Bot catalog entry ${enemy.artikulId} is missing`);
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
    purpose: "quest",
  });
  return { fight, botTitle: bot.title };
}
