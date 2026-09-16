import type { Battle } from "../domain/battle.ts";
import type { EphemeralBotFightIds } from "../domain/ephemeral-bot-fight-ids.ts";
import type { CombatEvent, FightCommand } from "../ports/combat-port.ts";
import type { CombatMeleeLoop } from "./combat-melee-loop.ts";
import { handlePersFightQuery } from "./combat-pers-query.ts";

export async function finishFightCommand(
  input: Readonly<{
    accountId: number;
    command: Extract<
      FightCommand,
      { kind: "pocket" | "glove" | "rage" | "aggro" | "pers-info" | "pers-effects" }
    >;
    battle: Battle | undefined;
    nowMs: number;
    botFightIds: EphemeralBotFightIds;
    melee: CombatMeleeLoop;
    pendingPocketConsume: Map<number, number>;
    enqueue: (accountId: number, events: readonly CombatEvent[]) => void;
  }>,
): Promise<readonly CombatEvent[]> {
  if (input.command.kind === "pers-info" || input.command.kind === "pers-effects") {
    return handlePersFightQuery({
      accountId: input.accountId,
      command: input.command,
      battle: input.battle,
      enqueue: input.enqueue,
    });
  }
  await castFightSpecial({ ...input, command: input.command });
  return [];
}

async function castFightSpecial(
  input: Readonly<{
    accountId: number;
    command: Extract<FightCommand, { kind: "pocket" | "glove" | "rage" | "aggro" }>;
    battle: Battle | undefined;
    nowMs: number;
    botFightIds: EphemeralBotFightIds;
    melee: CombatMeleeLoop;
    pendingPocketConsume: Map<number, number>;
    enqueue: (accountId: number, events: readonly CombatEvent[]) => void;
  }>,
): Promise<void> {
  const { accountId, command, battle } = input;
  if (!battle) {
    input.enqueue(accountId, [{ type: "command-accepted", sequence: command.sequence }]);
    return;
  }
  if (command.kind === "pocket") {
    finishKeepTurn(
      input,
      battle.tryPocket(accountId, command.itemId, input.nowMs, command.sequence),
    );
    return;
  }
  if (command.kind === "rage") {
    finishKeepTurn(input, battle.tryRage(accountId));
    return;
  }
  if (command.kind === "aggro") {
    const resolved = battle.tryAggro(accountId, () =>
      input.botFightIds.allocate(battle.heroIdFor(accountId)),
    );
    finishKeepTurn(input, resolved);
    if (resolved.kind === "resolved") {
      const roster = resolved.events.find((event) => event.type === "roster-updated");
      input.melee.notifyAggroPairs(
        battle,
        accountId,
        resolved.pairedAccountIds,
        roster?.type === "roster-updated" ? roster : null,
      );
    }
    return;
  }
  const resolved = battle.tryGlove(accountId, command.spellId, command.sequence, input.nowMs);
  if (resolved.kind === "ending") {
    await input.melee.endingGlove(accountId, command.sequence, resolved);
    return;
  }
  finishKeepTurn(input, resolved);
}

function finishKeepTurn(
  input: Readonly<{
    accountId: number;
    command: Extract<FightCommand, { kind: "pocket" | "glove" | "rage" | "aggro" }>;
    melee: CombatMeleeLoop;
    pendingPocketConsume: Map<number, number>;
    enqueue: (accountId: number, events: readonly CombatEvent[]) => void;
  }>,
  resolved:
    | { kind: "ignored" }
    | { kind: "resolved"; events: readonly CombatEvent[]; consumePocketItemId?: number },
): void {
  if (resolved.kind === "ignored") {
    input.enqueue(input.accountId, [
      { type: "command-accepted", sequence: input.command.sequence },
    ]);
    return;
  }
  if (resolved.consumePocketItemId !== undefined) {
    input.pendingPocketConsume.set(input.accountId, resolved.consumePocketItemId);
  }
  input.melee.keepTurn(input.accountId, input.command.sequence, resolved.events);
}
