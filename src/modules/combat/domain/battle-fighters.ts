import type { FightEffectIds } from "./fight-effect-ids.ts";
import type { FightSetupHuman, FightSetupJoin } from "./fight-setup.ts";
import { HuntHuman } from "./hunt-human.ts";
import type { PracticeRestore } from "./fight-outcome-snapshot.ts";

export function seedHuman(
  fighter: FightSetupHuman,
  team: 1 | 2,
  waiting: boolean,
  startedAtMs: number,
  effectIds: FightEffectIds,
): HuntHuman {
  return new HuntHuman({
    accountId: fighter.accountId,
    heroId: fighter.heroId,
    nick: fighter.nick,
    level: fighter.level,
    kind: fighter.kind,
    hp: fighter.hp,
    maxHp: fighter.maxHp,
    mp: fighter.mp,
    maxMp: fighter.maxMp,
    team,
    waiting,
    strength: fighter.strength,
    initiative: fighter.initiative,
    rage: fighter.rage,
    dexterity: fighter.dexterity,
    defense: fighter.defense,
    block: fighter.block,
    aggroCharges: fighter.aggroCharges,
    magPower: fighter.magPower,
    magResist: fighter.magResist,
    startedAtMs,
    loadout: fighter.loadout,
    appearance: fighter.appearance,
    effectIds,
  });
}

export function seedJoiner(join: FightSetupJoin, effectIds: FightEffectIds): HuntHuman {
  return seedHuman(join, join.team, true, join.startedAtMs, effectIds);
}

export function practiceRestoreFrom(fighter: FightSetupHuman): PracticeRestore {
  return {
    characterId: fighter.heroId,
    hp: fighter.hp,
    mp: fighter.mp,
    pocket: fighter.loadout.pocket.map((row) => ({
      itemId: row.itemId,
      artifactId: row.artifactId,
      position: row.position,
      startCount: row.count,
      currentCount: row.count,
    })),
  };
}
