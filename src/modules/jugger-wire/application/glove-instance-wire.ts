import type { ArtifactDefinition } from "../../catalog/domain/artifact-definition.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";

type GloveSpellCard = Readonly<{
  id: number;
  artikul_id: number;
  artikul_id0: number;
  title: string;
  picture: string;
  description: "";
  quality: 0;
  row: number;
  cost: number;
}>;

export type GloveInstanceWire = Readonly<{
  hits: readonly number[];
  spells: readonly GloveSpellCard[];
  extra: Readonly<{
    hits: readonly number[];
    spells: readonly GloveSpellCard[];
  }>;
}>;

export async function gloveInstanceFromCatalog(
  definition: ArtifactDefinition,
  catalog: Pick<Catalog, "artifact">,
): Promise<GloveInstanceWire | null> {
  if (definition.extra.sockets.length < 1) return null;
  if (!definition.extra.hits) {
    throw new Error(`Glove artifact ${definition.id} is missing extra.hits`);
  }
  const spells: GloveSpellCard[] = [];
  for (const socket of definition.extra.sockets) {
    const spell = await catalog.artifact(socket.artikulId0);
    if (!spell) throw new Error(`Glove spell ${socket.artikulId0} is missing`);
    spells.push({
      id: spell.id,
      artikul_id: spell.id,
      artikul_id0: socket.artikulId0,
      title: spell.title,
      picture: spell.picture,
      description: "",
      quality: 0,
      row: socket.row,
      cost: socket.cost,
    });
  }
  const hits = definition.extra.hits;
  return { hits, spells, extra: { hits, spells } };
}
