import type {
  FightPartyLootNotice,
  FightPartyLootNotify,
} from "../modules/combat/ports/fight-party-loot-notify.ts";
import type { PartyBagService } from "../modules/party/application/party-bag-service.ts";
import type { PartyService } from "../modules/party/application/party-service.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import { bagPayload, emptyBagPayload } from "../modules/jugger-wire/application/party-bag-wire.ts";
import type { PartyNotify } from "./party-notify.ts";

export class PartyFightLootNotify implements FightPartyLootNotify {
  constructor(
    private readonly bags: PartyBagService,
    private readonly parties: PartyService,
    private readonly characters: Pick<CharacterService, "getById">,
    private readonly catalog: Catalog,
    private readonly party: PartyNotify,
  ) {}

  async notify(notice: FightPartyLootNotice): Promise<void> {
    const leader = await this.leader(notice.partyId);
    if (notice.moneyMinor > 0) {
      await this.party.chatGroupMoney(notice.partyId, notice.moneyMinor, leader.language);
    }
    if (notice.items.length < 1) return;
    const rows = await this.bags.list(notice.partyId);
    const bag = rows.length
      ? await bagPayload(rows, this.catalog, { newloot: true })
      : emptyBagPayload();
    await this.party.pushToParty(notice.partyId, { "party|bag": bag });
    const loot: Record<string, { artikul_id: number; amount: number }> = {};
    const artikulList: Record<string, (typeof notice.artikulList)[number]> = {};
    for (let index = 0; index < notice.items.length; index += 1) {
      const item = notice.items[index];
      const entry = notice.artikulList[index];
      if (!item || !entry) throw new Error("Party grouploot item is missing");
      loot[String(item.artikulId)] = { artikul_id: item.artikulId, amount: item.quantity };
      artikulList[String(item.artikulId)] = entry;
      await this.party.chatGroupItem(
        notice.partyId,
        item.artikulId,
        item.quantity,
        leader.language,
      );
    }
    const fightId = Number(notice.fightId);
    if (!Number.isInteger(fightId) || fightId < 1) {
      throw new Error(`Party grouploot fight_id ${notice.fightId} is invalid`);
    }
    await this.party.pushToParty(notice.partyId, {
      "fight|grouploot": {
        status: 100,
        fight_id: fightId,
        experience: 0,
        money: 0,
        honor: 0,
        revenge: 0,
        loot,
        artikul_list: artikulList,
      },
    });
  }

  private async leader(partyId: number) {
    const party = await this.parties.getParty(partyId);
    if (!party) throw new Error(`Party ${partyId} is missing`);
    const hero = await this.characters.getById(party.leaderHeroId);
    if (!hero) throw new Error(`Party ${partyId} leader ${party.leaderHeroId} is missing`);
    return hero;
  }
}
