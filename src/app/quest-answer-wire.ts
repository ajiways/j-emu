import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { CombatPort } from "../modules/combat/ports/combat-port.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { WorldService } from "../modules/world/domain/world-service.ts";
import type { FightWireMapper } from "../modules/jugger-wire/application/fight-wire-mapper.ts";
import type { BootstrapReadModel } from "../modules/jugger-wire/application/bootstrap-read-model.ts";
import type { BookTrioBlocks } from "../modules/jugger-wire/application/book-quest-blocks.ts";
import type { QuestService } from "../modules/quests/application/quest-service.ts";
import type { QuestMutation } from "../modules/quests/application/quest-mutation.ts";
import {
  leftoverJumpArea,
  leftoverOpenStore,
} from "../modules/quests/domain/quest-script-leftover.ts";
import type { ChatDesk } from "./chat-desk.ts";
import { piggybackQuestFight } from "./quest-fight-piggyback.ts";
import { jumpAreaAnswer, questDialogPayload } from "./quest-oa-codec.ts";

export type QuestAnswerWireDeps = Readonly<{
  quests: QuestService;
  characters: CharacterService;
  inventory: InventoryService;
  catalog: Catalog;
  world: WorldService;
  combat: CombatPort;
  chat: ChatDesk;
  fightWire: FightWireMapper;
  bootstrap: BootstrapReadModel;
  random: Readonly<{ unit(): number }>;
  bookTrio: (heroId: number, filterType: string) => Promise<BookTrioBlocks>;
}>;

export async function questAnswerBlocks(
  deps: QuestAnswerWireDeps,
  accountId: number,
  mutation: QuestMutation,
): Promise<Record<string, unknown>> {
  const hero = await requireHero(deps.characters, accountId);
  if (leftoverOpenStore(mutation.effects)) {
    return {
      "npc|answer": jumpAreaAnswer(),
      ...(await deps.bookTrio(hero.id, "started")),
      "user|bag": await deps.bootstrap.bag(accountId),
      "user|view": await deps.bootstrap.view(accountId),
      "user|unitframe": await deps.bootstrap.unitframe(accountId),
      state: await deps.bootstrap.state(accountId),
    };
  }
  const blocks: Record<string, unknown> = {
    "npc|answer": { status: 100 },
    ...(await questBoardBlocks(deps, accountId, hero.id, mutation.npcId)),
  };
  if (leftoverJumpArea(mutation.effects)) {
    blocks["npc|answer"] = jumpAreaAnswer();
  } else if (mutation.dialog && mutation.pointId) {
    blocks["npc|answer"] = questDialogPayload(
      mutation.pointId,
      mutation.dialog,
      await deps.quests.npcInfo(mutation.npcId),
    );
  }
  const fight = await piggybackQuestFight(accountId, mutation, {
    characters: deps.characters,
    catalog: deps.catalog,
    world: deps.world,
    inventory: deps.inventory,
    combat: deps.combat,
    chat: deps.chat,
    fightWire: deps.fightWire,
    random: deps.random,
  });
  return { ...blocks, ...fight };
}

export async function questBoardBlocks(
  deps: QuestAnswerWireDeps,
  accountId: number,
  heroId: number,
  npcId: number,
): Promise<Record<string, unknown>> {
  return {
    "npc|quests": await deps.quests.boardRows(heroId, npcId),
    "npc|info": await deps.quests.npcInfo(npcId),
    ...(await deps.bookTrio(heroId, "started")),
    state: await deps.bootstrap.state(accountId),
  };
}

async function requireHero(characters: CharacterService, accountId: number) {
  const hero = await characters.getByAccountId(accountId);
  if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
  return hero;
}
