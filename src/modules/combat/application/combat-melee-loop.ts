import type { Battle } from "../domain/battle.ts";
import type { EndingGloveResult } from "../domain/glove-ending-cast.ts";
import { timeoutHumanTurn } from "../domain/timeout-human-turn.ts";
import type { CombatEvent, FightExit } from "../ports/combat-port.ts";
import {
  cancelDuel,
  delayTokensByAccount,
  enqueuePlayerMelee,
  fanoutPersChange,
  fanoutRosterEffects,
} from "./combat-melee-dispatch.ts";
import type { HuntMeleeScheduler } from "./hunt-melee-scheduler.ts";

export class CombatMeleeLoop {
  constructor(
    private readonly byAccount: Map<number, Battle>,
    private readonly battleByFight: Map<string, Battle>,
    private readonly scheduler: HuntMeleeScheduler,
    private readonly enqueue: (
      accountId: number,
      events: readonly CombatEvent[],
      at?: "head" | "tail",
    ) => void,
    private readonly wakeAccount: (accountId: number) => void,
    private readonly settleFinished: (
      battle: Battle,
      events: readonly CombatEvent[],
      strikerAccountId: number,
    ) => Promise<void>,
    private readonly departHuman: (battle: Battle, accountId: number) => Promise<void>,
    private readonly queueExit: (accountId: number, fightId: string, exit: FightExit) => void,
  ) {}

  async strike(
    accountId: number,
    side: "left" | "center" | "right",
    sequence: string | number,
  ): Promise<void> {
    const battle = this.byAccount.get(accountId);
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
    enqueuePlayerMelee(this.enqueue, accountId, sequence, resolved.events);
    fanoutPersChange(battle, accountId, resolved.events, this.enqueue, this.wakeAccount);
    fanoutRosterEffects(battle, accountId, resolved.events, this.enqueue, this.wakeAccount);
    if (battle.finished) {
      await this.settleFinished(battle, resolved.events, accountId);
      return;
    }
    await this.followUpAfterStrike(battle, accountId, resolved.events);
  }

  keepTurn(accountId: number, sequence: string | number, events: readonly CombatEvent[]): void {
    this.enqueue(accountId, [{ type: "command-accepted", sequence }, ...events]);
    const battle = this.byAccount.get(accountId);
    if (battle) fanoutRosterEffects(battle, accountId, events, this.enqueue, this.wakeAccount);
  }

  async endingGlove(
    accountId: number,
    sequence: string | number,
    ending: EndingGloveResult,
  ): Promise<void> {
    const battle = this.byAccount.get(accountId);
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
    this.deliverGloveSides(battle, ending);
    if (battle.finished) {
      await this.settleFinished(battle, ending.events, accountId);
      return;
    }
    await this.followUpAfterStrike(battle, accountId, ending.events);
  }

  grantAfterPair(battle: Battle, accountId: number): void {
    const token = battle.delayTokenFor(accountId);
    if (!token) throw new Error("Cannot grant a turn without a live duel");
    this.scheduler.schedule(token, battle.turnGrantDelayMs, () =>
      this.runGrant(battle.id, accountId),
    );
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
      this.grantPairedBot(battle, joinerAccountId);
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
    const opener = battle.nextActorAccountId(joinerAccountId);
    if (!battle.authedAccountIds().includes(opener)) return;
    this.grantAfterPair(battle, opener);
  }

  notifyAggroPairs(
    battle: Battle,
    casterAccountId: number,
    pairedAccountIds: readonly number[],
    roster: Extract<CombatEvent, { type: "roster-updated" }> | null,
  ): void {
    for (const accountId of battle.authedAccountIds()) {
      if (accountId === casterAccountId || !roster) continue;
      this.enqueue(accountId, [roster]);
      this.wakeAccount(accountId);
    }
    for (const accountId of pairedAccountIds) {
      const human = battle.livingHumans().find((entry) => entry.accountId === accountId);
      if (!human || human.waiting) continue;
      if (human.authed) {
        this.enqueue(accountId, [{ type: "opponent-new", bot: battle.foeBotSnap(accountId) }]);
        this.wakeAccount(accountId);
      }
      this.grantPairedBot(battle, accountId);
    }
  }

  private async followUpAfterStrike(
    battle: Battle,
    accountId: number,
    events: readonly CombatEvent[],
  ): Promise<void> {
    const extra = battle.tickRosterDuels();
    if (extra.length > 0) this.enqueue(accountId, extra);
    if (battle.finished) {
      await this.settleFinished(battle, extra, accountId);
      return;
    }
    if (this.applyShuffle(battle, accountId)) return;
    const token = battle.delayTokenFor(accountId);
    if (!token) return;
    const opponent = battle.pairedOpponent(accountId);
    if (opponent.kind === "bot") {
      if (events.some((event) => event.type === "opponent-new")) {
        this.grantPairedBot(battle, accountId);
        return;
      }
      this.scheduleBotAndGrant(battle, accountId);
      return;
    }
    if (events.some((event) => event.type === "opponent-new-human")) {
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
    this.scheduler.schedule(token, battle.turnGrantDelayMs, () =>
      this.runGrant(battle.id, opponent.accountId),
    );
  }

  private scheduleBotAndGrant(battle: Battle, strikerAccountId: number): void {
    const token = battle.delayTokenFor(strikerAccountId);
    if (!token) throw new Error("Cannot schedule a bot follow-up without a live duel");
    const fightId = battle.id;
    this.scheduler.schedule(token, battle.meleeBotCounterMs, () =>
      this.runBotCounter(fightId, strikerAccountId),
    );
    this.scheduler.schedule(token, battle.turnGrantDelayMs, () =>
      this.runGrant(fightId, strikerAccountId),
    );
  }

  private async runBotCounter(fightId: string, targetAccountId: number): Promise<void> {
    const battle = this.battleByFight.get(fightId);
    if (!battle || battle.finished) return;
    if (!battle.accountIds().includes(targetAccountId)) return;
    const result = battle.resolveBotMelee(targetAccountId);
    this.enqueue(targetAccountId, result.events);
    fanoutPersChange(battle, targetAccountId, result.events, this.enqueue, this.wakeAccount);
    fanoutRosterEffects(battle, targetAccountId, result.events, this.enqueue, this.wakeAccount);
    this.wakeAccount(targetAccountId);
    if (!result.killedPlayer) {
      const extra = battle.tickRosterDuels();
      if (extra.length > 0) this.enqueue(targetAccountId, extra);
      if (battle.finished) {
        await this.settleFinished(battle, extra, targetAccountId);
        return;
      }
      this.applyShuffle(battle, targetAccountId);
      return;
    }
    if (battle.finished) {
      await this.settleFinished(battle, result.events, targetAccountId);
      return;
    }
    await this.handOffToWaiter(battle, targetAccountId);
  }

  private async handOffToWaiter(battle: Battle, deadAccountId: number): Promise<void> {
    cancelDuel(this.scheduler, battle, deadAccountId);
    this.enqueue(deadAccountId, [{ type: "finished", winnerTeam: 2, fightId: battle.id }]);
    await this.departHuman(battle, deadAccountId);
    this.queueExit(deadAccountId, battle.id, { fightId: battle.id, winnerTeam: 2 });
    this.byAccount.delete(deadAccountId);
    this.wakeAccount(deadAccountId);
    const waiter = battle.pairNextWaiter(deadAccountId);
    if (!waiter) {
      battle.dissolveDuelOf(deadAccountId);
      return;
    }
    if (!waiter.authed) return;
    this.enqueue(waiter.accountId, waiter.events);
    this.wakeAccount(waiter.accountId);
    this.grantAfterPair(battle, waiter.accountId);
  }

  private applyShuffle(battle: Battle, accountId: number): boolean {
    const previousByAccount = delayTokensByAccount(battle);
    const shuffle = battle.tryShuffleAfterHits(accountId);
    if (shuffle.kind === "none") return false;
    const affected =
      shuffle.kind === "waiter-handoff"
        ? [shuffle.actorAccountId, shuffle.waiterAccountId]
        : shuffle.kind === "reserve-swap"
          ? [shuffle.accountId]
          : [shuffle.leftAccountId, shuffle.rightAccountId];
    for (const id of affected) {
      const token = previousByAccount.get(id);
      if (token) this.scheduler.cancel(token);
    }
    if (shuffle.kind === "waiter-handoff") {
      this.enqueue(shuffle.actorAccountId, [{ type: "opponent-wait" }]);
      this.wakeAccount(shuffle.actorAccountId);
      if (!shuffle.waiterAuthed) return true;
      this.enqueue(shuffle.waiterAccountId, shuffle.events);
      this.wakeAccount(shuffle.waiterAccountId);
      this.grantAfterPair(battle, shuffle.waiterAccountId);
      return true;
    }
    if (shuffle.kind === "reserve-swap") {
      this.enqueue(shuffle.accountId, [{ type: "opponent-new", bot: shuffle.bot }]);
      this.wakeAccount(shuffle.accountId);
      this.grantPairedBot(battle, shuffle.accountId);
      return true;
    }
    this.enqueue(shuffle.leftAccountId, [{ type: "opponent-new", bot: shuffle.leftBot }]);
    this.enqueue(shuffle.rightAccountId, [{ type: "opponent-new", bot: shuffle.rightBot }]);
    this.wakeAccount(shuffle.leftAccountId);
    this.wakeAccount(shuffle.rightAccountId);
    this.grantPairedBot(battle, shuffle.leftAccountId);
    this.grantPairedBot(battle, shuffle.rightAccountId);
    return true;
  }

  private grantPairedBot(battle: Battle, accountId: number): void {
    if (battle.humanOpensDuel(accountId)) {
      this.grantAfterPair(battle, accountId);
      return;
    }
    this.scheduleBotAndGrant(battle, accountId);
  }

  private runGrant(fightId: string, accountId: number): void {
    const battle = this.battleByFight.get(fightId);
    if (!battle || battle.finished) return;
    if (!battle.accountIds().includes(accountId)) return;
    const granted = battle.grantTurn(accountId, this.scheduler.now().getTime());
    if (!granted) return;
    this.enqueue(accountId, [granted]);
    this.wakeAccount(accountId);
    this.armTurnTimeout(battle, accountId);
  }

  private async runTurnTimeout(fightId: string, accountId: number): Promise<void> {
    const battle = this.battleByFight.get(fightId);
    if (!battle || battle.finished) return;
    if (!battle.accountIds().includes(accountId)) return;
    const human = battle.livingHumans().find((entry) => entry.accountId === accountId);
    if (!human) return;
    const events = timeoutHumanTurn(human, this.scheduler.now().getTime());
    if (!events) return;
    this.enqueue(accountId, events);
    fanoutRosterEffects(battle, accountId, events, this.enqueue, this.wakeAccount);
    this.wakeAccount(accountId);
    if (battle.finished) {
      await this.settleFinished(battle, events, accountId);
      return;
    }
    const opponent = battle.pairedOpponent(accountId);
    if (opponent.kind === "bot") {
      await this.runBotCounter(fightId, accountId);
      if (battle.finished || !battle.accountIds().includes(accountId)) return;
      const token = battle.delayTokenFor(accountId);
      if (!token) return;
      this.scheduler.schedule(token, battle.turnGrantDelayMs, () =>
        this.runGrant(fightId, accountId),
      );
      return;
    }
    const token = battle.delayTokenFor(accountId);
    if (!token) return;
    this.scheduler.schedule(token, battle.turnGrantDelayMs, () =>
      this.runGrant(fightId, opponent.accountId),
    );
  }

  private deliverGloveSides(battle: Battle, ending: EndingGloveResult): void {
    for (const notify of ending.sideNotifies) {
      const wait = notify.events.some((event) => event.type === "opponent-wait");
      const next = notify.events.some(
        (event) => event.type === "opponent-new" || event.type === "opponent-new-human",
      );
      if (wait || next) cancelDuel(this.scheduler, battle, notify.accountId);
      this.enqueue(notify.accountId, notify.events, "head");
      this.wakeAccount(notify.accountId);
      if (next) this.grantPairedBot(battle, notify.accountId);
    }
  }
}
