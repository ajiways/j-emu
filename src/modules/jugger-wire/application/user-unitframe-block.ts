import type { AppearancePreset } from "../../catalog/domain/appearance-preset.ts";
import type { HudDefaults } from "../../catalog/domain/hud-defaults.ts";
import type { LevelBoundary } from "../../catalog/domain/level-boundary.ts";
import type { Hero } from "../../character/domain/hero.ts";

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
  injury_time: number;
  injury_artikul_id: number;
}>;

export function buildUserUnitframe(
  hero: Hero,
  level: LevelBoundary,
  appearance: AppearancePreset,
  hud: HudDefaults,
  inActiveFight = false,
  fightId: number | null = null,
): UserUnitframeBlock {
  if (inActiveFight && fightId === null) {
    throw new Error(`Hero ${hero.id} is in a fight without a numeric fight id`);
  }
  return {
    status: 100,
    nick: hero.nick,
    level: hero.level,
    rank: level.honorRank,
    fight_id: fightId ?? hud.fightId,
    gag_time: hud.gagTime,
    hp_time: inActiveFight ? 0 : hero.hpTime,
    mp_time: hud.mpTime,
    epic_value: hud.epicValue,
    hp: hero.hp,
    hpMax: hero.maxHp,
    mp: hero.mp,
    mpMax: hero.maxMp,
    exp: hero.exp,
    expMin: level.expMin,
    expMax: level.expMax,
    expStatus: hud.expStatus,
    honor: hero.honor,
    honorMin: level.honorMin,
    honorMax: level.honorMax,
    honorStatus: level.honorStatus,
    revenge: hud.revenge,
    revengeMin: hud.revengeMin,
    revengeMax: hud.revengeMax,
    revengeStatus: hud.revengeStatus,
    energy_percent_max: hud.energyPercentMax,
    energy_percent_current: hud.energyPercentCurrent,
    avatar_small: appearance.avatarSmall,
    injury_time: hero.ghost ? hero.injuryTime : hud.injuryTime,
    injury_artikul_id: hero.ghost ? hero.injuryArtikulId : hud.injuryArtikulId,
  };
}
