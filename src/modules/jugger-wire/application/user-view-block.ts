import type { Hero } from "../../character/domain/hero.ts";

export type PaperdollPolicy = Readonly<{
  sk: number;
  body: string;
  avatar_big: string;
  bag_cnt: number;
}>;

export type UserViewBlock = Readonly<{
  status: 100;
  nick: string;
  uid: number;
  lvl: number;
  sk: number;
  body: string;
  avatar_big: string;
  avatar_dtime: null;
  bag_cnt: number;
  artifacts: readonly [];
  temp_effects: null;
  juggernaut_armor: 0;
  campaigns: readonly [];
}>;

export function buildUserView(hero: Hero, paperdoll: PaperdollPolicy): UserViewBlock {
  if (!paperdoll.body) throw new Error("Paperdoll body is required");
  if (!paperdoll.avatar_big) throw new Error("Paperdoll avatar_big is required");
  if (paperdoll.bag_cnt < 1) throw new Error("Paperdoll bag_cnt must be positive");
  return {
    status: 100,
    nick: hero.nick,
    uid: hero.accountId,
    lvl: hero.level,
    sk: paperdoll.sk,
    body: paperdoll.body,
    avatar_big: paperdoll.avatar_big,
    avatar_dtime: null,
    bag_cnt: paperdoll.bag_cnt,
    artifacts: [],
    temp_effects: null,
    juggernaut_armor: 0,
    campaigns: [],
  };
}
