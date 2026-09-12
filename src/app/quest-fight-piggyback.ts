import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { CombatPort } from "../modules/combat/ports/combat-port.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { WorldService } from "../modules/world/domain/world-service.ts";
import type { FightWireMapper } from "../modules/jugger-wire/application/fight-wire-mapper.ts";
import type { QuestMutation } from "../modules/quests/application/quest-mutation.ts";
import type { ChatDesk } from "./chat-desk.ts";
import { startQuestFight } from "./quest-fight-start.ts";

export async function piggybackQuestFight(
  accountId: number,
  mutation: QuestMutation,
  deps: Readonly<{
    characters: CharacterService;
    catalog: Catalog;
    world: WorldService;
    inventory: InventoryService;
    combat: CombatPort;
    chat: ChatDesk;
    fightWire: FightWireMapper;
  }>,
): Promise<Readonly<Record<string, unknown>>> {
  const fight = mutation.effects.find((effect) => effect.type === "START_FIGHT");
  if (!fight || fight.type !== "START_FIGHT") return {};
  const hero = await deps.characters.getByAccountId(accountId);
  if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
  const started = await startQuestFight(hero, fight, {
    catalog: deps.catalog,
    world: deps.world,
    inventory: deps.inventory,
    combat: deps.combat,
    combatStrength: (id) => deps.characters.combatStrength(id),
  });
  if (fight.chatStart.length > 0) {
    await deps.chat.deliverSystem(accountId, fight.chatStart);
  }
  return { "fight|conf": deps.fightWire.fightConfiguration(started, { flags: "8" }) };
}
