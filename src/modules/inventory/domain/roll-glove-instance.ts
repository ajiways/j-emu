import type { ArtifactDefinition } from "../../catalog/domain/artifact-definition.ts";
import type { ArtifactExtra } from "../../catalog/domain/artifact-extra.ts";
import type { ArtifactGloveSocket } from "../../catalog/domain/artifact-spell.ts";
import {
  EMPTY_ITEM_INSTANCE,
  type GloveInstanceSpell,
  type ItemInstanceData,
} from "./item-instance-data.ts";

export function itemInstanceDataForGrant(
  definition: ArtifactDefinition,
  random: Readonly<{ unit(): number }>,
): ItemInstanceData {
  if (definition.extra.sockets.length < 1) return EMPTY_ITEM_INSTANCE;
  return rollGloveInstance(definition.extra, () => random.unit());
}

export function rollGloveInstance(extra: ArtifactExtra, unit: () => number): ItemInstanceData {
  const hits = extra.hits ? [...extra.hits] : rollGloveHits(unit);
  const spells: GloveInstanceSpell[] = extra.sockets.map((socket) => ({
    artikul_id: pickActiveSpellId(socket, unit),
    cost: socket.cost,
    row: socket.row,
  }));
  return { hits, spells };
}

function pickActiveSpellId(socket: ArtifactGloveSocket, unit: () => number): number {
  if (socket.artikulId0 >= 1) return socket.artikulId0;
  if (socket.pool.length < 1) {
    throw new Error("Glove socket pool is empty");
  }
  const picked = socket.pool[Math.floor(unit() * socket.pool.length)];
  if (picked === undefined || picked < 1) {
    throw new Error("Glove socket pool roll is empty");
  }
  return picked;
}

function rollGloveHits(unit: () => number): number[] {
  const hits: number[] = [];
  for (let index = 0; index < 8; index += 1) {
    hits.push(1 + Math.floor(unit() * 3));
  }
  return hits;
}
