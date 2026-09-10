import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { Hero } from "../../character/domain/hero.ts";
import type { PartyRecord } from "../../party/domain/party-record.ts";
import { flagsFromBits } from "../../party/domain/party-flags.ts";

export function emptyMembersPayload(): Readonly<{ status: 100; members: readonly unknown[] }> {
  return { status: 100, members: [] };
}

export function emptyBagPayload(): Readonly<{
  status: 100;
  artikuls: readonly unknown[];
  types: readonly unknown[];
}> {
  return { status: 100, artikuls: [], types: [] };
}

export function emptySettingsPayload(): Readonly<{
  status: 100;
  flags: 0;
  is_search: 0;
  password: "";
  instance_artikul_id: 0;
}> {
  return {
    status: 100,
    flags: 0,
    is_search: 0,
    password: "",
    instance_artikul_id: 0,
  };
}

function emptyInstanceVo(): Readonly<{
  id: 0;
  title: "";
  level_min: 0;
  level_max: 0;
  start_area_id: 0;
  img_url: "";
  flags: 0;
  show_in_book: 0;
}> {
  return {
    id: 0,
    title: "",
    level_min: 0,
    level_max: 0,
    start_area_id: 0,
    img_url: "",
    flags: 0,
    show_in_book: 0,
  };
}

export function settingsPayload(party: PartyRecord): Readonly<Record<string, unknown>> {
  const bits = flagsFromBits(party.flags);
  return {
    status: 100,
    type: party.type,
    flags: String(party.flags),
    is_search: party.isSearch === 1,
    join_confirm: bits.join_confirm,
    kill_all: bits.kill_all,
    loot_rules: party.lootRules,
    no_chat: party.noChat,
    password: party.password,
    bot_artikul_id: party.botArtikulId,
    instance_artikul_id: party.instanceArtikulId,
  };
}

async function memberWire(
  hero: Hero,
  catalog: Catalog,
  isLeader: boolean,
): Promise<Readonly<Record<string, unknown>>> {
  const appearance = await catalog.appearance(hero.kind, hero.gender);
  const row: Record<string, unknown> = {
    id: hero.accountId,
    user_id: hero.accountId,
    member_id: hero.accountId,
    nick: hero.nick,
    level: hero.level,
    kind: hero.kind,
    language: hero.language,
    server_id: 1,
    clan_id: 0,
    dead: hero.ghost ? 4 : 0,
    injury_time: hero.injuryTime,
    injury_artikul_id: hero.injuryArtikulId,
    gag_time: 0,
    juggernaut: 0,
    punish: 0,
    instance_id: 0,
    avatar: appearance.avatarSmall,
  };
  if (isLeader) row.is_party_leader = 1;
  return row;
}

export async function membersPayload(
  heroes: readonly Hero[],
  leaderHeroId: number,
  catalog: Catalog,
): Promise<Readonly<Record<string, unknown>>> {
  const members = [];
  for (const hero of heroes) {
    members.push(await memberWire(hero, catalog, hero.id === leaderHeroId));
  }
  return { status: 100, members };
}

function searchMember(hero: Hero, avatar: string): Readonly<Record<string, unknown>> {
  return {
    member_id: hero.accountId,
    user_id: hero.accountId,
    nick: hero.nick,
    level: hero.level,
    avatar,
    kind: hero.kind,
  };
}

export function searchRow(
  party: PartyRecord,
  leader: Hero,
  members: readonly Hero[],
  avatars: ReadonlyMap<number, string>,
): Readonly<Record<string, unknown>> {
  const levels = members.map((hero) => hero.level);
  return {
    id: party.id,
    level: Math.max(...levels, leader.level),
    level_min: Math.min(...levels, leader.level),
    empty_password: party.password ? 0 : 1,
    leader_id: leader.accountId,
    flags: party.flags,
    instance: emptyInstanceVo(),
    members: members.map((hero) => {
      const avatar = avatars.get(hero.id);
      if (!avatar) throw new Error(`Party search avatar for hero ${hero.id} is missing`);
      return searchMember(hero, avatar);
    }),
  };
}
