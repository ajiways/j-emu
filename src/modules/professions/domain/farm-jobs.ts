import type { AreaFarmDefinition } from "../../catalog/domain/area-farm-definition.ts";
import type { FarmResourceDefinition } from "../../catalog/domain/farm-resource-definition.ts";
import type { FarmCatalog } from "../../catalog/ports/farm-catalog.ts";
import type { FarmStock } from "./hero-assistant.ts";
import type { HeroAssistant } from "./hero-assistant.ts";
import type { FarmStockRepository } from "../ports/farm-stock-repository.ts";
import {
  appropriateTactics,
  drainStaminaForWork,
  farmAttackAt,
  farmCycle,
  farmDurationSec,
  masteryAllowsFarm,
  rollGremlinMastery,
  STARTER_MASTERY,
  type FarmOutcome,
  type FarmRng,
} from "./farm-formulas.ts";
import { ProfessionDeniedError } from "./profession-denied-error.ts";

export function isBusy(row: HeroAssistant, nowSec: number): boolean {
  return row.ftime > nowSec;
}

export function isWaiting(row: HeroAssistant, nowSec: number): boolean {
  return row.farmId > 0 && row.ftime > 0 && row.ftime <= nowSec;
}

export function applyStockRespawn(spot: FarmStock, nowSec: number, cntMax: number): FarmStock {
  if (spot.cntCurrent > 0) return spot;
  if (spot.nextRespawnTime <= 0 || nowSec < spot.nextRespawnTime) return spot;
  return { ...spot, cntCurrent: cntMax, nextRespawnTime: 0, lastRespawnTime: nowSec };
}

export async function decrementFarmStock(
  stocks: FarmStockRepository,
  catalog: FarmCatalog,
  areaId: string,
  farmId: number,
  nowSec: number,
): Promise<boolean> {
  const catalogSpots = await catalog.areaFarms(areaId);
  const matching = catalogSpots.filter((spot) => spot.farmId === farmId);
  if (matching.length === 0) return false;
  const rows = await stocks.listByAreaFarm(areaId, farmId);
  const revived = await reviveStocks(stocks, rows, matching, nowSec);
  const agg = pickLargestMax(revived, matching);
  if (!agg || agg.cntCurrent <= 0) return false;
  const catalogSpot = matching.find((spot) => spot.huntSpotId === agg.huntSpotId);
  if (!catalogSpot) throw new Error(`Area farm ${areaId}:${agg.huntSpotId} catalog row is missing`);
  const nextCnt = agg.cntCurrent - 1;
  await stocks.save(
    nextCnt <= 0
      ? { ...agg, cntCurrent: 0, nextRespawnTime: nowSec + catalogSpot.cntCooldown }
      : { ...agg, cntCurrent: nextCnt },
  );
  return true;
}

async function reviveStocks(
  stocks: FarmStockRepository,
  rows: readonly FarmStock[],
  matching: readonly AreaFarmDefinition[],
  nowSec: number,
): Promise<FarmStock[]> {
  const next: FarmStock[] = [];
  for (const row of rows) {
    const catalogSpot = matching.find((spot) => spot.huntSpotId === row.huntSpotId);
    if (!catalogSpot) {
      throw new Error(`Farm stock ${row.areaId}:${row.huntSpotId} catalog is missing`);
    }
    const revived = applyStockRespawn(row, nowSec, catalogSpot.cntMax);
    if (revived !== row) await stocks.save(revived);
    next.push(revived);
  }
  return next;
}

function pickLargestMax(
  rows: readonly FarmStock[],
  matching: readonly AreaFarmDefinition[],
): FarmStock | null {
  const ranked = [...rows].sort((left, right) => {
    const leftMax = requireCntMax(matching, left.huntSpotId);
    const rightMax = requireCntMax(matching, right.huntSpotId);
    return rightMax - leftMax || right.huntSpotId - left.huntSpotId;
  });
  return ranked[0] ?? null;
}

function requireCntMax(matching: readonly AreaFarmDefinition[], huntSpotId: number): number {
  const spot = matching.find((row) => row.huntSpotId === huntSpotId);
  if (!spot) throw new Error(`Area farm hunt spot ${huntSpotId} catalog is missing`);
  return spot.cntMax;
}

export function assignmentForWork(
  row: HeroAssistant,
  farm: FarmResourceDefinition,
  areaId: string,
  nowSec: number,
  rng: FarmRng,
): HeroAssistant {
  const stam = drainStaminaForWork(row.stamina, row.staminaResetTime, nowSec, farm.staminaDrain);
  if (!stam.ok) throw new ProfessionDeniedError("Недостаточно энергии");
  const dur = farmDurationSec(farm.farmTime, row.skillSpeed);
  const ftime = nowSec + dur;
  return {
    ...row,
    farmId: farm.id,
    areaId,
    stime: nowSec,
    ftime,
    attackAt: farmAttackAt(nowSec, ftime, row.skillDefence, rng),
    stamina: stam.stamina,
    staminaResetTime: stam.resetTime,
    cycleResult: "",
    lootGranted: true,
  };
}

export function assertCanWork(
  typeProfession: number,
  farm: FarmResourceDefinition,
  licensed: boolean,
  hasSpot: boolean,
  masteryValue: number,
): void {
  if (typeProfession !== farm.profession) {
    throw new ProfessionDeniedError("Гремлин не может собирать этот ресурс");
  }
  if (!licensed) throw new ProfessionDeniedError("Нет лицензии");
  if (!hasSpot) throw new ProfessionDeniedError("Здесь нет такой ноды");
  if (!masteryAllowsFarm(masteryValue, farm.masteryValue)) {
    throw new ProfessionDeniedError("Недостаточное мастерство");
  }
}

export function finishCycle(
  row: HeroAssistant,
  farm: FarmResourceDefinition,
  climate: number,
  nowSec: number,
  rng: FarmRng,
): { row: HeroAssistant; outcome: FarmOutcome; masteryGained: boolean } {
  if (!row.cycleResult && isBusy(row, nowSec) && row.attackAt > 0 && row.attackAt <= nowSec) {
    return {
      outcome: "attacked",
      masteryGained: false,
      row: {
        ...row,
        cycleResult: "attacked",
        resultType: 0,
        resultValue: "",
        lootGranted: true,
        farmId: 0,
        areaId: "0",
        ftime: 0,
        stime: 0,
        attackAt: 0,
      },
    };
  }
  const match = row.tactics === appropriateTactics(climate);
  const outcome = farmCycle({ tacticMatch: match }, rng);
  let mastery = Math.max(STARTER_MASTERY, row.masteryValue);
  let masteryGained = false;
  if (
    outcome === "success" &&
    rollGremlinMastery(
      { current: mastery, cap: farm.masteryMax, intellect: row.skillIntellect },
      rng,
    )
  ) {
    const next = Math.min(farm.masteryMax, mastery + 1);
    masteryGained = next > mastery;
    mastery = next;
  }
  if (outcome === "success") {
    return {
      outcome,
      masteryGained,
      row: {
        ...row,
        cycleResult: "success",
        resultType: 1,
        resultValue: String(farm.artifactArtikulId),
        lootGranted: false,
        masteryValue: mastery,
        ftime: 0,
        attackAt: 0,
      },
    };
  }
  return {
    outcome: "failure",
    masteryGained,
    row: {
      ...row,
      cycleResult: "failure",
      resultType: 0,
      resultValue: "",
      lootGranted: true,
      masteryValue: mastery,
      ftime: 0,
      attackAt: 0,
    },
  };
}

export function clearedAssignment(row: HeroAssistant): HeroAssistant {
  return {
    ...row,
    farmId: 0,
    areaId: "0",
    ftime: 0,
    stime: 0,
    attackAt: 0,
    cycleResult: "",
    resultType: 0,
    resultValue: "",
    lootGranted: true,
  };
}

export function freeAssistantInsert(
  heroId: number,
  artikulId: number,
  nick: string,
): Omit<HeroAssistant, "id"> {
  return {
    heroId,
    artikulId,
    nick,
    skillSpeed: 0,
    skillDefence: 0,
    skillIntellect: 0,
    tactics: 0,
    farmId: 0,
    areaId: "0",
    ftime: 0,
    stime: 0,
    attackAt: 0,
    stamina: 100,
    staminaResetTime: 0,
    masteryValue: STARTER_MASTERY,
    resultType: 0,
    resultValue: "",
    flags: 0,
    cycleResult: "",
    lootGranted: true,
  };
}
