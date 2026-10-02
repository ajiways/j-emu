import { bestiaryCreditHeroIds } from "../modules/character/domain/bestiary-kill-credit.ts";
import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { FightHumanOutcome } from "../modules/combat/domain/fight-outcome-snapshot.ts";
import type { RandomSource } from "../modules/combat/domain/random-source.ts";
import type { FightLootRoute } from "../modules/combat/ports/fight-loot-routing.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { QuestLootNeeded } from "../modules/quests/ports/quest-loot-needed.ts";
import { capRolledDrops } from "./hunt-fight-loot-apply.ts";
import {
  cutForParty,
  goldMinorOf,
  rollMobReward,
  type Drop,
  type HuntOutcome,
} from "./hunt-reward-plan.ts";

/** What a hunt pays out, summed over the mobs that fell: each mob is rolled and paid by itself. */
export type HuntPayout = Readonly<{
  experience: ReadonlyMap<number, number>;
  goldMinor: ReadonlyMap<number, number>;
  /** The drops of the mobs each top damager owns (before the party bag takes its share). */
  drops: ReadonlyMap<number, readonly Drop[]>;
  /** The drops of the party-bag loot rules, waiting for the party. */
  deferred: readonly Drop[];
  /** The money the party's top damagers brought in, for the party chat line. */
  partyMoneyMinor: number;
  /** Every kill of the bestiary: the hero and the mob. */
  bestiaryKills: readonly Readonly<{ heroId: number; botId: number }>[];
}>;

export type HuntPayoutDeps = Readonly<{
  catalog: Catalog;
  inventory: InventoryService;
  lootNeeded: QuestLootNeeded;
  random: RandomSource;
}>;

function add(map: Map<number, number>, key: number, amount: number): void {
  if (amount > 0) map.set(key, (map.get(key) ?? 0) + amount);
}

/**
 * The payout of a hunt. Only a won fight pays; the party loot rules and the dungeon's excluded
 * drops apply to every mob on its own, and the bag capacity caps what each top damager gets in all.
 */
export async function planHuntPayout(
  deps: HuntPayoutDeps,
  input: Readonly<{
    outcome: HuntOutcome;
    rewarded: readonly FightHumanOutcome[];
    route: FightLootRoute | null;
    excludedDrops: ReadonlySet<number> | null;
  }>,
): Promise<HuntPayout> {
  const { outcome, rewarded, route } = input;
  const experience = new Map<number, number>();
  const goldMinor = new Map<number, number>();
  const rolledByHuman = new Map<number, Drop[]>();
  const deferred: Drop[] = [];
  const bestiaryKills: { heroId: number; botId: number }[] = [];
  let partyMoneyMinor = 0;
  for (const mob of outcome.kind === "win" ? outcome.mobs : []) {
    const bot = await deps.catalog.bot(mob.botId);
    if (!bot) throw new Error(`Bot catalog entry ${mob.botId} is missing`);
    const roll = rollMobReward({ bot, mob, rewarded, random: deps.random });
    for (const [characterId, amount] of roll.experience) add(experience, characterId, amount);
    const { top, moneyMinor } = roll;
    const rolled =
      input.excludedDrops === null
        ? roll.rolled
        : roll.rolled.filter((drop) => !input.excludedDrops?.has(drop.artikulId));
    const cut = cutForParty({
      route,
      humans: outcome.humans,
      top,
      moneyMinor,
      rolledCount: rolled.length,
    });
    for (const human of rewarded) {
      const isTop = top?.characterId === human.characterId;
      add(
        goldMinor,
        human.characterId,
        goldMinorOf({ characterId: human.characterId, isTop, moneyMinor, cut }),
      );
    }
    partyMoneyMinor += cut.partyMoneyMinor;
    for (const heroId of bestiaryCreditHeroIds({
      kind: outcome.kind,
      topCharacterId: top === undefined ? null : top.characterId,
      humanIds: rewarded.map((human) => human.characterId),
      partyMemberIds: route?.memberCharacterIds ?? null,
    })) {
      bestiaryKills.push({ heroId, botId: mob.botId });
    }
    if (top && rolled.length > 0) {
      if (cut.deferItems) deferred.push(...rolled);
      else
        rolledByHuman.set(top.characterId, [
          ...(rolledByHuman.get(top.characterId) ?? []),
          ...rolled,
        ]);
    }
  }
  const drops = new Map<number, readonly Drop[]>();
  for (const [characterId, rolled] of rolledByHuman) {
    drops.set(
      characterId,
      await capRolledDrops({
        inventory: deps.inventory,
        lootNeeded: deps.lootNeeded,
        characterId,
        rolled,
      }),
    );
  }
  return { experience, goldMinor, drops, deferred, partyMoneyMinor, bestiaryKills };
}
