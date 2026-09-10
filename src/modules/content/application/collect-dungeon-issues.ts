import type { ContentBundle } from "../domain/content-document.ts";

export function collectDungeonIssues(bundle: ContentBundle): readonly string[] {
  const issues: string[] = [];
  const areaIds = new Set(bundle.areas.map((area) => area.id));
  const botIds = new Set(bundle.bots.map((bot) => bot.id));
  const huntAreas = new Set(bundle.huntSpawns.map((spawn) => spawn.areaId));
  const artikuls = new Set<number>();
  const startAreas = new Set<string>();
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
    for (const area of dungeon.areas) {
      if (!areaIds.has(area.areaId)) {
        issues.push(`dungeon ${dungeon.artikulId} area ${area.areaId} is missing`);
      }
      if (huntAreas.has(area.areaId)) {
        issues.push(
          `dungeon ${dungeon.artikulId} area ${area.areaId} must not have outdoor hunt_spawns`,
        );
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
