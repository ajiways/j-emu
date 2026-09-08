import type {
  Hero,
  HeroCreationPolicy,
  HeroRecord,
  NewHero,
} from "../../src/modules/character/domain/hero.ts";
import { Hero as HeroClass } from "../../src/modules/character/domain/hero.ts";

export const PLAYABLE_HERO_CREATION: HeroCreationPolicy = {
  exp: 1,
  areaId: "503",
  moneyMinor: 2500,
  moneyGoldMinor: 0,
  kind: 1,
  gender: 1,
  language: "ru",
  body: "armor();head(0,0,8,152);skin()",
  sk: 1,
  honor: 0,
  hpTime: 0,
  tutorialInfo: {
    finished_first_fight: "1",
    tutorial2: '{"finished":true}',
  },
  skills: [
    { id: "HPREG", value: 700 },
    { id: "ORATORY", value: 1 },
    { id: "MONEYMOD", value: 0 },
  ],
};

export function playableNewHero(accountId: number, nick: string): NewHero {
  return {
    accountId,
    nick,
    level: 1,
    hp: 10,
    maxHp: 10,
    mp: 12,
    maxMp: 12,
    exp: 1,
    areaId: "503",
    moneyMinor: 2500,
    moneyGoldMinor: 0,
    kind: 1,
    gender: 1,
    language: "ru",
    body: "armor();head(0,0,8,152);skin()",
    sk: 1,
    honor: 0,
    hpTime: 0,
  };
}

export function testHero(overrides: Partial<HeroRecord> = {}): Hero {
  return HeroClass.restore({
    id: 1,
    accountId: 1,
    nick: "Ada",
    level: 1,
    hp: 10,
    maxHp: 10,
    mp: 12,
    maxMp: 12,
    exp: 1,
    areaId: "503",
    moneyMinor: 2500,
    moneyGoldMinor: 0,
    kind: 1,
    gender: 1,
    language: "ru",
    body: "armor();head(0,0,8,152);skin()",
    sk: 1,
    honor: 0,
    hpTime: 0,
    ...overrides,
  });
}
