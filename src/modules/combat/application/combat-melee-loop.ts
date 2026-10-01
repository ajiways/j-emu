import type { Battle } from "../domain/battle.ts";
import type { EndingGloveResult } from "../domain/glove-ending-cast.ts";
import type { CombatEvent } from "../ports/combat-port.ts";
import {
  cancelDuel,
  deliverEffects,
  deliverAggroPairs,
  deliverShuffle,
  deliverPairedWaiters,
  deliverGloveSides,
  delayTokensByAccount,
  shuffleAffectedAccountIds,
  enqueuePlayerMelee,
  fanoutPersChange,
  fanoutHit,
  fanoutRosterEffects,
  enqueueKeepTurn,
} from "./combat-melee-dispatch.ts";
import { CombatAiDriver } from "./combat-ai-driver.ts";
import { CombatEffectClock } from "./combat-effect-clock.ts";
import type { FightScheduler } from "./fight-scheduler.ts";

export class CombatMeleeLoop {
  constructor(
    private readonly byAccount: Map<number, Battle>,
    private readonly battleByFight: Map<string, Battle>,
    private readonly scheduler: FightScheduler,
    private readonly enqueue: (
      accountId: number,
      events: readonly CombatEvent[],
      at?: "head" | "tail",
    ) => void,
    private readonly wakeAccount: (accountId: number) => void,
    private readonly settleFinished: (
      battle: Battle,
      events: readonly CombatEvent[],
      strikerAccountId: number | null,
    ) => Promise<void>,
  ) {
    this.effectClock = new CombatEffectClock(
      battleByFight,
      scheduler,
      enqueue,
      wakeAccount,
      settleFinished,
      (battle, accountId) => {
        cancelDuel(this.scheduler, battle, accountId);
        this.openDuel(battle, accountId);
      },
      (battle, accountId) => this.handOffToWaiter(battle, accountId),
    );
    this.aiDriver = new CombatAiDriver({
      battleByFight,
      scheduler,
      enqueue,
      wakeAccount,
      settleFinished,
      settleFallout: (battle, fallout) => this.effectClock.settleFallout(battle, fallout),
      handOff: (battle, accountId) => this.handOffToWaiter(battle, accountId),
      applyShuffle: (battle, accountId) => this.applyShuffle(battle, accountId),
      grantPlayer: (battle, accountId, delayMs) => {
        const token = battle.delayTokenFor(accountId);
        if (!token) return;
        // A turn that ran late owes its player no further wait: the round is already over.
        if (delayMs < 1) this.runGrant(battle.id, accountId);
        else scheduler.schedule(token, delayMs, () => this.runGrant(battle.id, accountId));
      },
      armEffects: (battle) => this.effectClock.arm(battle),
      announcePaired: (battle, accountIds) =>
        deliverPairedWaiters({
          battle,
          accountIds,
          enqueue,
          wakeAccount,
          grantPairedBot: (id) => this.openDuel(battle, id),
          notifyJoinedPair: (id) => this.notifyJoinedPair(battle, id),
        }),
    });
  }

  private readonly effectClock: CombatEffectClock;
  private readonly aiDriver: CombatAiDriver;

  async strike(
    accountId: number,
    side: "left" | "center" | "right",
    sequence: string | number,
  ): Promise<void> {
    await this.armAfter(this.byAccount.get(accountId), async (battle) => {
      if (!battle) {
        this.enqueue(accountId, [{ type: "command-accepted", sequence }]);
        return;
      }
      cancelDuel(this.scheduler, battle, accountId);
      const resolved = battle.tryPlayerMelee(accountId, side, this.scheduler.now().getTime());
      if (resolved.kind === "ignored") {
        this.enqueue(accountId, [{ type: "command-accepted", sequence }]);
        return;
      }
      enqueuePlayerMelee(this.enqueue, battle, accountId, sequence, resolved.events);
      fanoutHit(battle, accountId, resolved.events, this.enqueue, this.wakeAccount);
      if (battle.finished) {
        await this.settleFinished(battle, resolved.events, accountId);
        return;
      }
      if (resolved.selfKilled) {
        await this.handOffToWaiter(battle, accountId);
        return;
      }
      await this.followUpAfterStrike(battle, accountId, resolved.events);
    });
  }

  keepTurn(accountId: number, sequence: string | number, events: readonly CombatEvent[]): void {
    const battle = this.byAccount.get(accountId);
    enqueueKeepTurn(this.enqueue, this.wakeAccount, battle, accountId, sequence, events);
  }

  async endingGlove(
    accountId: number,
    sequence: string | number,
    ending: EndingGloveResult,
  ): Promise<void> {
    await this.armAfter(this.byAccount.get(accountId), async (battle) => {
      if (!battle) {
        this.enqueue(accountId, [{ type: "command-accepted", sequence }]);
        return;
      }
      cancelDuel(this.scheduler, battle, accountId);
      this.enqueue(accountId, [{ type: "command-accepted", sequence }, ...ending.events]);
      const sideIds = new Set(ending.sideNotifies.map((notify) => notify.accountId));
      fanoutPersChange(battle, accountId, ending.events, this.enqueue, this.wakeAccount, sideIds);
      fanoutRosterEffects(battle, accountId, ending.events, this.enqueue, this.wakeAccount);
      await Promise.resolve();
      deliverGloveSides({
        battle,
        ending,
        scheduler: this.scheduler,
        enqueue: this.enqueue,
        wakeAccount: this.wakeAccount,
        grantPairedBot: (accountId) => this.openDuel(battle, accountId),
      });
      if (battle.finished) {
        await this.settleFinished(battle, ending.events, accountId);
        return;
      }
      if (ending.selfKilled) {
        await this.handOffToWaiter(battle, accountId);
        return;
      }
      await this.followUpAfterStrike(battle, accountId, ending.events);
    });
  }

  /**
   * Gives the turn to participant `participantId`, whoever controls him: a player is granted it
   * after `turnGrantDelayMs`, a mob acts after `meleeBotCounterMs`. The one place a turn starts.
   */
  giveTurn(battle: Battle, participantId: number): void {
    const accountId = battle.accountOfParticipant(participantId);
    if (accountId === null) return this.aiDriver.schedule(battle, participantId);
    const token = battle.delayTokenFor(accountId);
    if (!token) throw new Error("Cannot grant a turn without a live duel");
    this.scheduler.schedule(token, battle.turnGrantDelayMs, () =>
      this.runGrant(battle.id, accountId),
    );
  }

  /** A duel of `accountId` has just been made: its opener gets the first turn. */
  private openDuel(battle: Battle, accountId: number): void {
    this.giveTurn(battle, battle.nextActorIdOf(accountId));
  }

  /** Arms what runs without a click: mob duels already standing when a player arrives. */
  armFightClocks(battle: Battle): void {
    this.aiDriver.arm(battle);
  }

  armTurnTimeout(battle: Battle, accountId: number): void {
    const human = battle.livingHumans().find((entry) => entry.accountId === accountId);
    if (!human?.turnActive) return;
    const token = battle.delayTokenFor(accountId);
    if (!token) return;
    const rest = human.remainingTurnSeconds(this.scheduler.now().getTime());
    if (rest === null) throw new Error("Open turn is missing a deadline");
    this.scheduler.cancel(token);
    const fightId = battle.id;
    if (rest < 1) {
      void this.runTurnTimeout(fightId, accountId);
      return;
    }
    this.scheduler.schedule(token, rest * 1000, () => this.runTurnTimeout(fightId, accountId));
  }

  notifyJoinedPair(battle: Battle, joinerAccountId: number): void {
    const joiner = battle.livingHumans().find((human) => human.accountId === joinerAccountId);
    if (!joiner || joiner.waiting) return;
    const opponent = battle.pairedOpponent(joinerAccountId);
    if (opponent.kind === "bot") {
      this.openDuel(battle, joinerAccountId);
      return;
    }
    if (!battle.authedAccountIds().includes(opponent.accountId)) return;
    this.enqueue(opponent.accountId, [
      {
        type: "opponent-new-human",
        human: joiner.snapshot(),
        appearance: joiner.appearance,
      },
    ]);
    this.wakeAccount(opponent.accountId);
    const opener = battle.nextActorIdOf(joinerAccountId);
    const openerAccount = battle.accountOfParticipant(opener);
    if (openerAccount === null || !battle.authedAccountIds().includes(openerAccount)) return;
    this.giveTurn(battle, opener);
  }

  /** An idol's phantom joined: the others see the new roster, and whoever is waiting gets paired. */
  notifySummon(battle: Battle, casterAccountId: number, events: readonly CombatEvent[]): void {
    const roster = events.find((event) => event.type === "roster-updated");
    if (!roster) throw new Error("An idol cast must report the roster update");
    for (const accountId of battle.authedAccountIds()) {
      if (accountId === casterAccountId) continue;
      this.enqueue(accountId, [roster]);
      this.wakeAccount(accountId);
    }
    this.aiDriver.arm(battle);
  }

  notifyAggroPairs(
    battle: Battle,
    casterAccountId: number,
    pairedAccountIds: readonly number[],
    roster: Extract<CombatEvent, { type: "roster-updated" }> | null,
  ): void {
    deliverAggroPairs({
      battle,
      casterAccountId,
      pairedAccountIds,
      roster,
      enqueue: this.enqueue,
      wakeAccount: this.wakeAccount,
      grantPairedBot: (accountId) => this.openDuel(battle, accountId),
    });
  }

  private async followUpAfterStrike(
    battle: Battle,
    accountId: number,
    events: readonly CombatEvent[],
  ): Promise<void> {
    if (this.applyShuffle(battle, accountId)) return;
    if (!battle.delayTokenFor(accountId)) return;
    const opponent = battle.pairedOpponent(accountId);
    if (opponent.kind === "bot" && events.some((event) => event.type === "opponent-new")) {
      this.openDuel(battle, accountId);
      return;
    }
    if (opponent.kind === "human" && events.some((event) => event.type === "opponent-new-human")) {
      const striker = battle.livingHumans().find((human) => human.accountId === accountId);
      if (!striker) throw new Error("Intervene striker is missing from the battle");
      this.enqueue(opponent.accountId, [
        {
          type: "opponent-new-human",
          human: striker.snapshot(),
          appearance: striker.appearance,
        },
      ]);
      this.wakeAccount(opponent.accountId);
    }
    this.passTurnToFoe(battle, accountId);
  }

  /**
   * The turn goes to whoever stands across from `accountId`: a mob acts after a pause, a player
   * is granted it. The one place a turn is handed on after an action, a stunned turn or a timeout.
   */
  private passTurnToFoe(battle: Battle, accountId: number): void {
    const foeId = battle.foeIdOf(accountId);
    if (foeId !== null) this.giveTurn(battle, foeId);
  }

  private async handOffToWaiter(battle: Battle, deadAccountId: number): Promise<void> {
    cancelDuel(this.scheduler, battle, deadAccountId);
    // The fight goes on without him: he waits (and may leave where the fight allows it, old
    // server `flee`) and gets the result with everyone else when it ends.
    this.enqueue(deadAccountId, [{ type: "opponent-wait" }]);
    this.wakeAccount(deadAccountId);
    const waiter = battle.pairNextWaiter(deadAccountId);
    if (!waiter) {
      battle.dissolveDuelOf(deadAccountId);
      return;
    }
    if (!waiter.authed) return;
    this.enqueue(waiter.accountId, waiter.events);
    this.wakeAccount(waiter.accountId);
    this.giveTurn(battle, battle.heroIdFor(waiter.accountId));
  }

  private applyShuffle(battle: Battle, accountId: number): boolean {
    const previousByAccount = delayTokensByAccount(battle);
    const shuffle = battle.tryShuffleAfterHits(accountId);
    if (shuffle.kind === "none") return false;
    for (const id of shuffleAffectedAccountIds(shuffle)) {
      const token = previousByAccount.get(id);
      if (token) this.scheduler.cancel(token);
    }
    deliverShuffle({
      battle,
      shuffle,
      enqueue: this.enqueue,
      wakeAccount: this.wakeAccount,
      grantAfterPair: (id) => this.giveTurn(battle, battle.heroIdFor(id)),
      grantPairedBot: (id) => this.openDuel(battle, id),
    });
    this.aiDriver.arm(battle);
    return true;
  }

  private runGrant(fightId: string, accountId: number): void {
    const battle = this.battleByFight.get(fightId);
    if (!battle || battle.finished) return;
    if (!battle.accountIds().includes(accountId)) return;
    const skipped = battle.consumeStunSkip(accountId);
    if (skipped) {
      deliverEffects(battle, accountId, skipped, this.enqueue, this.wakeAccount);
      return this.passTurnToFoe(battle, accountId);
    }
    const granted = battle.grantTurn(accountId, this.scheduler.now().getTime());
    if (!granted) return;
    this.enqueue(accountId, [granted]);
    this.wakeAccount(accountId);
    this.armTurnTimeout(battle, accountId);
  }

  private async runTurnTimeout(fightId: string, accountId: number): Promise<void> {
    await this.armAfter(this.battleByFight.get(fightId), async (battle) => {
      if (!battle || battle.finished) return;
      if (!battle.accountIds().includes(accountId)) return;
      if (!battle.livingHumans().some((entry) => entry.accountId === accountId)) return;
      const timeout = battle.timeoutTurn(accountId, this.scheduler.now().getTime());
      if (!timeout) return;
      deliverEffects(battle, accountId, timeout.events, this.enqueue, this.wakeAccount);
      if (battle.finished) {
        await this.settleFinished(battle, timeout.events, accountId);
        return;
      }
      if (timeout.fell) {
        await this.handOffToWaiter(battle, accountId);
        return;
      }
      battle.countPairHit(accountId);
      if (this.applyShuffle(battle, accountId)) return;
      const botId = battle.foeIdOf(accountId);
      const token = battle.delayTokenFor(accountId);
      if (botId !== null && battle.accountOfParticipant(botId) === null && token) {
        // A turn that timed out is answered at once; the player's next one follows a full round.
        const dueAt = this.scheduler.now().getTime() + battle.turnGrantDelayMs;
        await this.aiDriver.run(fightId, botId, token, dueAt);
        return;
      }
      this.passTurnToFoe(battle, accountId);
    });
  }

  /** Runs one action of a battle, then re-arms its effect timer for what the action changed. */
  private async armAfter(
    battle: Battle | undefined,
    work: (battle: Battle | undefined) => Promise<void>,
  ): Promise<void> {
    await work(battle);
    if (!battle || battle.finished) return;
    this.effectClock.arm(battle);
    this.aiDriver.arm(battle);
  }
}
