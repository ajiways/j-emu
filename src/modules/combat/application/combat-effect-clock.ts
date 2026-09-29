import type { Battle } from "../domain/battle.ts";
import { fightEffectClockToken } from "../domain/fight-delay-token.ts";
import type { CombatEvent } from "../ports/combat-port.ts";
import type { HuntMeleeScheduler } from "./hunt-melee-scheduler.ts";

/** One battle timer wakes at the earliest DoT/HoT threshold or expiry of any fighter. */
export class CombatEffectClock {
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
    private readonly regrant: (battle: Battle, accountId: number) => void,
    private readonly handOff: (battle: Battle, accountId: number) => Promise<void>,
  ) {}

  arm(battle: Battle): void {
    const token = fightEffectClockToken(battle.id);
    this.scheduler.cancel(token);
    const due = battle.nextEffectDueMs();
    if (due === null) return;
    const delayMs = Math.max(1, Math.ceil(due - this.scheduler.now().getTime()));
    this.scheduler.schedule(token, delayMs, () => this.run(battle.id));
  }

  private async run(fightId: string): Promise<void> {
    const battle = this.battleByFight.get(fightId);
    if (!battle || battle.finished) return;
    const outcome = battle.tickDueEffects(this.scheduler.now().getTime());
    for (const delivery of outcome.deliveries) {
      this.enqueue(delivery.accountId, delivery.events);
      this.wakeAccount(delivery.accountId);
    }
    if (outcome.finished) {
      await this.settleFinished(battle, [outcome.finished], null);
      return;
    }
    for (const accountId of outcome.reassignedAccountIds) this.regrant(battle, accountId);
    for (const accountId of outcome.fallenAccountIds) await this.handOff(battle, accountId);
    this.arm(battle);
  }
}
