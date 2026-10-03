import type { ArtifactRankRule } from "./artifact-rank-rule.ts";
import type { ArtifactSetInfo } from "./artifact-set-info.ts";
import type { ArtifactGloveSocket, ArtifactSpell } from "./artifact-spell.ts";

export class ArtifactExtra {
  constructor(
    readonly spell: ArtifactSpell | null,
    readonly sockets: readonly ArtifactGloveSocket[],
    readonly hits: readonly number[] | null,
    readonly set: ArtifactSetInfo | null,
    readonly trend: number,
    readonly param1: number,
    readonly flagsExt: number,
    /** The second slot mask (`SLOT2_*`): insignia, companion, the other hand's shield. */
    readonly slot2Mask: number,
    readonly rankRule: ArtifactRankRule | null,
  ) {
    if (!Number.isInteger(trend) || trend < 0 || trend > 3) {
      throw new Error("Artifact extra.trend must be 0, 1, 2 or 3");
    }
    if (!Number.isInteger(param1) || param1 < 0) {
      throw new Error("Artifact extra.param1 must be a non-negative integer");
    }
    if (!Number.isInteger(flagsExt) || flagsExt < 0) {
      throw new Error("Artifact extra.flagsExt must be a non-negative integer");
    }
    if (!Number.isInteger(slot2Mask) || slot2Mask < 0) {
      throw new Error("Artifact extra.slot2Mask must be a non-negative integer");
    }
    if (rankRule !== null && (!Number.isInteger(rankRule.rank) || rankRule.rank < 1)) {
      throw new Error("Artifact extra.rank.rank must be a positive integer");
    }
    if (rankRule !== null && !rankRule.buy && !rankRule.wear) {
      throw new Error("Artifact extra.rank must gate buying or wearing");
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
      if (!Number.isInteger(socket.row) || socket.row < 1) {
        throw new Error("Glove socket row must be a positive integer");
      }
      if (!Number.isInteger(socket.artikulId0) || socket.artikulId0 < 0) {
        throw new Error("Glove socket artikul_id0 is invalid");
      }
      for (const poolId of socket.pool) {
        if (!Number.isInteger(poolId) || poolId < 1) {
          throw new Error("Glove socket pool id must be a positive integer");
        }
      }
      if (socket.artikulId0 < 1 && socket.pool.length < 1) {
        throw new Error("Glove socket requires artikul_id0 or a spell pool");
      }
    }
  }
}
