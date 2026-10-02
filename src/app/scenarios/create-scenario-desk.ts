import type { Catalog } from "../../modules/catalog/ports/catalog.ts";
import type { CharacterService } from "../../modules/character/application/character-service.ts";
import type { CombatPort } from "../../modules/combat/ports/combat-port.ts";
import type { InventoryService } from "../../modules/inventory/domain/inventory-service.ts";
import type { FightWireMapper } from "../../modules/jugger-wire/application/fight-wire-mapper.ts";
import type { UnitOfWork } from "../../shared/kernel/unit-of-work.ts";
import type { WorldService } from "../../modules/world/domain/world-service.ts";
import type { ChatDesk } from "../chat-desk.ts";
import { FightScenarioCatalog } from "./fight-scenario-catalog.ts";
import type { PartyMembershipQuery } from "../../modules/party/ports/party-membership-query.ts";
import type { EsrvOutbox } from "../../modules/jugger-wire/application/esrv-outbox.ts";
import { ScenarioPartners } from "./scenario-partners.ts";
import { ScenarioDesk } from "./scenario-desk.ts";

/** `null` directory means scenarios are switched off; the `/scenario` message is then plain chat. */
export function createScenarioDesk(
  directory: string | null,
  deps: Readonly<{
    characters: CharacterService;
    catalog: Catalog;
    world: WorldService;
    inventory: InventoryService;
    combat: CombatPort;
    chat: ChatDesk;
    fightWire: FightWireMapper;
    outbox: EsrvOutbox;
    wake: Readonly<{ wake(accountId: number): void }>;
    parties: Pick<PartyMembershipQuery, "partyIdOf">;
    unitOfWork: UnitOfWork;
  }>,
): ScenarioDesk | null {
  if (directory === null) return null;
  return new ScenarioDesk({
    scenarios: FightScenarioCatalog.load(directory),
    characters: deps.characters,
    chat: deps.chat,
    fightWire: deps.fightWire,
    pocket: {
      unitOfWork: deps.unitOfWork,
      inventory: deps.inventory,
      catalog: deps.catalog,
    },
    start: {
      catalog: deps.catalog,
      world: deps.world,
      inventory: deps.inventory,
      combat: deps.combat,
      combatFightStats: (heroId) => deps.characters.combatFightStats(heroId),
      parties: deps.parties,
    },
    partners: new ScenarioPartners({
      characters: deps.characters,
      catalog: deps.catalog,
      inventory: deps.inventory,
      combat: deps.combat,
      parties: deps.parties,
      fightWire: deps.fightWire,
      chat: deps.chat,
      outbox: deps.outbox,
      wake: deps.wake,
      unitOfWork: deps.unitOfWork,
    }),
  });
}
