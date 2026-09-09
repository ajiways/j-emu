import type { Battle } from "../domain/battle.ts";
import type { FightLootBlock } from "../domain/fight-loot-block.ts";
import { FinishedFightConflictError } from "../domain/finished-fight-conflict-error.ts";
import type { CombatEvent, FightExit } from "../ports/combat-port.ts";
import type { FightSettlement } from "../ports/fight-settlement.ts";
import type { FightTerminalObserver } from "../ports/fight-terminal-observer.ts";
import type { CombatMeleeLoop } from "./combat-melee-loop.ts";
import type { FinishedFightRecorder } from "./finished-fight-recorder.ts";
import type { HistoryWriteObserver } from "./history-write-observer.ts";
import type { HuntMeleeScheduler } from "./hunt-melee-scheduler.ts";

type FinishKind = "win" | "loss" | "last-leave";

export class CombatTerminal {
  constructor(
    private readonly byAccount: Map<number, Battle>,
    private readonly battleByFight: Map<string, Battle>,
    private readonly pendingExits: Map<number, FightExit>,
    private readonly pendingLoot: Map<number, FightLootBlock>,
    private readonly settledFights: Set<string>,
    private readonly exitSent: Set<string>,
    private readonly scheduler: HuntMeleeScheduler,
    private readonly melee: CombatMeleeLoop,
    private readonly history: FinishedFightRecorder,
    private readonly historyWrites: HistoryWriteObserver,
    private readonly enqueue: (accountId: number, events: readonly CombatEvent[]) => void,
    private readonly wakeAccount: (accountId: number) => void,
    private readonly settlement: () => FightSettlement | undefined,
    private readonly terminal: () => FightTerminalObserver | undefined,
  ) {}

  async settleFinished(
    battle: Battle,
    events: readonly CombatEvent[],
    strikerAccountId: number,
  ): Promise<void> {
    const finished = events.find((event) => event.type === "finished");
    if (!finished || finished.type !== "finished") {
      throw new Error("Finished battle did not produce a finished event");
    }
    await this.closeFight(battle, finished.winnerTeam === 1 ? "win" : "loss", finished.winnerTeam, {
      strikerAccountId,
      finished,
    });
  }

  async leaveFight(accountId: number): Promise<void> {
    const battle = this.byAccount.get(accountId);
    if (!battle || battle.finished) return;
    const wasPaired = battle.pairedAccountId === accountId;
    const others = battle.livingHumans().filter((human) => human.accountId !== accountId);
    if (others.length > 0) {
      if (wasPaired) this.scheduler.cancel(battle.id);
      await this.departHuman(battle, accountId);
      this.queueExit(accountId, battle.id, { fightId: battle.id, winnerTeam: 2, flee: true });
      this.byAccount.delete(accountId);
      this.wakeAccount(accountId);
      if (!wasPaired) return;
      const waiter = battle.pairNextWaiter();
      if (!waiter || !waiter.authed) return;
      this.enqueue(waiter.accountId, waiter.events);
      this.wakeAccount(waiter.accountId);
      this.melee.grantAfterPair(battle, waiter.accountId);
      return;
    }
    const winnerTeam = battle.finishLeave();
    await this.closeFight(battle, "last-leave", winnerTeam, { strikerAccountId: accountId });
  }

  async departHuman(battle: Battle, accountId: number): Promise<void> {
    const human = battle.markHumanLeft(accountId);
    const settlement = this.settlement();
    if (!settlement) return;
    await settlement.persistHumanLeft({
      fightId: battle.id,
      accountId: human.accountId,
      characterId: human.heroId,
      hp: human.hp,
      pocket: human.pocketCells(),
    });
  }

  queueExit(accountId: number, fightId: string, exit: FightExit): void {
    const key = `${fightId}:${accountId}`;
    if (this.exitSent.has(key)) return;
    this.exitSent.add(key);
    this.pendingExits.set(accountId, exit);
  }

  private async closeFight(
    battle: Battle,
    kind: FinishKind,
    winnerTeam: 1 | 2,
    input: Readonly<{ strikerAccountId: number; finished?: CombatEvent }>,
  ): Promise<void> {
    this.scheduler.cancel(battle.id);
    if (this.settledFights.has(battle.id)) return;
    const settlement = this.settlement();
    const outcome = battle.outcome(kind, winnerTeam);
    const lootByAccount = settlement
      ? await settlement.persistFinished(outcome)
      : new Map<number, FightLootBlock>();
    this.settledFights.add(battle.id);
    await this.recordHistory(battle, winnerTeam);
    const flee = kind === "last-leave";
    const exit: FightExit = flee
      ? { fightId: battle.id, winnerTeam, flee: true }
      : { fightId: battle.id, winnerTeam };
    for (const accountId of battle.accountIds()) {
      if (input.finished && accountId !== input.strikerAccountId) {
        this.enqueue(accountId, [input.finished]);
      }
      const loot = lootByAccount.get(accountId);
      if (loot && kind !== "last-leave") this.pendingLoot.set(accountId, loot);
      this.queueExit(accountId, battle.id, exit);
      this.wakeAccount(accountId);
    }
    await this.notifyFinished(battle.accountId, battle.id);
    for (const accountId of battle.accountIds()) this.byAccount.delete(accountId);
    this.battleByFight.delete(battle.id);
  }

  private async notifyFinished(accountId: number, fightId: string): Promise<void> {
    const observer = this.terminal();
    if (!observer) return;
    await observer.afterFinished({ accountId, fightId });
  }

  private async recordHistory(battle: Battle, winnerTeam: 1 | 2): Promise<void> {
    try {
      await this.history.record(battle, winnerTeam);
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      if (error instanceof FinishedFightConflictError) {
        this.historyWrites.conflict(battle.id, failure);
      } else {
        this.historyWrites.failed(battle.id, failure);
      }
    }
  }
}
