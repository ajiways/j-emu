import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { HeroBestiary } from "../modules/character/ports/hero-bestiary.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { RandomSource } from "../modules/combat/domain/random-source.ts";
import type { PartyBagService } from "../modules/party/application/party-bag-service.ts";
import type { PartyService } from "../modules/party/application/party-service.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import { ChatFightSettlement } from "./chat-fight-settlement.ts";
import type { ChatDesk } from "./chat-desk.ts";
import { HuntFightSettlement } from "./hunt-fight-settlement.ts";
import { PartyFightLootNotify } from "./party-fight-loot-notify.ts";
import { PartyLootRouting } from "./party-loot-routing.ts";
import type { PartyNotify } from "./party-notify.ts";
import type { QuestLootNeeded } from "../modules/quests/ports/quest-loot-needed.ts";

export function createChatHuntSettlement(input: {
  unitOfWork: UnitOfWork;
  catalog: Catalog;
  characters: CharacterService;
  inventory: InventoryService;
  lootRandom: RandomSource;
  party: PartyService;
  partyBag: PartyBagService;
  partyNotify: PartyNotify;
  chat: ChatDesk;
  bestiary: HeroBestiary;
  lootNeeded: QuestLootNeeded;
}): ChatFightSettlement {
  return new ChatFightSettlement(
    new HuntFightSettlement(
      input.unitOfWork,
      input.catalog,
      input.characters,
      input.inventory,
      input.lootRandom,
      new PartyLootRouting(input.party),
      input.partyBag,
      new PartyFightLootNotify(
        input.partyBag,
        input.party,
        input.characters,
        input.catalog,
        input.partyNotify,
      ),
      input.bestiary,
      input.lootNeeded,
    ),
    input.chat,
    {
      failed(fightId, error) {
        process.stderr.write(`fight-chat ${fightId}: ${error.message}\n`);
      },
    },
  );
}
