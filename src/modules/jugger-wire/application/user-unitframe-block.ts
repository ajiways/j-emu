import type { Hero } from "../../character/domain/hero.ts";

export type UnitframeHudPolicy = Readonly<{
  rank: number;
  fight_id: number;
  gag_time: number;
  hp_time: number;
  mp_time: number;
  epic_value: number;
  mp: number;
  mpMax: number;
  exp: number;
  expMin: number;
  expMax: number;
  expStatus: number;
  honor: number;
  honorMin: number;
  honorMax: number;
  honorStatus: number;
  revenge: number;
  revengeMin: number;
  revengeMax: string;
  revengeStatus: number;
  energy_percent_max: number;
  energy_percent_current: number;
  avatar_small: string;
}>;

export type UserUnitframeBlock = Readonly<{
  status: 100;
  nick: string;
  level: number;
  rank: number;
  fight_id: number;
  gag_time: number;
  hp_time: number;
  mp_time: number;
  epic_value: number;
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  exp: number;
  expMin: number;
  expMax: number;
  expStatus: number;
  honor: number;
  honorMin: number;
  honorMax: number;
  honorStatus: number;
  revenge: number;
  revengeMin: number;
  revengeMax: string;
  revengeStatus: number;
  energy_percent_max: number;
  energy_percent_current: number;
  avatar_small: string;
}>;

export function buildUserUnitframe(hero: Hero, hud: UnitframeHudPolicy): UserUnitframeBlock {
  if (!hud.avatar_small) throw new Error("Unitframe avatar_small is required");
  if (!hud.revengeMax) throw new Error("Unitframe revengeMax is required");
  return {
    status: 100,
    nick: hero.nick,
    level: hero.level,
    rank: hud.rank,
    fight_id: hud.fight_id,
    gag_time: hud.gag_time,
    hp_time: hud.hp_time,
    mp_time: hud.mp_time,
    epic_value: hud.epic_value,
    hp: hero.hp,
    hpMax: hero.maxHp,
    mp: hud.mp,
    mpMax: hud.mpMax,
    exp: hud.exp,
    expMin: hud.expMin,
    expMax: hud.expMax,
    expStatus: hud.expStatus,
    honor: hud.honor,
    honorMin: hud.honorMin,
    honorMax: hud.honorMax,
    honorStatus: hud.honorStatus,
    revenge: hud.revenge,
    revengeMin: hud.revengeMin,
    revengeMax: hud.revengeMax,
    revengeStatus: hud.revengeStatus,
    energy_percent_max: hud.energy_percent_max,
    energy_percent_current: hud.energy_percent_current,
    avatar_small: hud.avatar_small,
  };
}
