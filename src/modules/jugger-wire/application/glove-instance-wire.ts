import type { ArtifactDefinition } from "../../catalog/domain/artifact-definition.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { InventoryItem } from "../../inventory/domain/inventory-item.ts";
import {
  isRolledGloveInstance,
  type GloveInstanceSpell,
} from "../../inventory/domain/item-instance-data.ts";

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

export async function gloveInstanceFromItem(
  definition: ArtifactDefinition,
  item: InventoryItem,
  catalog: Pick<Catalog, "artifact">,
): Promise<GloveInstanceWire | null> {
  if (definition.extra.sockets.length < 1) return null;
  if (isRolledGloveInstance(item.data, definition.extra.sockets.length)) {
    return expandGloveCards(item.data.hits, item.data.spells, catalog);
  }
  return gloveInstanceFromCatalog(definition, catalog);
}

export async function gloveInstanceFromCatalog(
  definition: ArtifactDefinition,
  catalog: Pick<Catalog, "artifact">,
): Promise<GloveInstanceWire | null> {
  if (definition.extra.sockets.length < 1) return null;
  if (!definition.extra.hits) {
    throw new Error(`Glove artifact ${definition.id} is missing extra.hits`);
  }
  const spells: GloveInstanceSpell[] = [];
  for (const socket of definition.extra.sockets) {
    if (socket.artikulId0 < 1) {
      throw new Error(`Glove item is missing rolled hits/spells for artifact ${definition.id}`);
    }
    spells.push({ artikul_id: socket.artikulId0, cost: socket.cost, row: socket.row });
  }
  return expandGloveCards(definition.extra.hits, spells, catalog);
}

async function expandGloveCards(
  hits: readonly number[],
  spells: readonly GloveInstanceSpell[],
  catalog: Pick<Catalog, "artifact">,
): Promise<GloveInstanceWire> {
  const cards: GloveSpellCard[] = [];
  for (const socket of spells) {
    const spell = await catalog.artifact(socket.artikul_id);
    if (!spell) throw new Error(`Glove spell ${socket.artikul_id} is missing`);
    cards.push({
      id: spell.id,
      artikul_id: spell.id,
      artikul_id0: socket.artikul_id,
      title: spell.title,
      picture: spell.picture,
      description: "",
      quality: 0,
      row: socket.row,
      cost: socket.cost,
    });
  }
  return { hits, spells: cards, extra: { hits, spells: cards } };
}
