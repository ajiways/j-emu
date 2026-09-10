import { isFriendlyDuelInit, practiceRestoreFrom } from "./battle-fighters.ts";
import type { FriendlyDuelBattleInit } from "./friendly-duel-battle-init.ts";
import type { HuntBattleInit } from "./hunt-battle-init.ts";
import type { HuntHuman } from "./hunt-human.ts";
import type { FightOutcomeKind, FightOutcomeSnapshot } from "./fight-outcome-snapshot.ts";

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
    level: human.level,
    hp: human.hp,
    damageToBot: human.damageToBot,
    leftLive: human.leftLive,
    pocket: human.pocketCells(),
  }));
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
