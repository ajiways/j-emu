import type { Battle } from "../domain/battle.ts";
import type { CombatEvent, FightExit } from "../ports/combat-port.ts";
import type { HuntMeleeScheduler } from "./hunt-melee-scheduler.ts";

export class CombatMeleeLoop {
  constructor(
    private readonly byAccount: Map<number, Battle>,
    private readonly battleByFight: Map<string, Battle>,
    private readonly scheduler: HuntMeleeScheduler,
    private readonly enqueue: (accountId: number, events: readonly CombatEvent[]) => void,
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
    this.scheduler.cancel(battle.id);
    const resolved = battle.tryPlayerMelee(accountId, side, this.scheduler.now().getTime());
    if (resolved.kind === "ignored") {
      this.enqueue(accountId, [{ type: "command-accepted", sequence }]);
      return;
    }
    enqueuePlayerMelee(this.enqueue, accountId, sequence, resolved.events);
    if (battle.finished) {
      await this.settleFinished(battle, resolved.events, accountId);
      return;
    }
    await this.followUpAfterStrike(battle, accountId, resolved.events);
  }

  keepTurn(accountId: number, sequence: string | number, events: readonly CombatEvent[]): void {
    this.enqueue(accountId, [{ type: "command-accepted", sequence }, ...events]);
  }

  async endingGlove(
    accountId: number,
    sequence: string | number,
    events: readonly CombatEvent[],
  ): Promise<void> {
    const battle = this.byAccount.get(accountId);
    if (!battle) {
      this.enqueue(accountId, [{ type: "command-accepted", sequence }]);
      return;
    }
    this.scheduler.cancel(battle.id);
    this.enqueue(accountId, [{ type: "command-accepted", sequence }, ...events]);
    if (battle.finished) {
      await this.settleFinished(battle, events, accountId);
      return;
    }
    await this.followUpAfterStrike(battle, accountId, events);
  }

  grantAfterPair(battle: Battle, accountId: number): void {
    this.scheduler.schedule(battle.id, battle.turnGrantDelayMs, () =>
      this.runGrant(battle.id, accountId),
    );
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
    const opponent = battle.pairedOpponent(accountId);
    if (opponent.kind === "bot") {
      this.scheduleBotAndGrant(battle);
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
    this.scheduler.schedule(battle.id, battle.turnGrantDelayMs, () =>
      this.runGrant(battle.id, opponent.accountId),
    );
  }

  private scheduleBotAndGrant(battle: Battle): void {
    const fightId = battle.id;
    const striker = battle.pairedAccountId;
    this.scheduler.schedule(fightId, battle.meleeBotCounterMs, () => this.runBotCounter(fightId));
    this.scheduler.schedule(fightId, battle.turnGrantDelayMs, () =>
      this.runGrant(fightId, striker),
    );
  }

  private async runBotCounter(fightId: string): Promise<void> {
    const battle = this.battleByFight.get(fightId);
    if (!battle || battle.finished) return;
    const target = battle.pairedAccountId;
    const result = battle.resolveBotMelee();
    this.enqueue(target, result.events);
    this.wakeAccount(target);
    if (!result.killedPlayer) {
      const extra = battle.tickRosterDuels();
      if (extra.length > 0) this.enqueue(target, extra);
      if (battle.finished) {
        await this.settleFinished(battle, extra, target);
        return;
      }
      await this.applyShuffle(battle);
      return;
    }
    if (battle.finished) {
      await this.settleFinished(battle, result.events, target);
      return;
    }
    await this.handOffToWaiter(battle, target);
  }

  private async handOffToWaiter(battle: Battle, deadAccountId: number): Promise<void> {
    this.scheduler.cancel(battle.id);
    this.enqueue(deadAccountId, [{ type: "finished", winnerTeam: 2, fightId: battle.id }]);
    await this.departHuman(battle, deadAccountId);
    this.queueExit(deadAccountId, battle.id, { fightId: battle.id, winnerTeam: 2 });
    this.byAccount.delete(deadAccountId);
    this.wakeAccount(deadAccountId);
    const waiter = battle.pairNextWaiter();
    if (!waiter) throw new Error("Killed hunter had no waiter to re-pair");
    if (!waiter.authed) return;
    this.enqueue(waiter.accountId, waiter.events);
    this.wakeAccount(waiter.accountId);
    this.scheduler.schedule(battle.id, battle.turnGrantDelayMs, () =>
      this.runGrant(battle.id, waiter.accountId),
    );
  }

  private applyShuffle(battle: Battle): void {
    const shuffle = battle.tryShuffleAfterHits();
    if (shuffle.kind !== "waiter-handoff") return;
    this.scheduler.cancel(battle.id);
    this.enqueue(shuffle.actorAccountId, [{ type: "opponent-wait" }]);
    this.wakeAccount(shuffle.actorAccountId);
    if (!shuffle.waiterAuthed) return;
    this.enqueue(shuffle.waiterAccountId, shuffle.events);
    this.wakeAccount(shuffle.waiterAccountId);
    this.scheduler.schedule(battle.id, battle.turnGrantDelayMs, () =>
      this.runGrant(battle.id, shuffle.waiterAccountId),
    );
  }

  private runGrant(fightId: string, accountId: number): void {
    const battle = this.battleByFight.get(fightId);
    if (!battle || battle.finished) return;
    if (!battle.accountIds().includes(accountId)) return;
    const granted = battle.grantTurn(accountId, this.scheduler.now().getTime());
    if (!granted) return;
    this.enqueue(accountId, [granted]);
    this.wakeAccount(accountId);
  }
}

function enqueuePlayerMelee(
  enqueue: (accountId: number, events: readonly CombatEvent[]) => void,
  accountId: number,
  sequence: string | number,
  events: readonly CombatEvent[],
): void {
  const wait = events.find((event) => event.type === "turn-wait");
  const damage = events.find((event) => event.type === "damage");
  const finished = events.find((event) => event.type === "finished");
  const extras = events.filter(
    (event) =>
      event.type === "effect-purge" ||
      event.type === "opponent-new" ||
      event.type === "opponent-new-human",
  );
  if (!wait || wait.type !== "turn-wait" || !damage || damage.type !== "damage") {
    throw new Error("Player melee must emit turn-wait then damage");
  }
  enqueue(accountId, [
    wait,
    damage,
    ...extras,
    { type: "command-accepted", sequence },
    ...(finished ? [finished] : []),
  ]);
}
