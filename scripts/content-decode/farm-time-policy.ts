import type { FarmResourceDocument } from "../../src/modules/content/domain/content-farm.ts";

/** Pub1 farm_list.amf omits farm_time; live farm_info for mint/crystal is 60. */
export const DUMP_FARM_TIME_SEC = 60;
/** Pub1 farm_list.amf omits stamina_drain; dump-proven drain is 4 unless overlayed. */
export const DUMP_STAMINA_DRAIN = 4;

export function applyFarmTiming(
  farms: readonly FarmResourceDocument[],
  farmTimeOverrides: Readonly<Record<string, number>>,
  staminaDrainOverrides: Readonly<Record<string, number>>,
): FarmResourceDocument[] {
  const ids = new Set(farms.map((row) => row.id));
  for (const id of Object.keys(farmTimeOverrides)) {
    if (!ids.has(Number(id))) throw new Error(`farm_time override ${id} is not in farm_list.amf`);
  }
  for (const id of Object.keys(staminaDrainOverrides)) {
    if (!ids.has(Number(id))) {
      throw new Error(`stamina_drain override ${id} is not in farm_list.amf`);
    }
  }
  return farms.map((row) => {
    const farmTime = farmTimeOverrides[String(row.id)];
    const staminaDrain = staminaDrainOverrides[String(row.id)];
    return {
      ...row,
      farmTime: farmTime === undefined ? DUMP_FARM_TIME_SEC : farmTime,
      staminaDrain: staminaDrain === undefined ? DUMP_STAMINA_DRAIN : staminaDrain,
    };
  });
}
