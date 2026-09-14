import { randomBytes } from "node:crypto";
import { Battle } from "../domain/battle.ts";
import type { BattleRules } from "../domain/battle-rules.ts";
import type { RandomSource } from "../domain/random-source.ts";
import type { FightStart, FriendlyDuelStartInput } from "../ports/combat-port.ts";
import { friendlyDuelInitFromStart } from "./friendly-duel-init-from-start.ts";

export function startHumanDuelBattle(
  input: FriendlyDuelStartInput,
  kind: "friendly-duel" | "pvp",
  deps: Readonly<{
    byAccount: Map<number, Battle>;
    battleByFight: Map<string, Battle>;
    rules: BattleRules;
    random: RandomSource;
    now: Date;
    requireFightId: (fightId: string) => string;
  }>,
): FightStart {
  if (deps.byAccount.has(input.challenger.accountId)) {
    throw new Error("Challenger already has an active fight");
  }
  if (deps.byAccount.has(input.acceptor.accountId)) {
    throw new Error("Acceptor already has an active fight");
  }
  const fightId = deps.requireFightId(input.fightId);
  if (deps.battleByFight.has(fightId)) throw new Error(`Fight ${fightId} is already active`);
  const accessKey = randomBytes(16).toString("hex");
  const battle = new Battle(
    friendlyDuelInitFromStart(input, accessKey, deps.now, kind),
    deps.rules,
    deps.random,
  );
  deps.byAccount.set(input.challenger.accountId, battle);
  deps.byAccount.set(input.acceptor.accountId, battle);
  deps.battleByFight.set(fightId, battle);
  return {
    fightId,
    accessKey,
    participantId: input.acceptor.heroId,
    arena: input.arena,
  };
}
