import type { Battle } from "../domain/battle.ts";
import { botDuelClockToken } from "../domain/fight-delay-token.ts";
import { persChangeForHit } from "../domain/melee-pers-change.ts";
import type { CombatEvent } from "../ports/combat-port.ts";
import type { HuntMeleeScheduler } from "./hunt-melee-scheduler.ts";

/**
 * Duels of two mobs move on the fight's own clock, not on a player's click: one action of each,
 * every `turnGrantDelayMs`, for as long as such a duel stands. Players see the fresh hit points.
 */
export class CombatBotDuelClock {
  constructor(
    private readonly battleByFight: Map<string, Battle>,
    private readonly scheduler: HuntMeleeScheduler,
    private readonly enqueue: (accountId: number, events: readonly CombatEvent[]) => void,
    private readonly wakeAccount: (accountId: number) => void,
    private readonly settleFinished: (
      battle: Battle,
      events: readonly CombatEvent[],
      strikerAccountId: number | null,
    ) => Promise<void>,
  ) {}

  arm(battle: Battle): void {
    const token = botDuelClockToken(battle.id);
    this.scheduler.cancel(token);
    if (!battle.hasBotDuels()) return;
    this.scheduler.schedule(token, battle.turnGrantDelayMs, () => this.run(battle.id));
  }

  private async run(fightId: string): Promise<void> {
    const battle = this.battleByFight.get(fightId);
    if (!battle || battle.finished) return;
    const events = battle.tickRosterDuels(this.scheduler.now().getTime());
    const board = battle.boardParticipants();
    const patches = events.flatMap((event) =>
      event.type === "damage"
        ? [persChangeForHit(board.humans, board.bots, event.sourceId, event.targetId)]
        : [],
    );
    for (const accountId of battle.authedAccountIds()) {
      if (patches.length === 0) continue;
      this.enqueue(accountId, patches);
      this.wakeAccount(accountId);
    }
    if (battle.finished) {
      await this.settleFinished(battle, events, null);
      return;
    }
    this.arm(battle);
  }
}
