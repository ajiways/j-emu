import type { Area } from "../domain/area.ts";

export interface WorldRepository {
  findArea(id: string): Promise<Area | null>;
}
