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
  party: 0 | 1;
  clan: 0;
  instance: 0 | 1;
  alliance_read: 0;
  alliance_write: 0;
  new_message: 0 | 1;
  enable_log: 0;
  fight_id?: number;
  ghost?: 1;
  resurrect_time?: 0;
  resurrect_zones?: Readonly<Record<string, Readonly<{ title: string }>>>;
  injury?: "1";
}>;

export type HeroStateOverlay = Readonly<{
  fightId: number | null;
  resurrectZoneId?: string;
  resurrectZoneTitle?: string;
  newMessage: 0 | 1;
  inParty: boolean;
}>;

export function buildHeroState(
  hero: Hero,
  clock: Clock,
  overlay: HeroStateOverlay,
): HeroStateBlock {
  const base: HeroStateBlock = {
    server_time: clock.unixSeconds(),
    area_id: hero.areaId,
    level: hero.level,
    hp: hero.hp,
    hp_max: hero.maxHp,
    money: moneyFromMinorUnits(hero.moneyMinor),
    money_gold: moneyFromMinorUnits(hero.moneyGoldMinor),
    party: overlay.inParty ? 1 : 0,
    clan: 0,
    instance: hero.instanceCopyId === null ? 0 : 1,
    alliance_read: 0,
    alliance_write: 0,
    new_message: overlay.newMessage,
    enable_log: 0,
  };
  return {
    ...base,
    ...(overlay.fightId != null ? { fight_id: overlay.fightId } : {}),
    ...(hero.ghost ? ghostFields(hero, overlay) : {}),
  };
}

function ghostFields(
  hero: Hero,
  overlay: HeroStateOverlay,
): Pick<HeroStateBlock, "ghost" | "resurrect_time" | "resurrect_zones" | "injury"> {
  if (!overlay.resurrectZoneId) {
    throw new Error(`Ghost hero ${hero.id} requires a resurrect zone id`);
  }
  if (!overlay.resurrectZoneTitle) {
    throw new Error(`Ghost hero ${hero.id} requires a resurrect zone title`);
  }
  return {
    ghost: 1,
    resurrect_time: 0,
    resurrect_zones: { [overlay.resurrectZoneId]: { title: overlay.resurrectZoneTitle } },
    injury: "1",
  };
}
