import type { ArtifactSetInfo } from "./artifact-set-info.ts";
import type { ArtifactGloveSocket, ArtifactSpell } from "./artifact-spell.ts";

export class ArtifactExtra {
  constructor(
    readonly spell: ArtifactSpell | null,
    readonly sockets: readonly ArtifactGloveSocket[],
    readonly hits: readonly number[] | null,
    readonly set: ArtifactSetInfo | null,
    readonly trend: number,
  ) {
    if (!Number.isInteger(trend) || trend < 0 || trend > 3) {
      throw new Error("Artifact extra.trend must be 0, 1, 2 or 3");
    }
    if (this.hits !== null && this.hits.length !== 8) {
      throw new Error("Glove hits must contain 8 L/C/R steps");
    }
    if (this.hits) {
      for (const hit of this.hits) {
        if (hit !== 1 && hit !== 2 && hit !== 3) throw new Error("Glove hit must be 1, 2 or 3");
      }
    }
    for (const socket of this.sockets) {
      if (!Number.isInteger(socket.cost) || socket.cost < 1) {
        throw new Error("Glove socket cost must be a positive integer");
      }
      if (!Number.isInteger(socket.artikulId0) || socket.artikulId0 < 1) {
        throw new Error("Glove socket artikul_id0 is required");
      }
    }
  }
}
