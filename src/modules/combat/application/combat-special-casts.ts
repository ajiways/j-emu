import type { Battle } from "../domain/battle.ts";
import type { EphemeralBotFightIds } from "../domain/ephemeral-bot-fight-ids.ts";
import type { CombatEvent, FightCommand } from "../ports/combat-port.ts";
import type { CombatMeleeLoop } from "./combat-melee-loop.ts";
import type { PendingConsumes } from "./pending-consumes.ts";
import { handlePersFightQuery } from "./combat-pers-query.ts";

export async function finishFightCommand(
  input: Readonly<{
    accountId: number;
    command: Extract<
      FightCommand,
      {
        kind:
          | "pocket"
          | "idol"
          | "glove"
          | "rage"
          | "aggro"
          | "concentrate"
          | "pers-info"
          | "pers-effects";
      }
    >;
    battle: Battle | undefined;
    nowMs: number;
    botFightIds: EphemeralBotFightIds;
    melee: CombatMeleeLoop;
    pendingConsume: PendingConsumes;
    enqueue: (accountId: number, events: readonly CombatEvent[]) => void;
  }>,
): Promise<readonly CombatEvent[]> {
  if (input.command.kind === "pers-info" || input.command.kind === "pers-effects") {
    return handlePersFightQuery({
      accountId: input.accountId,
      command: input.command,
      battle: input.battle,
      nowMs: input.nowMs,
      enqueue: input.enqueue,
    });
  }
  await castFightSpecial({ ...input, command: input.command });
  return [];
}

async function castFightSpecial(
  input: Readonly<{
    accountId: number;
    command: Extract<
      FightCommand,
      { kind: "pocket" | "idol" | "glove" | "rage" | "aggro" | "concentrate" }
    >;
    battle: Battle | undefined;
    nowMs: number;
    botFightIds: EphemeralBotFightIds;
    melee: CombatMeleeLoop;
    pendingConsume: PendingConsumes;
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
  if (command.kind === "idol") {
    const resolved = battle.tryIdol(accountId, command.itemId, command.sequence, () =>
      input.botFightIds.allocate(battle.heroIdFor(accountId)),
    );
    finishKeepTurn(input, resolved);
    if (resolved.kind === "resolved") input.melee.notifySummon(battle, accountId, resolved.events);
    return;
  }
  if (command.kind === "concentrate") {
    await input.melee.concentrate(battle, accountId, command.sequence, input.nowMs);
    return;
  }
  if (command.kind === "rage") {
    finishKeepTurn(input, battle.tryRage(accountId));
    return;
  }
  if (command.kind === "aggro") {
    const resolved = battle.tryAggro(accountId, command.targetId, () =>
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
  const resolved = battle.tryGlove(accountId, command, input.nowMs);
  if (resolved.kind === "ending") {
    await input.melee.endingGlove(accountId, command.sequence, resolved);
    return;
  }
  finishKeepTurn(input, resolved);
}

function finishKeepTurn(
  input: Readonly<{
    accountId: number;
    command: Extract<
      FightCommand,
      { kind: "pocket" | "idol" | "glove" | "rage" | "aggro" | "concentrate" }
    >;
    melee: CombatMeleeLoop;
    pendingConsume: PendingConsumes;
    enqueue: (accountId: number, events: readonly CombatEvent[]) => void;
  }>,
  resolved:
    | { kind: "ignored" }
    | {
        kind: "resolved";
        events: readonly CombatEvent[];
        consumePocketItemId?: number;
        consumeBagItemId?: number;
      },
): void {
  if (resolved.kind === "ignored") {
    input.enqueue(input.accountId, [
      { type: "command-accepted", sequence: input.command.sequence },
    ]);
    return;
  }
  if (resolved.consumePocketItemId !== undefined) {
    input.pendingConsume.setPocket(input.accountId, resolved.consumePocketItemId);
  }
  if (resolved.consumeBagItemId !== undefined) {
    input.pendingConsume.setBag(input.accountId, resolved.consumeBagItemId);
  }
  input.melee.keepTurn(input.accountId, input.command.sequence, resolved.events);
}
