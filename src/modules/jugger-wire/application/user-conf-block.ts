import type { Hero } from "../../character/domain/hero.ts";
import type { HonorProgress } from "../../catalog/domain/honor-progress.ts";
import { moneyNumberFromMinorUnits } from "./money-from-minor-units.ts";

export type UserConfBlock = Readonly<{
  status: 100;
  id: number;
  nick: string;
  level: number;
  kind: number;
  rank: number;
  money: number;
  language: string;
  gender: number;
  no_change_password: 1;
  access: Readonly<{ logserv: 0 }>;
  inquisitor: false;
  teacher: false;
  fake_hunt: 0;
  highlight_birthday: 0;
  left_diamonds: 0;
}>;

export function buildUserConf(hero: Hero, honor: HonorProgress): UserConfBlock {
  return {
    status: 100,
    id: hero.id,
    nick: hero.nick,
    level: hero.level,
    kind: hero.kind,
    rank: honor.rank,
    money: moneyNumberFromMinorUnits(hero.moneyMinor),
    language: hero.language,
    gender: hero.gender,
    no_change_password: 1,
    access: { logserv: 0 },
    inquisitor: false,
    teacher: false,
    fake_hunt: 0,
    highlight_birthday: 0,
    left_diamonds: 0,
  };
}
