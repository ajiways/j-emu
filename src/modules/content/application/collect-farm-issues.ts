import type { ContentBundle } from "../domain/content-document.ts";
import type { AssistantTypeDocument } from "../domain/content-farm.ts";
import type { FarmResourceDocument } from "../domain/content-farm.ts";

const STARTER_ID = 3;
const NEXT_ID = 13;
const FARM_ID = 4;
const AREA_ID = "500";
const LOOT_ID = 1720;

export function collectFarmIssues(bundle: ContentBundle): readonly string[] {
  const issues: string[] = [];
  const typeIds = new Set<number>();
  for (const row of bundle.assistantTypes) {
    if (typeIds.has(row.id)) issues.push(`duplicate assistant type ${row.id}`);
    typeIds.add(row.id);
  }
  const farmIds = new Set<number>();
  for (const row of bundle.farmResources) {
    if (farmIds.has(row.id)) issues.push(`duplicate farm resource ${row.id}`);
    farmIds.add(row.id);
  }
  const spots = new Set<string>();
  for (const row of bundle.areaFarms) {
    const key = `${row.areaId}:${row.huntSpotId}`;
    if (spots.has(key)) issues.push(`duplicate area farm ${key}`);
    spots.add(key);
  }
  const starter = bundle.assistantTypes.find((row) => row.id === STARTER_ID);
  const next = bundle.assistantTypes.find((row) => row.id === NEXT_ID);
  if (!starter) issues.push(`assistant type ${STARTER_ID} is required`);
  else pushStarterIssues(issues, starter);
  if (!next) issues.push(`assistant type ${NEXT_ID} is required`);
  else pushNextIssues(issues, next);
  const farm = bundle.farmResources.find((row) => row.id === FARM_ID);
  if (!farm) issues.push(`farm resource ${FARM_ID} is required`);
  else pushFarmIssues(issues, farm);
  const crystalSpot = bundle.areaFarms.find(
    (row) => row.areaId === AREA_ID && row.farmId === FARM_ID,
  );
  if (!crystalSpot) issues.push(`area ${AREA_ID} must publish farm ${FARM_ID}`);
  else {
    if (crystalSpot.tactics !== 0) issues.push(`area ${AREA_ID} tactics must be 0`);
    if (crystalSpot.huntSpotId !== 15)
      issues.push(`area ${AREA_ID} crystal hunt_spot_id must be 15`);
    if (crystalSpot.cntMax !== 1600) issues.push(`area ${AREA_ID} cnt_max must be 1600`);
    if (crystalSpot.cntCurrent !== 1396) issues.push(`area ${AREA_ID} cnt_current must be 1396`);
    if (crystalSpot.cntCooldown !== 1800) issues.push(`area ${AREA_ID} cnt_cooldown must be 1800`);
    if (crystalSpot.assistantMax !== 37) issues.push(`area ${AREA_ID} assistant_max must be 37`);
  }
  const areaIds = new Set(bundle.areas.map((area) => area.id));
  for (const row of bundle.areaFarms) {
    if (!areaIds.has(row.areaId)) issues.push(`area farm ${row.areaId} area is missing`);
    if (!farmIds.has(row.farmId)) {
      issues.push(`area farm ${row.areaId}:${row.huntSpotId} farm ${row.farmId} is missing`);
    }
  }
  const artifacts = new Set(bundle.artifacts.map((row) => row.id));
  if (!artifacts.has(LOOT_ID)) issues.push(`artifact ${LOOT_ID} is required for farm ${FARM_ID}`);
  if (!artifacts.has(1721)) issues.push("artifact 1721 is required for assistant 13 upgrade");
  if (!artifacts.has(1722)) issues.push("artifact 1722 is required for assistant 13 upgrade");
  for (const row of bundle.farmResources) {
    if (!artifacts.has(row.artifactArtikulId)) {
      issues.push(`farm ${row.id} artifact ${row.artifactArtikulId} is missing`);
    }
  }
  for (const row of bundle.assistantTypes) {
    if (row.nextArtikulId > 0 && !typeIds.has(row.nextArtikulId)) {
      issues.push(`assistant ${row.id} next ${row.nextArtikulId} is missing`);
    }
  }
  return issues;
}

function pushStarterIssues(issues: string[], row: AssistantTypeDocument): void {
  if (row.title !== "Имуро-Юи") issues.push(`assistant ${row.id} title must be Имуро-Юи`);
  if (row.profession !== 2) issues.push(`assistant ${row.id} profession must be 2`);
  if (row.quality !== 0) issues.push(`assistant ${row.id} quality must be 0`);
  if (row.level !== 1) issues.push(`assistant ${row.id} level must be 1`);
  if (row.nextArtikulId !== NEXT_ID) issues.push(`assistant ${row.id} next must be ${NEXT_ID}`);
  if (row.skillSum !== 4) issues.push(`assistant ${row.id} skillSum must be 4`);
  if (row.picture !== "gremlin_star_grey_1.png") {
    issues.push(`assistant ${row.id} picture must be gremlin_star_grey_1.png`);
  }
}

function pushNextIssues(issues: string[], row: AssistantTypeDocument): void {
  if (row.title !== "Имуро-Юи") issues.push(`assistant ${row.id} title must be Имуро-Юи`);
  if (row.profession !== 2) issues.push(`assistant ${row.id} profession must be 2`);
  if (row.level !== 2) issues.push(`assistant ${row.id} level must be 2`);
  if (
    !row.restrictionsXml.includes('id="1720"') ||
    !row.restrictionsXml.includes('value="180"') ||
    !row.restrictionsXml.includes('id="1721"') ||
    !row.restrictionsXml.includes('value="170"') ||
    !row.restrictionsXml.includes('id="1722"')
  ) {
    issues.push(`assistant ${row.id} restrictions must consume 1720×180, 1721×170, 1722×170`);
  }
}

function pushFarmIssues(issues: string[], row: FarmResourceDocument): void {
  if (row.title !== "Хрусталь") issues.push(`farm ${row.id} title must be Хрусталь`);
  if (row.profession !== 2) issues.push(`farm ${row.id} profession must be 2`);
  if (row.artifactArtikulId !== LOOT_ID) issues.push(`farm ${row.id} artifact must be ${LOOT_ID}`);
  if (row.farmTime !== 60) issues.push(`farm ${row.id} farmTime must be 60`);
  if (row.staminaDrain !== 4) issues.push(`farm ${row.id} staminaDrain must be 4`);
  if (row.masteryValue !== 0) issues.push(`farm ${row.id} masteryValue must be 0`);
  if (row.masteryMax !== 60) issues.push(`farm ${row.id} masteryMax must be 60`);
  if (row.picture !== "res_starat_hrustal1.png") {
    issues.push(`farm ${row.id} picture must be res_starat_hrustal1.png`);
  }
}
