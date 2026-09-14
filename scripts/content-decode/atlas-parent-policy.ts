import type { AreaDocument } from "../../src/modules/content/domain/content-playable-entities.ts";

/** Parents outside the authored atlas are the map boundary, not invented areas. */
export function clearMissingParents(areas: readonly AreaDocument[]): AreaDocument[] {
  const ids = new Set(areas.map((area) => area.id));
  return areas.map((area) => {
    if (!area.parentId || ids.has(area.parentId)) return area;
    return { ...area, parentId: "" };
  });
}
