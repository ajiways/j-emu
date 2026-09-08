import type { Area } from "./area.ts";

export function canExitInterior(area: Area): boolean {
  return area.code !== "" && area.parentId !== "";
}
