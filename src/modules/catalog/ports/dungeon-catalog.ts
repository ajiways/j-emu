import type { DungeonDefinition } from "../domain/dungeon-definition.ts";

export interface DungeonCatalog {
  byArtikul(artikulId: string): Promise<DungeonDefinition | null>;
  byStartArea(areaId: string): Promise<DungeonDefinition | null>;
  byArea(areaId: string): Promise<DungeonDefinition | null>;
}
