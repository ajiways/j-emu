import type { Hero } from "../domain/hero.ts";
import type { PresenceHero } from "../ports/character-presence.ts";

export function toPresenceHero(hero: Hero): PresenceHero {
  return {
    accountId: hero.accountId,
    nick: hero.nick,
    level: hero.level,
    kind: hero.kind,
    gender: hero.gender,
    body: hero.body,
    sk: hero.sk,
    areaId: hero.areaId,
    instanceCopyId: hero.instanceCopyId,
    ghost: hero.ghost,
    injuryTime: hero.injuryTime,
    injuryArtikulId: hero.injuryArtikulId,
  };
}
