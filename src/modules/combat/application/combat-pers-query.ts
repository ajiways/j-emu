import type { Battle } from "../domain/battle.ts";
import { snapshotFightEffects } from "../domain/snapshot-fight-effects.ts";
import type { CombatEvent, FightCommand } from "../ports/combat-port.ts";

export function handlePersFightQuery(
  input: Readonly<{
    accountId: number;
    command: Extract<FightCommand, { kind: "pers-info" | "pers-effects" }>;
    battle: Battle | undefined;
    enqueue: (accountId: number, events: readonly CombatEvent[]) => void;
  }>,
): readonly CombatEvent[] {
  if (input.command.kind === "pers-info") {
    return [{ type: "command-accepted", sequence: input.command.sequence }];
  }
  if (!input.battle) throw new Error("Active fight not found");
  const board = input.battle.boardParticipants();
  const bots = input.battle.bots.map((bot) => ({
    id: bot.fightId,
    effects: bot.effects,
  }));
  input.enqueue(input.accountId, [
    { type: "command-accepted", sequence: input.command.sequence },
    {
      type: "pers-effects",
      persId: input.command.persId,
      effects: snapshotFightEffects(board.humans, bots, input.command.persId),
    },
  ]);
  return [];
}
