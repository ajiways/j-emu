import type { ContentBundle } from "../domain/content-document.ts";

const REQUIRED_DUNGEON_ARTIKULS = [1, 2, 4, 6, 7, 11, 12, 14] as const;

export function collectDungeonIssues(bundle: ContentBundle): readonly string[] {
  const issues: string[] = [];
  const areaIds = new Set(bundle.areas.map((area) => area.id));
  const areasById = new Map(bundle.areas.map((area) => [area.id, area]));
  const botIds = new Set(bundle.bots.map((bot) => bot.id));
  const artifactIds = new Set(bundle.artifacts.map((artifact) => artifact.id));
  const huntAreas = new Set(bundle.huntSpawns.map((spawn) => spawn.areaId));
  const artikuls = new Set<number>();
  const startAreas = new Set<string>();
  for (const artikulId of REQUIRED_DUNGEON_ARTIKULS) {
    if (!bundle.dungeons.some((dungeon) => dungeon.artikulId === artikulId)) {
      issues.push(`dungeon ${artikulId} is missing`);
    }
  }
  for (const dungeon of bundle.dungeons) {
    if (artikuls.has(dungeon.artikulId)) {
      issues.push(`dungeon artikul ${dungeon.artikulId} is duplicated`);
    }
    artikuls.add(dungeon.artikulId);
    if (startAreas.has(dungeon.startAreaId)) {
      issues.push(`dungeon start area ${dungeon.startAreaId} is duplicated`);
    }
    startAreas.add(dungeon.startAreaId);
    if (!areaIds.has(dungeon.startAreaId)) {
      issues.push(`dungeon ${dungeon.artikulId} start area ${dungeon.startAreaId} is missing`);
    }
    if (!areaIds.has(dungeon.parentAreaId)) {
      issues.push(`dungeon ${dungeon.artikulId} parent area ${dungeon.parentAreaId} is missing`);
    }
    if (huntAreas.has(dungeon.startAreaId)) {
      issues.push(
        `dungeon ${dungeon.artikulId} start area ${dungeon.startAreaId} must not have outdoor hunt_spawns`,
      );
    }
    const startArea = areasById.get(dungeon.startAreaId);
    if (startArea && startArea.code === "store") {
      issues.push(
        `dungeon ${dungeon.artikulId} start area ${dungeon.startAreaId} must not be a store area`,
      );
    }
    if (dungeon.clear && !artifactIds.has(dungeon.clear.coinArtikulId)) {
      issues.push(
        `dungeon ${dungeon.artikulId} coin artikul ${dungeon.clear.coinArtikulId} is missing`,
      );
    }
    if (dungeon.loot?.bossBotId !== undefined && !botIds.has(dungeon.loot.bossBotId)) {
      issues.push(
        `dungeon ${dungeon.artikulId} loot boss bot ${dungeon.loot.bossBotId} is missing`,
      );
    }
    for (const lootArtikulId of dungeon.loot === undefined ? [] : dungeon.loot.personalGuaranteed) {
      if (!artifactIds.has(lootArtikulId)) {
        issues.push(
          `dungeon ${dungeon.artikulId} personal_guaranteed artikul ${lootArtikulId} is missing`,
        );
      }
    }
    for (const area of dungeon.areas) {
      if (!areaIds.has(area.areaId)) {
        issues.push(`dungeon ${dungeon.artikulId} area ${area.areaId} is missing`);
      }
      if (huntAreas.has(area.areaId)) {
        issues.push(
          `dungeon ${dungeon.artikulId} area ${area.areaId} must not have outdoor hunt_spawns`,
        );
      }
      const floor = areasById.get(area.areaId);
      if (floor && floor.code === "store") {
        issues.push(`dungeon ${dungeon.artikulId} area ${area.areaId} must not be a store area`);
      }
      for (const spawn of area.spawns) {
        if (!botIds.has(spawn.huntBotId)) {
          issues.push(
            `dungeon ${dungeon.artikulId} spawn ${spawn.spawnKey} hunt bot ${spawn.huntBotId} is missing`,
          );
        }
        for (const encounter of spawn.encounter) {
          if (!botIds.has(encounter.botId)) {
            issues.push(
              `dungeon ${dungeon.artikulId} spawn ${spawn.spawnKey} encounter bot ${encounter.botId} is missing`,
            );
          }
        }
      }
    }
  }
  return issues;
}
