import type { FriendlyDuelBattleInit } from "./friendly-duel-battle-init.ts";
import type { HuntBattleInit } from "./hunt-battle-init.ts";
import type { HuntJoinHuman } from "./hunt-join-human.ts";
import { huntFightOpenerTeam } from "./hunt-fight-teams.ts";
import { HuntHuman } from "./hunt-human.ts";
import type { PracticeRestore } from "./fight-outcome-snapshot.ts";

export function isFriendlyDuelInit(
  init: HuntBattleInit | FriendlyDuelBattleInit,
): init is FriendlyDuelBattleInit {
  return "kind" in init && init.kind === "friendly-duel";
}

export function isHumanDuelInit(
  init: HuntBattleInit | FriendlyDuelBattleInit,
): init is FriendlyDuelBattleInit {
  return "kind" in init && (init.kind === "friendly-duel" || init.kind === "pvp");
}

export function huntOpener(init: HuntBattleInit): HuntHuman {
  return new HuntHuman({
    accountId: init.accountId,
    heroId: init.heroId,
    nick: init.heroNick,
    level: init.heroLevel,
    kind: init.heroKind,
    hp: init.playerHp,
    maxHp: init.playerMaxHp,
    mp: init.heroMp,
    maxMp: init.heroMaxMp,
    team: huntFightOpenerTeam(init.purpose),
    waiting: false,
    strength: init.heroStrength,
    startedAtMs: init.startedAt.getTime(),
    loadout: init.loadout,
    appearance: null,
  });
}

export function huntJoiner(join: HuntJoinHuman): HuntHuman {
  return new HuntHuman({
    accountId: join.accountId,
    heroId: join.heroId,
    nick: join.nick,
    level: join.level,
    kind: join.kind,
    hp: join.hp,
    maxHp: join.maxHp,
    mp: join.mp,
    maxMp: join.maxMp,
    team: 1,
    waiting: true,
    strength: join.strength,
    startedAtMs: join.startedAtMs,
    loadout: join.loadout,
    appearance: null,
  });
}

export function friendlyHuman(
  fighter: FriendlyDuelBattleInit["challenger"],
  team: 1 | 2,
  waiting: boolean,
  startedAtMs: number,
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
    startedAtMs,
    loadout: fighter.loadout,
    appearance: { avatar: fighter.avatar, body: fighter.body, sk: fighter.sk },
  });
}

export function practiceRestoreFrom(
  fighter: FriendlyDuelBattleInit["challenger"],
): PracticeRestore {
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
