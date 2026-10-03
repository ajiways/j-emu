import type { Battle } from "../domain/battle.ts";
import type { EndingGloveResult } from "../domain/glove-ending-cast.ts";
import type { CombatEvent } from "../ports/combat-port.ts";
import {
  cancelDuel,
  deliverEffects,
  deliverAggroPairs,
  opponentNewHuman,
  fallenFoeAccounts,
  deliverPairedWaiters,
  deliverGloveSides,
  enqueuePlayerMelee,
  fanoutPersChange,
  fanoutHit,
  fanoutRosterEffects,
  enqueueKeepTurn,
  deliverTurnEmblems,
} from "./combat-melee-dispatch.ts";
import { CombatDuelChanges } from "./combat-duel-changes.ts";
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
    this.changes = new CombatDuelChanges(
      scheduler,
      enqueue,
      wakeAccount,
      (battle, accountId) => this.openDuel(battle, accountId),
      (battle) => this.aiDriver.arm(battle),
    );
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
      (battle, accountId) => this.changes.handOff(battle, accountId),
    );
    this.aiDriver = new CombatAiDriver({
      battleByFight,
      scheduler,
      enqueue,
      wakeAccount,
      settleFinished,
      settleFallout: (battle, fallout) => this.effectClock.settleFallout(battle, fallout),
      handOff: (battle, accountId) => this.changes.handOff(battle, accountId),
      applyShuffle: (battle, accountId) => this.changes.shuffle(battle, accountId),
      deliverChange: (battle, change, previous) => this.changes.announce(battle, change, previous),
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
  private readonly changes: CombatDuelChanges;

  /** The waiting ally of a departed player takes his place across from his foe. */
  replaceFallen(battle: Battle, accountId: number): void {
    this.changes.replace(battle, accountId);
  }
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
        await this.changes.handOff(battle, accountId);
        return;
      }
      if (await this.replaceFallenFoes(battle, accountId, resolved.events)) return;
      await this.followUpAfterStrike(battle, accountId, resolved.events);
    });
  }

  async concentrate(
    battle: Battle,
    accountId: number,
    sequence: string | number,
    nowMs: number,
  ): Promise<void> {
    await this.armAfter(battle, async () => {
      const result = battle.tryConcentration(accountId, nowMs);
      if (result === null) {
        this.enqueue(accountId, [{ type: "command-accepted", sequence }]);
        return;
      }
      this.keepTurn(accountId, sequence, result.events);
      fanoutPersChange(battle, accountId, result.events, this.enqueue, this.wakeAccount);
      if (battle.finished) {
        await this.settleFinished(battle, result.events, accountId);
        return;
      }
      await this.effectClock.settleFallout(battle, result.fallout);
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
        await this.changes.handOff(battle, accountId);
        return;
      }
      if (await this.replaceFallenFoes(battle, accountId, ending.events)) return;
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
    this.enqueue(opponent.accountId, [opponentNewHuman(joiner)]);
    this.wakeAccount(opponent.accountId);
    const opener = battle.nextActorIdOf(joinerAccountId);
    const openerAccount = battle.accountOfParticipant(opener);
    if (openerAccount === null || !battle.authedAccountIds().includes(openerAccount)) return;
    this.giveTurn(battle, opener);
  }

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
    if (this.changes.shuffle(battle, accountId)) return;
    if (!battle.delayTokenFor(accountId)) return;
    const opponent = battle.pairedOpponent(accountId);
    if (opponent.kind === "bot" && events.some((event) => event.type === "opponent-new")) {
      this.openDuel(battle, accountId);
      return;
    }
    if (opponent.kind === "human" && events.some((event) => event.type === "opponent-new-human")) {
      const striker = battle.livingHumans().find((human) => human.accountId === accountId);
      if (!striker) throw new Error("Intervene striker is missing from the battle");
      this.enqueue(opponent.accountId, [opponentNewHuman(striker)]);
      this.wakeAccount(opponent.accountId);
      this.openDuel(battle, accountId);
      return;
    }
    this.passTurnToFoe(battle, accountId);
  }

  /** The turn goes to whoever stands across: a mob acts after a pause, a player is granted it. */
  private passTurnToFoe(battle: Battle, accountId: number): void {
    const foeId = battle.foeIdOf(accountId);
    if (foeId !== null) this.giveTurn(battle, foeId);
  }

  private async replaceFallenFoes(
    battle: Battle,
    actorAccountId: number,
    events: readonly CombatEvent[],
  ): Promise<boolean> {
    const fallen = fallenFoeAccounts(battle, actorAccountId, events);
    for (const accountId of fallen) await this.changes.handOff(battle, accountId);
    return fallen.length > 0;
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
    const now = this.scheduler.now().getTime();
    deliverTurnEmblems(battle, accountId, now, this.enqueue, this.wakeAccount);
    const granted = battle.grantTurn(accountId, now);
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
        await this.changes.handOff(battle, accountId);
        return;
      }
      battle.countPairHit(accountId);
      if (this.changes.shuffle(battle, accountId)) return;
      const botId = battle.foeIdOf(accountId);
      const token = battle.delayTokenFor(accountId);
      if (botId !== null && battle.accountOfParticipant(botId) === null && token) {
        // A turn that timed out is answered at once; the player's next one follows a full round.
        const dueAt = this.scheduler.now().getTime() + battle.turnGrantDelayMs;
        await this.aiDriver.run(fightId, botId, token, dueAt);
        return;
      }
      // The turn goes to whoever stands across: a mob acts after a pause, a player is granted it.
      const foeId = battle.foeIdOf(accountId);
      if (foeId !== null) this.giveTurn(battle, foeId);
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
