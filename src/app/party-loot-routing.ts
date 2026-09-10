import type { PartyService } from "../modules/party/application/party-service.ts";
import type {
  FightLootRoute,
  FightLootRouting,
} from "../modules/combat/ports/fight-loot-routing.ts";

export class PartyLootRouting implements FightLootRouting {
  constructor(private readonly parties: PartyService) {}

  async routeFor(characterIds: readonly number[]): Promise<FightLootRoute | null> {
    let partyId: number | null = null;
    let lootRules: "1" | "2" | "3" | null = null;
    const memberCharacterIds = new Set<number>();
    for (const characterId of characterIds) {
      const mem = await this.parties.membership(characterId);
      if (!mem) continue;
      if (partyId === null) {
        partyId = mem.party.id;
        if (
          mem.party.lootRules !== "1" &&
          mem.party.lootRules !== "2" &&
          mem.party.lootRules !== "3"
        ) {
          throw new Error(`Party ${mem.party.id} loot_rules ${mem.party.lootRules} is invalid`);
        }
        lootRules = mem.party.lootRules;
      }
      if (mem.party.id === partyId) memberCharacterIds.add(characterId);
    }
    if (partyId === null || lootRules === null) return null;
    return { partyId, lootRules, memberCharacterIds };
  }
}
