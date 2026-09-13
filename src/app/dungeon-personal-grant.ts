import type { DungeonDefinition } from "../modules/catalog/domain/dungeon-definition.ts";
import type { FightOutcomeSnapshot } from "../modules/combat/domain/fight-outcome-snapshot.ts";
import {
  clearCoinTotal,
  clearProgress,
  dungeonLootExcludeIds,
  dungeonSpawn,
  progressFinish,
  spawnIsBoss,
} from "../modules/instance/domain/dungeon-clear-progress.ts";
import type { InstanceService } from "../modules/instance/application/instance-service.ts";
import type { InstanceHuntWorld } from "../modules/instance/ports/instance-hunt.ts";

type DungeonPersonalItem = Readonly<{
  artikulId: number;
  quantity: number;
}>;

export type DungeonPersonalDrop = Readonly<{
  accountId: number;
  characterId: number;
  items: readonly DungeonPersonalItem[];
}>;

export type DungeonClearTick = Readonly<{
  accountIds: readonly number[];
  artikulId: string;
  hasClear: boolean;
  finish: number;
  prev: number;
  next: number;
}>;

export type DungeonGrantContext = Readonly<{
  copyId: number;
  spawnKey: string;
  dungeon: DungeonDefinition;
  exclude: ReadonlySet<number>;
}>;

export class DungeonPersonalGrant {
  private readonly ticks = new Map<string, DungeonClearTick>();

  constructor(
    private readonly hunt: Pick<InstanceHuntWorld, "peekFight">,
    private readonly instances: Pick<InstanceService, "dungeonByArea" | "killedSpawnKeys">,
  ) {}

  async load(fightId: string): Promise<DungeonGrantContext | null> {
    const peeked = this.hunt.peekFight(fightId);
    if (!peeked) return null;
    const dungeon = await this.instances.dungeonByArea(peeked.areaId);
    if (!dungeon) {
      throw new Error(`Dungeon for hunt area ${peeked.areaId} is missing`);
    }
    dungeonSpawn(dungeon, peeked.spawnKey);
    return {
      copyId: peeked.copyId,
      spawnKey: peeked.spawnKey,
      dungeon,
      exclude: dungeonLootExcludeIds(dungeon),
    };
  }

  async prepare(
    context: DungeonGrantContext,
    outcome: FightOutcomeSnapshot,
  ): Promise<readonly DungeonPersonalDrop[]> {
    if (outcome.mode !== "hunt") {
      throw new Error(`Dungeon grant requires a hunt outcome for fight ${outcome.fightId}`);
    }
    const spawn = dungeonSpawn(context.dungeon, context.spawnKey);
    const prevKeys = new Set(await this.instances.killedSpawnKeys(context.copyId));
    const nextKeys = new Set(prevKeys);
    nextKeys.add(context.spawnKey);
    const prev = clearProgress(context.dungeon, prevKeys);
    const next = clearProgress(context.dungeon, nextKeys);
    const finish = context.dungeon.hasClear ? progressFinish(context.dungeon) : 0;
    const team1 = outcome.humans.filter((human) => human.team === 1);
    this.ticks.set(outcome.fightId, {
      accountIds: team1.map((human) => human.accountId),
      artikulId: context.dungeon.artikulId,
      hasClear: context.dungeon.hasClear,
      finish,
      prev,
      next,
    });
    if (outcome.kind !== "win") return [];
    const items: DungeonPersonalItem[] = [];
    if (spawnIsBoss(spawn, context.dungeon, outcome.botId)) {
      if (context.dungeon.clear) {
        const quantity = clearCoinTotal(
          next,
          context.dungeon.clear,
          progressFinish(context.dungeon),
        );
        if (quantity >= 1) {
          items.push({ artikulId: context.dungeon.clear.coinArtikulId, quantity });
        }
      }
      for (const artikulId of context.dungeon.loot.personalGuaranteed) {
        items.push({ artikulId, quantity: 1 });
      }
    }
    if (items.length === 0) return [];
    if (team1.length === 0) {
      throw new Error(`Dungeon fight ${outcome.fightId} is missing team-1 humans`);
    }
    return team1.map((human) => ({
      accountId: human.accountId,
      characterId: human.characterId,
      items,
    }));
  }

  takeTick(fightId: string): DungeonClearTick | null {
    const tick = this.ticks.get(fightId);
    if (tick === undefined) return null;
    this.ticks.delete(fightId);
    return tick;
  }
}
