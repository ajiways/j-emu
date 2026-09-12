import { isFriendlyDuelInit, isHumanDuelInit, practiceRestoreFrom } from "./battle-fighters.ts";
import type { FriendlyDuelBattleInit } from "./friendly-duel-battle-init.ts";
import type { HuntBattleInit } from "./hunt-battle-init.ts";
import type { HuntHuman } from "./hunt-human.ts";
import type { FightOutcomeKind, FightOutcomeSnapshot } from "./fight-outcome-snapshot.ts";

export function leaveWinnerTeam(humans: readonly HuntHuman[]): 1 | 2 {
  const remaining = humans.filter((human) => !human.leftLive);
  const last = remaining[remaining.length - 1];
  if (!last) throw new Error("Leave requires a human in the battle");
  return last.hp <= 0 ? 2 : 1;
}

export function battleOutcomeSnapshot(
  input: Readonly<{
    init: HuntBattleInit | FriendlyDuelBattleInit;
    fightId: string;
    kind: FightOutcomeKind;
    winnerTeam: 1 | 2;
    humans: readonly HuntHuman[];
  }>,
): FightOutcomeSnapshot {
  const humans = input.humans.map((human) => ({
    accountId: human.accountId,
    characterId: human.heroId,
    team: human.team,
    level: human.level,
    hp: human.hp,
    maxHp: human.maxHp,
    damageToBot: human.damageToBot,
    damageToHumans: human.damageToHumans,
    leftLive: human.leftLive,
    pocket: human.pocketCells(),
  }));
  if (isHumanDuelInit(input.init) && input.init.kind === "pvp") {
    return {
      mode: "pvp",
      fightId: input.fightId,
      winnerTeam: input.winnerTeam,
      kind: input.kind,
      humans,
    };
  }
  if (isFriendlyDuelInit(input.init)) {
    return {
      mode: "friendly-practice",
      fightId: input.fightId,
      winnerTeam: input.winnerTeam,
      kind: input.kind,
      humans,
      restore: [
        practiceRestoreFrom(input.init.challenger),
        practiceRestoreFrom(input.init.acceptor),
      ],
    };
  }
  return {
    mode: "hunt",
    fightId: input.fightId,
    botId: input.init.botArtikulId,
    botLevel: input.init.botLevel,
    winnerTeam: input.winnerTeam,
    kind: input.kind,
    humans,
  };
}
