import type { Battle } from "../domain/battle.ts";
import type { FightLootBlock } from "../domain/fight-loot-block.ts";
import { FinishedFightConflictError } from "../domain/finished-fight-conflict-error.ts";
import { buildFightResultInfo } from "../domain/fight-result-info.ts";
import type { FightResultInfo } from "../domain/fight-result-info.ts";
import { huntFightTitle } from "../domain/hunt-fight-title.ts";
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
    private readonly pendingFightInfo: Map<number, FightResultInfo>,
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
    const outcome = finished.winnerTeam === battle.openerTeam() ? "win" : "loss";
    await this.closeFight(battle, outcome, finished.winnerTeam, {
      strikerAccountId,
      finished,
    });
  }

  async leaveFight(accountId: number): Promise<void> {
    const battle = this.byAccount.get(accountId);
    if (!battle || battle.finished) return;
    const wasPaired = battle.delayTokenFor(accountId) !== null;
    const others = battle.livingHumans().filter((human) => human.accountId !== accountId);
    if (others.length > 0) {
      if (wasPaired) {
        const token = battle.delayTokenFor(accountId);
        if (token) this.scheduler.cancel(token);
      }
      await this.departHuman(battle, accountId);
      this.queueExit(accountId, battle.id, { fightId: battle.id, winnerTeam: 2, flee: true });
      this.byAccount.delete(accountId);
      this.wakeAccount(accountId);
      if (!wasPaired) return;
      const waiter = battle.pairNextWaiter(accountId);
      if (!waiter) {
        battle.dissolveDuelOf(accountId);
        return;
      }
      if (!waiter.authed) return;
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

  lastFightInfo(accountId: number): FightResultInfo | null {
    return this.pendingFightInfo.get(accountId) ?? null;
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
    for (const token of battle.delayTokens()) this.scheduler.cancel(token);
    if (this.settledFights.has(battle.id)) return;
    const settlement = this.settlement();
    const outcome = battle.outcome(kind, winnerTeam);
    const lootByAccount = settlement
      ? await settlement.persistFinished(outcome)
      : new Map<number, FightLootBlock>();
    this.settledFights.add(battle.id);
    await this.recordHistory(battle, winnerTeam);
    const info = this.resultInfo(battle, winnerTeam, lootByAccount);
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
      this.pendingFightInfo.set(accountId, info);
      this.queueExit(accountId, battle.id, exit);
      this.wakeAccount(accountId);
    }
    for (const accountId of battle.accountIds()) this.byAccount.delete(accountId);
    this.battleByFight.delete(battle.id);
    await this.notifyFinished(battle, kind, winnerTeam);
  }

  private resultInfo(
    battle: Battle,
    winnerTeam: 1 | 2,
    lootByAccount: ReadonlyMap<number, FightLootBlock>,
  ): FightResultInfo {
    const { humans, bots } = battle.boardParticipants();
    return buildFightResultInfo({
      fightId: battle.id,
      title: this.resultTitle(battle, humans),
      type: battle.kind === "friendly-duel" ? "6" : "1",
      areaId: battle.areaId,
      timeout: battle.turnTimeoutSeconds,
      startedAt: battle.startedAt,
      now: this.scheduler.now(),
      winnerTeam,
      humans,
      bots,
      lootByAccount,
    });
  }

  private resultTitle(battle: Battle, humans: readonly { nick: string; team: 1 | 2 }[]): string {
    if (battle.kind === "hunt") {
      const history = battle.huntHistory();
      return huntFightTitle(history.heroNick, history.botNick);
    }
    const team1 = humans.find((human) => human.team === 1);
    const team2 = humans.find((human) => human.team === 2);
    if (!team1 || !team2) throw new Error(`Fight ${battle.id} is missing a team`);
    return huntFightTitle(team1.nick, team2.nick);
  }

  private async notifyFinished(
    battle: Battle,
    outcome: FinishKind,
    winnerTeam: 1 | 2,
  ): Promise<void> {
    const observer = this.terminal();
    if (!observer) return;
    await observer.afterFinished({
      accountId: battle.accountId,
      fightId: battle.id,
      winnerTeam,
      outcome,
      purpose: battle.purpose,
      ...(battle.purpose === "quest" ? battle.questChat() : {}),
      ...(battle.skipQuestKills() ? { skipQuestKills: true } : {}),
      ...(battle.purpose === "hunt" || battle.purpose === "quest"
        ? { botId: battle.huntHistory().botArtikulId }
        : {}),
    });
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
