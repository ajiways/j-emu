import type { Battle } from "../domain/battle.ts";
import type { ShuffleOutcome } from "../domain/try-shuffle-after-hits.ts";
import type { CombatEvent } from "../ports/combat-port.ts";
import { cancelDuel, delayTokensByAccount, deliverDuelChange } from "./combat-melee-dispatch.ts";
import type { FightScheduler } from "./fight-scheduler.ts";

/** Changes of who stands across from whom: a shuffle, or a waiting ally replacing a fallen player. */
export class CombatDuelChanges {
  constructor(
    private readonly scheduler: FightScheduler,
    private readonly enqueue: (accountId: number, events: readonly CombatEvent[]) => void,
    private readonly wakeAccount: (accountId: number) => void,
    private readonly startDuel: (battle: Battle, accountId: number) => void,
    private readonly armAi: (battle: Battle) => void,
  ) {}

  /** The shuffle of the duel `accountId` stands in; `false` when it does not happen. */
  shuffle(battle: Battle, accountId: number): boolean {
    const previous = delayTokensByAccount(battle);
    const shuffle = battle.tryShuffleAfterHits(accountId);
    if (shuffle.kind === "none") return false;
    this.announce(battle, shuffle, previous);
    return true;
  }

  /** The waiting ally of a fallen or departed player takes his place across from his foe. */
  replace(battle: Battle, accountId: number): void {
    const previous = delayTokensByAccount(battle);
    const shuffle = battle.replaceFallen(accountId);
    if (shuffle !== null) this.announce(battle, shuffle, previous);
  }

  /** The fight goes on without a fallen player: he waits and gets the result when it ends. */
  async handOff(battle: Battle, deadAccountId: number): Promise<void> {
    cancelDuel(this.scheduler, battle, deadAccountId);
    this.enqueue(deadAccountId, [{ type: "opponent-wait" }]);
    this.wakeAccount(deadAccountId);
    this.replace(battle, deadAccountId);
  }

  /** Tells the players of a changed duel, starts it, and arms the mobs. */
  announce(
    battle: Battle,
    shuffle: Exclude<ShuffleOutcome, { kind: "none" }>,
    previous: ReadonlyMap<number, string>,
  ): void {
    deliverDuelChange({
      shuffle,
      previous,
      scheduler: this.scheduler,
      enqueue: this.enqueue,
      wakeAccount: this.wakeAccount,
      startDuel: (id) => this.startDuel(battle, id),
    });
    this.armAi(battle);
  }
}
