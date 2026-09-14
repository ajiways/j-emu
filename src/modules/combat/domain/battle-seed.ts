import { FightDuel } from "./fight-duel.ts";
import type { BattleRules } from "./battle-rules.ts";
import { friendlyHuman, huntOpener, isHumanDuelInit } from "./battle-fighters.ts";
import type { FriendlyDuelBattleInit } from "./friendly-duel-battle-init.ts";
import type { HuntBattleInit } from "./hunt-battle-init.ts";
import type { HuntHuman } from "./hunt-human.ts";
import { HuntRoster } from "./hunt-roster.ts";
import { requireFriendlyDuelBattleInit } from "./require-friendly-duel-battle-init.ts";
import { requireHuntBattleInit } from "./require-hunt-battle-init.ts";

export type BattleSeed = Readonly<{
  kind: "hunt" | "friendly-duel" | "pvp";
  huntRoster: HuntRoster | null;
  pairedAccountId: number;
  humans: readonly HuntHuman[];
  duels: readonly FightDuel[];
}>;

export function seedBattleParticipants(
  init: HuntBattleInit | FriendlyDuelBattleInit,
  rules: BattleRules,
): BattleSeed {
  if (isHumanDuelInit(init)) {
    requireFriendlyDuelBattleInit(init, rules);
    return {
      kind: init.kind,
      huntRoster: null,
      pairedAccountId: init.challenger.accountId,
      humans: [
        friendlyHuman(init.challenger, 1, false, init.startedAt.getTime()),
        friendlyHuman(init.acceptor, 2, false, init.startedAt.getTime()),
      ],
      duels: [new FightDuel(init.challenger.heroId, init.acceptor.heroId, init.challenger.heroId)],
    };
  }
  requireHuntBattleInit(init, rules);
  return {
    kind: "hunt",
    huntRoster: new HuntRoster(init),
    pairedAccountId: init.accountId,
    humans: [huntOpener(init)],
    duels: [new FightDuel(init.heroId, init.botFightId, init.heroId)],
  };
}
