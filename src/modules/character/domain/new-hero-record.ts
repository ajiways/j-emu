import type { HeroCreationPolicy, NewHero } from "./hero-record.ts";

/** A hero at level one: full hit points and mana, both regeneration clocks starting now. */
export function newHeroRecord(
  input: Readonly<{
    policy: HeroCreationPolicy;
    accountId: number;
    nick: string;
    vit: number;
    mpMax: number;
    now: Date;
  }>,
): NewHero {
  const { policy } = input;
  return {
    accountId: input.accountId,
    nick: input.nick,
    level: 1,
    hp: input.vit,
    maxHp: input.vit,
    mp: input.mpMax,
    maxMp: input.mpMax,
    exp: policy.exp,
    areaId: policy.areaId,
    moneyMinor: policy.moneyMinor,
    moneyGoldMinor: policy.moneyGoldMinor,
    kind: policy.kind,
    gender: policy.gender,
    language: policy.language,
    body: policy.body,
    sk: policy.sk,
    honor: policy.honor,
    hpTime: 0,
    mpTime: 0,
    regenAt: input.now,
    mpRegenAt: input.now,
    moveReadyAt: null,
    ghost: false,
    injuryTime: 0,
    injuryArtikulId: 0,
    instanceCopyId: null,
  };
}
