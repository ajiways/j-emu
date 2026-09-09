import type { ContentBundle } from "../domain/content-document.ts";

export function collectStoreIssues(bundle: ContentBundle): readonly string[] {
  const issues: string[] = [];
  const areaIds = new Set(bundle.areas.map((area) => area.id));
  const artifactIds = new Set(bundle.artifacts.map((artifact) => artifact.id));
  collectDuplicateIds(
    issues,
    "store_type",
    bundle.storeTypes.map((row) => `${row.areaId}:${row.typeId}`),
  );
  collectDuplicateIds(
    issues,
    "store_lot",
    bundle.storeLots.map((row) => `${row.areaId}:${row.lotId}`),
  );
  const typeKeys = new Set(bundle.storeTypes.map((row) => `${row.areaId}:${row.typeId}`));
  for (const row of bundle.storeTypes) {
    if (!areaIds.has(row.areaId)) {
      issues.push(`store_type ${row.areaId}:${row.typeId} references missing area ${row.areaId}`);
    }
    if (!row.title) issues.push(`store_type ${row.areaId}:${row.typeId} title is required`);
    if (!bundle.storeLots.some((lot) => lot.areaId === row.areaId && lot.typeId === row.typeId)) {
      issues.push(`store_type ${row.areaId}:${row.typeId} has no lots`);
    }
  }
  for (const lot of bundle.storeLots) {
    if (!areaIds.has(lot.areaId)) {
      issues.push(`store_lot ${lot.areaId}:${lot.lotId} references missing area ${lot.areaId}`);
    }
    if (!artifactIds.has(lot.artikulId)) {
      issues.push(
        `store_lot ${lot.areaId}:${lot.lotId} artifact ${lot.artikulId} is not in the bundle`,
      );
    }
    if (!typeKeys.has(`${lot.areaId}:${lot.typeId}`)) {
      issues.push(`store_lot ${lot.areaId}:${lot.lotId} type ${lot.typeId} is missing`);
    }
  }
  const shop = bundle.areas.find((area) => area.id === "504");
  if (!shop) issues.push("area 504 is required for playable-slice/v14");
  else if (shop.code !== "store") issues.push("area 504 code must be store");
  const shopTypes = new Set(
    bundle.storeTypes.filter((row) => row.areaId === "504").map((row) => row.typeId),
  );
  if (!shopTypes.has(-131)) issues.push("store 504 is missing type -131");
  const shopLots = bundle.storeLots.filter((lot) => lot.areaId === "504");
  if (!shopLots.some((lot) => lot.lotId === 80 && lot.artikulId === 23 && lot.typeId === -131)) {
    issues.push("store 504 is missing lot 80 artikul 23");
  }
  if (!shopLots.some((lot) => lot.lotId === 82 && lot.artikulId === 24 && lot.typeId === -131)) {
    issues.push("store 504 is missing lot 82 artikul 24");
  }
  return issues;
}

function collectDuplicateIds(issues: string[], type: string, keys: readonly string[]): void {
  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) issues.push(`duplicate ${type} id ${key}`);
    seen.add(key);
  }
}
