import type { AppearancePreset } from "../../catalog/domain/appearance-preset.ts";
import type { LevelBoundary } from "../../catalog/domain/level-boundary.ts";
import type { Hero } from "../../character/domain/hero.ts";

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

export function buildUserView(
  hero: Hero,
  appearance: AppearancePreset,
  level: LevelBoundary,
): UserViewBlock {
  if (!hero.body) throw new Error("Hero body is required");
  return {
    status: 100,
    nick: hero.nick,
    uid: hero.accountId,
    lvl: hero.level,
    sk: hero.sk,
    body: hero.body,
    avatar_big: appearance.avatarBig,
    avatar_dtime: null,
    bag_cnt: level.bagCnt,
    artifacts: [],
    temp_effects: null,
    juggernaut_armor: 0,
    campaigns: [],
  };
}
