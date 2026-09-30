import type { Battle } from "../domain/battle.ts";
import { persChangeForHit } from "../domain/melee-pers-change.ts";
import type { Fallout } from "../domain/settle-fallen.ts";
import type { CombatEvent } from "../ports/combat-port.ts";
import { fanoutHit, withActorPersChange } from "./combat-melee-dispatch.ts";
import type { FightScheduler } from "./fight-scheduler.ts";

type AiDriverDeps = Readonly<{
  battleByFight: Map<string, Battle>;
  scheduler: FightScheduler;
  enqueue: (accountId: number, events: readonly CombatEvent[], at?: "head" | "tail") => void;
  wakeAccount: (accountId: number) => void;
  settleFinished: (
    battle: Battle,
    events: readonly CombatEvent[],
    strikerAccountId: number | null,
  ) => Promise<void>;
  settleFallout: (battle: Battle, fallout: Fallout) => Promise<void>;
  handOff: (battle: Battle, accountId: number) => Promise<void>;
  applyShuffle: (battle: Battle, accountId: number) => boolean;
  grantPlayer: (battle: Battle, accountId: number, delayMs: number) => void;
  announcePaired: (battle: Battle, accountIds: readonly number[]) => void;
  /** Re-arms the effect timer for what the turn changed. */
  armEffects: (battle: Battle) => void;
}>;

/**
 * The turns of AI-controlled participants. A mob acts `meleeBotCounterMs` after the action that
 * gave it the turn, whoever acted; then the turn passes on: to a player (who is granted it), or to
 * a mob across from it (whose turn is scheduled the same way). Duels of two mobs have no player to
 * start that chain, so `arm` starts it and pairs the waiting participants of both teams.
 */
export class CombatAiDriver {
  /** Tokens with a turn waiting, and when it is due: a cancelled one must not block a new one. */
  private readonly pending = new Map<string, number>();

  constructor(private readonly deps: AiDriverDeps) {}

  /** Schedules the turn of mob `botId` on his duel's token. */
  schedule(battle: Battle, botId: number): void {
    const token = battle.duelTokenOfParticipant(botId);
    if (!token) return;
    const { scheduler } = this.deps;
    const dueAtMs = scheduler.now().getTime() + battle.meleeBotCounterMs;
    this.pending.set(token, dueAtMs);
    scheduler.schedule(token, battle.meleeBotCounterMs, () =>
      this.run(
        battle.id,
        botId,
        token,
        dueAtMs + battle.turnGrantDelayMs - battle.meleeBotCounterMs,
      ),
    );
  }

  /** Starts what no click starts: pairs the waiting, schedules mob duels that are not moving. */
  arm(battle: Battle): void {
    if (battle.finished) return;
    const { paired, turns } = battle.startIdleWork();
    if (paired.length > 0) this.deps.announcePaired(battle, paired);
    const now = this.deps.scheduler.now().getTime();
    for (const turn of turns) {
      const due = this.pending.get(turn.token);
      if (due === undefined || due < now) this.schedule(battle, turn.botId);
    }
  }

  /**
   * One AI turn. `grantAtMs` is when a player foe is granted his turn after it: the rest of the
   * round, counted from his own last action, not from when this turn happened to run.
   */
  async run(fightId: string, botId: number, token: string, grantAtMs: number): Promise<void> {
    this.pending.delete(token);
    const battle = this.deps.battleByFight.get(fightId);
    await this.turn(fightId, botId, token, grantAtMs);
    if (battle && !battle.finished) this.deps.armEffects(battle);
  }

  private async turn(
    fightId: string,
    botId: number,
    token: string,
    grantAtMs: number,
  ): Promise<void> {
    const { deps } = this;
    const battle = deps.battleByFight.get(fightId);
    if (!battle || battle.finished) return;
    if (battle.duelTokenOfParticipant(botId) !== token) return;
    const result = battle.resolveAiTurn(botId, deps.scheduler.now().getTime());
    const foe = result.foeAccountId;
    if (foe !== null) {
      deps.enqueue(foe, withActorPersChange(battle, result.events));
      fanoutHit(battle, foe, result.events, deps.enqueue, deps.wakeAccount);
      deps.wakeAccount(foe);
    } else {
      this.showHitPoints(battle, result.events);
    }
    if (battle.finished) {
      await deps.settleFinished(battle, result.events, foe);
      return;
    }
    await deps.settleFallout(battle, result.sideFallout);
    if (foe !== null) {
      if (result.killedPlayer) await deps.handOff(battle, foe);
      else if (!deps.applyShuffle(battle, foe))
        deps.grantPlayer(battle, foe, grantAtMs - deps.scheduler.now().getTime());
    }
    this.arm(battle);
  }

  /** Players who watch a duel of mobs see the fresh hit points, not the strikes. */
  private showHitPoints(battle: Battle, events: readonly CombatEvent[]): void {
    const board = battle.boardParticipants();
    const patches = events.flatMap((event) =>
      event.type === "damage"
        ? [persChangeForHit(board.humans, board.bots, event.sourceId, event.targetId)]
        : [],
    );
    patches.push(...events.filter((event) => event.type === "pers-change"));
    if (patches.length === 0) return;
    for (const accountId of battle.authedAccountIds()) {
      this.deps.enqueue(accountId, patches);
      this.deps.wakeAccount(accountId);
    }
  }
}
