import { parseDecimalId, requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import { requirePresent } from "../../../shared/kernel/require-present.ts";
import type { Clock } from "../../../shared/kernel/clock.ts";
import type { DelayScheduler } from "../../../shared/kernel/delay-scheduler.ts";
import type { HuntAreaWake } from "../ports/hunt-area-wake.ts";
import type { HuntRandom } from "../ports/hunt-random.ts";
import type { HuntBotSnapshot } from "./hunt-bot-snapshot.ts";
import type { HuntSpawn } from "./hunt-spawn.ts";
import {
  createLiveBot,
  hideForRespawn,
  liveToSnapshot,
  nextDueAt,
  tickLiveBot,
  type LiveHuntBot,
} from "./hunt-wander.ts";

const IDLE_SPAWN_FIGHT_ID = 0;

export class HuntWanderRuntime {
  private readonly live = new Map<string, LiveHuntBot>();
  private wake: HuntAreaWake | null = null;

  constructor(
    private readonly clock: Clock,
    private readonly delay: DelayScheduler,
    private readonly random: HuntRandom,
  ) {}

  bindWake(wake: HuntAreaWake): void {
    if (this.wake) throw new Error("Hunt wander wake is already bound");
    this.wake = requirePresent(wake, "Hunt area wake is required");
  }

  ensure(areaId: string, spawn: HuntSpawn): LiveHuntBot {
    const key = spawnKey(areaId, spawn.id);
    const existing = this.live.get(key);
    if (existing) return existing;
    const bot = createLiveBot(spawn, this.nowMs(), this.random);
    this.live.set(key, bot);
    this.schedule(areaId, spawn.id, bot);
    return bot;
  }

  snapshot(
    areaId: string,
    spawns: readonly HuntSpawn[],
    fightIdOf: (spawnId: number) => string | null,
  ): HuntBotSnapshot[] {
    const now = this.nowMs();
    const bots: HuntBotSnapshot[] = [];
    for (const spawn of spawns) {
      const bot = this.ensure(areaId, spawn);
      const wire = liveToSnapshot(bot, now, snapshotFightId(fightIdOf(spawn.id)));
      if (wire) bots.push(wire);
    }
    return bots;
  }

  freeze(areaId: string, spawn: HuntSpawn, locked: boolean): void {
    const bot = this.ensure(areaId, spawn);
    const dirty = tickLiveBot(bot, this.nowMs(), locked, this.random);
    this.schedule(areaId, spawn.id, bot);
    if (dirty) void this.notify(areaId);
  }

  respawn(areaId: string, spawn: HuntSpawn): void {
    this.hide(this.ensure(areaId, spawn), areaId, spawn.id);
  }

  respawnById(areaId: string, spawnId: number): void {
    const bot = this.live.get(spawnKey(areaId, spawnId));
    if (!bot) throw new Error(`Hunt wander missing spawn ${areaId}:${spawnId}`);
    this.hide(bot, areaId, spawnId);
  }

  forget(areaId: string, spawnId: number): void {
    this.live.delete(spawnKey(areaId, spawnId));
    this.delay.cancel(delayToken(areaId, spawnId));
  }

  private hide(bot: LiveHuntBot, areaId: string, spawnId: number): void {
    hideForRespawn(bot, this.nowMs(), this.random);
    this.schedule(areaId, spawnId, bot);
    void this.notify(areaId);
  }

  private schedule(areaId: string, spawnId: number, bot: LiveHuntBot): void {
    const token = delayToken(areaId, spawnId);
    this.delay.cancel(token);
    const dueMs = nextDueAt(bot);
    if (dueMs === null) return;
    this.delay.schedule({
      token,
      dueAt: new Date(dueMs),
      run: () => this.onDue(areaId, spawnId),
    });
  }

  private async onDue(areaId: string, spawnId: number): Promise<void> {
    const bot = this.live.get(spawnKey(areaId, spawnId));
    if (!bot) throw new Error(`Hunt wander due for missing spawn ${areaId}:${spawnId}`);
    const dirty = tickLiveBot(bot, this.nowMs(), bot.locked, this.random);
    this.schedule(areaId, spawnId, bot);
    if (dirty) await this.notify(areaId);
  }

  private async notify(areaId: string): Promise<void> {
    if (!this.wake) return;
    await this.wake.wakeArea(areaId);
  }

  private nowMs(): number {
    return this.clock.now().getTime();
  }
}

function snapshotFightId(fightId: string | null): number {
  if (fightId === null) return IDLE_SPAWN_FIGHT_ID;
  return requireWireIdentity(Number(parseDecimalId(fightId, "hunt fight id")), "hunt fight id");
}

function delayToken(areaId: string, spawnId: number): string {
  return `hunt-wander:${spawnKey(areaId, spawnId)}`;
}

function spawnKey(areaId: string, spawnId: number): string {
  if (!areaId) throw new Error("Area id is required");
  if (!Number.isInteger(spawnId) || spawnId <= 0) {
    throw new Error(`Hunt spawn id ${spawnId} is invalid`);
  }
  return `${areaId}:${spawnId}`;
}
