import type { AmbushStartFightOpDocument } from "../../content/domain/content-quest.ts";

export function ambushHits(
  op: AmbushStartFightOpDocument,
  rng: Readonly<{ unit(): number }>,
): boolean {
  if (!("chance" in op) || op.chance === undefined) return true;
  if (!Number.isFinite(op.chance) || op.chance < 0 || op.chance > 1) {
    throw new Error("Ambush chance must be in [0, 1]");
  }
  return rng.unit() < op.chance;
}
