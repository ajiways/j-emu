import type { Hero } from "../../character/domain/hero.ts";
import type { Clock } from "../../../shared/kernel/clock.ts";
import { moneyFromMinorUnits } from "./money-from-minor-units.ts";

export type HeroStateBlock = Readonly<{
  server_time: number;
  area_id: string;
  level: number;
  hp: number;
  hp_max: number;
  money: string;
  money_gold: string;
  party: 0;
  clan: 0;
  instance: 0;
  alliance_read: 0;
  alliance_write: 0;
  new_message: 0;
  enable_log: 0;
}>;

export function buildHeroState(hero: Hero, clock: Clock): HeroStateBlock {
  return {
    server_time: clock.unixSeconds(),
    area_id: hero.areaId,
    level: hero.level,
    hp: hero.hp,
    hp_max: hero.maxHp,
    money: moneyFromMinorUnits(hero.moneyMinor),
    money_gold: moneyFromMinorUnits(hero.moneyGoldMinor),
    party: 0,
    clan: 0,
    instance: 0,
    alliance_read: 0,
    alliance_write: 0,
    new_message: 0,
    enable_log: 0,
  };
}
