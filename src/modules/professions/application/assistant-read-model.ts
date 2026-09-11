import type { AssistantTypeDefinition } from "../../catalog/domain/assistant-type-definition.ts";
import type { FarmCatalog } from "../../catalog/ports/farm-catalog.ts";
import type { WorldService } from "../../world/domain/world-service.ts";
import type { HeroAssistant } from "../domain/hero-assistant.ts";
import { assistantToWire, farmInfoNode } from "../domain/assistant-wire.ts";
import { applyStockRespawn } from "../domain/farm-jobs.ts";
import type { FarmStockRepository } from "../ports/farm-stock-repository.ts";
import type { HeroAssistantRepository } from "../ports/hero-assistant-repository.ts";

export async function serializeAssistantInfo(
  assistants: HeroAssistantRepository,
  catalog: FarmCatalog,
  world: WorldService,
  heroId: number,
  nowSec: number,
  licenses: ReadonlyArray<{ professionId: number; value: number }>,
): Promise<object> {
  const rows = await assistants.listByHero(heroId);
  const list: Record<string, object> = {};
  for (const row of rows) {
    const type = await requireType(catalog, row.artikulId);
    list[String(row.id)] = assistantToWire(row, type, nowSec, await areaWire(world, row.areaId));
  }
  return {
    status: 100,
    assistant_list: list,
    new_assistants: await buildNewAssistants(catalog, rows, licenses),
  };
}

export async function serializeFarmInfo(
  stocks: FarmStockRepository,
  catalog: FarmCatalog,
  areaId: string,
  nowSec: number,
): Promise<object> {
  const spots = await catalog.areaFarms(areaId);
  const farmList: Record<string, object> = {};
  const seen = new Set<number>();
  for (const spot of spots) {
    if (seen.has(spot.farmId)) continue;
    seen.add(spot.farmId);
    const farm = await catalog.farmResource(spot.farmId);
    if (!farm) throw new Error(`Farm resource ${spot.farmId} is missing`);
    const rows = await stocks.listByAreaFarm(areaId, spot.farmId);
    const matching = spots.filter((item) => item.farmId === spot.farmId);
    const agg = matching.reduce((best, item) => (item.cntMax > best.cntMax ? item : best));
    const stock = rows.find((item) => item.huntSpotId === agg.huntSpotId);
    if (!stock) throw new Error(`Farm stock ${areaId}:${agg.huntSpotId} is missing`);
    const revived = applyStockRespawn(stock, nowSec, agg.cntMax);
    if (revived !== stock) await stocks.save(revived);
    farmList[String(farm.id)] = farmInfoNode(farm, revived.cntCurrent, agg.cntMax);
  }
  return { status: 100, area_id: Number(areaId) || areaId, farm_list: farmList };
}

async function buildNewAssistants(
  catalog: FarmCatalog,
  rows: readonly HeroAssistant[],
  licenses: ReadonlyArray<{ professionId: number; value: number }>,
): Promise<Record<string, { artikul_id: number }>> {
  const types = new Map<number, AssistantTypeDefinition>();
  for (const row of rows) types.set(row.artikulId, await requireType(catalog, row.artikulId));
  const gather = rows.filter((row) => {
    const type = types.get(row.artikulId);
    if (!type) throw new Error(`Assistant ${row.id} type is missing`);
    return type.profession >= 1 && type.profession <= 3;
  });
  if (gather.length >= 3) return {};
  const all = await catalog.assistantTypes();
  if (gather.length === 0) {
    const out: Record<string, { artikul_id: number }> = {};
    for (const license of licenses) {
      if (license.value <= 0) continue;
      const offer = all.find(
        (type) =>
          type.profession === license.professionId && type.quality === 0 && type.level === 1,
      );
      if (offer) out[String(offer.id)] = { artikul_id: offer.id };
    }
    return out;
  }
  const first = gather[0];
  if (!first) return {};
  const firstType = types.get(first.artikulId);
  if (!firstType) throw new Error(`Assistant ${first.id} type is missing`);
  if (firstType.profession < 1 || firstType.profession > 3) return {};
  let maxQ = 0;
  for (const row of gather) {
    const type = types.get(row.artikulId);
    if (!type) throw new Error(`Assistant ${row.id} type is missing`);
    maxQ = Math.max(maxQ, type.quality);
  }
  const offer = all.find(
    (type) =>
      type.profession === firstType.profession && type.quality === maxQ + 1 && type.level === 1,
  );
  if (!offer) return {};
  return { [String(offer.id)]: { artikul_id: offer.id } };
}

async function requireType(catalog: FarmCatalog, id: number): Promise<AssistantTypeDefinition> {
  const type = await catalog.assistantType(id);
  if (!type) throw new Error(`Assistant type ${id} is missing`);
  return type;
}

async function areaWire(
  world: WorldService,
  areaId: string,
): Promise<{ id: number; title: string; picture: string }> {
  if (!areaId || areaId === "0") return { id: 0, title: "", picture: "" };
  const area = await world.area(areaId);
  return { id: Number(area.id) || 0, title: area.title, picture: "" };
}
