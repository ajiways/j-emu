import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../character/application/character-service.ts";
import type { Hero } from "../../character/domain/hero.ts";
import { FLAG_KILL_ALL, partyFlagSet } from "../../party/domain/party-flags.ts";
import type { PartyRecord } from "../../party/domain/party-record.ts";
import type { PartyBagService } from "../../party/application/party-bag-service.ts";
import type { PartyService } from "../../party/application/party-service.ts";
import {
  emptyBagPayload,
  emptyMembersPayload,
  emptySettingsPayload,
  membersPayload,
  searchRow,
  settingsPayload,
} from "./party-wire.ts";
import { bagPayload } from "./party-bag-wire.ts";

export class PartySnapshot {
  constructor(
    private readonly parties: PartyService,
    private readonly bags: PartyBagService,
    private readonly characters: CharacterService,
    private readonly catalog: Catalog,
  ) {}

  async restore(heroId: number): Promise<Readonly<Record<string, unknown>> | null> {
    const mem = await this.parties.membership(heroId);
    if (!mem) return null;
    return {
      "party|members": await this.members(mem.party),
      "party|settings": settingsPayload(mem.party),
      "party|bag": await this.bag(mem.party.id),
    };
  }

  async bag(partyId: number): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.bags.list(partyId);
    if (rows.length === 0) return emptyBagPayload();
    return bagPayload(rows, this.catalog);
  }

  async members(party: PartyRecord): Promise<Readonly<Record<string, unknown>>> {
    const heroes = await this.memberHeroes(party.id);
    if (heroes.length === 0) return emptyMembersPayload();
    return membersPayload(heroes, party.leaderHeroId, this.catalog);
  }

  settingsOrEmpty(party: PartyRecord | null): Readonly<Record<string, unknown>> {
    return party ? settingsPayload(party) : emptySettingsPayload();
  }

  async searchList(
    fields: Readonly<Record<string, unknown>>,
    page: number,
  ): Promise<Readonly<Record<string, unknown>>> {
    const wantEmptyPassword = partyFlagSet(fields["empty_password"]);
    const wantKillAll = partyFlagSet(fields["kill_all"]);
    const instanceRaw = fields["instance_artikul_id"];
    const instanceArtikul =
      instanceRaw !== undefined && instanceRaw !== null && instanceRaw !== ""
        ? String(instanceRaw)
        : "";
    const filterInstance = instanceArtikul !== "" && instanceArtikul !== "0";
    const list: Array<Readonly<Record<string, unknown>>> = [];
    for (const party of await this.parties.listSearchable()) {
      if (wantEmptyPassword && party.password) continue;
      if (wantKillAll && (party.flags & FLAG_KILL_ALL) === 0) continue;
      if (filterInstance && party.instanceArtikulId !== instanceArtikul) continue;
      const heroes = await this.memberHeroes(party.id);
      const leader = heroes.find((hero) => hero.id === party.leaderHeroId);
      if (!leader) continue;
      const avatars = new Map<number, string>();
      for (const hero of heroes) {
        const appearance = await this.catalog.appearance(hero.kind, hero.gender);
        avatars.set(hero.id, appearance.avatarSmall);
      }
      list.push(searchRow(party, leader, heroes, avatars));
    }
    const perPage = 20;
    const totalPages = Math.max(1, Math.ceil(list.length / perPage) || 1);
    const start = (page - 1) * perPage;
    return {
      status: 100,
      list: list.slice(start, start + perPage),
      totalPages,
      total_pages: totalPages,
    };
  }

  async memberHeroes(partyId: number): Promise<readonly Hero[]> {
    const rows = await this.parties.listMembers(partyId);
    const heroes: Hero[] = [];
    for (const row of rows) {
      const hero = await this.characters.getById(row.heroId);
      if (!hero) throw new Error(`Party member hero ${row.heroId} is missing`);
      heroes.push(hero);
    }
    return heroes;
  }
}
