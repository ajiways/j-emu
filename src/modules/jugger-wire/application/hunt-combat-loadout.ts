import type { ArtifactDefinition } from "../../catalog/domain/artifact-definition.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import type {
  CombatGearSpell,
  CombatGloveLoadout,
  CombatLoadout,
} from "../../combat/domain/combat-loadout.ts";
import type { InventoryItem } from "../../inventory/domain/inventory-item.ts";
import type { InventoryService } from "../../inventory/domain/inventory-service.ts";
import { isRolledGloveInstance } from "../../inventory/domain/item-instance-data.ts";
import { toCombatSpell } from "./to-combat-spell.ts";

const GLOVE_SLOT = 32;

export class HuntCombatLoadout {
  constructor(
    private readonly inventory: InventoryService,
    private readonly catalog: Catalog,
  ) {}

  async snapshot(characterId: number): Promise<CombatLoadout> {
    const items = await this.inventory.list(characterId);
    const pocket = [];
    for (const item of items) {
      if (item.location.kind !== "pocket") continue;
      const definition = await this.requireArtifact(item.artifactId);
      if (!definition.extra.spell) {
        throw new Error(
          `Pocket artifact ${item.artifactId} is missing extra.spell in the active catalog release`,
        );
      }
      pocket.push({
        itemId: item.id,
        artifactId: item.artifactId,
        position: item.location.position,
        count: item.quantity,
        title: definition.title,
        picture: definition.picture,
        spell: toCombatSpell(definition.extra.spell),
      });
    }
    return {
      pocket,
      glove: await this.gloveFrom(items),
      gearSpells: await this.gearSpellsFrom(items),
    };
  }

  private async gearSpellsFrom(items: readonly InventoryItem[]): Promise<CombatGearSpell[]> {
    const spells: CombatGearSpell[] = [];
    for (const item of items) {
      if (item.location.kind !== "equipment") continue;
      const definition = await this.requireArtifact(item.artifactId);
      const spell = definition.extra.spell;
      if (!spell || spell.effects.length < 1) continue;
      if (!definition.picture) {
        throw new Error(
          `Equipped artifact ${item.artifactId} picture is required for gear-spell img`,
        );
      }
      spells.push({
        artikulId: item.artifactId,
        title: definition.title,
        picture: definition.picture,
        spell: toCombatSpell(spell),
      });
    }
    return spells;
  }

  private async gloveFrom(items: readonly InventoryItem[]): Promise<CombatGloveLoadout | null> {
    const equipped = items.filter(
      (item) => item.location.kind === "equipment" && item.location.slot === GLOVE_SLOT,
    );
    if (equipped.length > 1) throw new Error("Multiple gloves are equipped");
    const glove = equipped[0];
    if (!glove) return null;
    const definition = await this.requireArtifact(glove.artifactId);
    if (definition.extra.sockets.length < 1) return null;
    if (isRolledGloveInstance(glove.data, definition.extra.sockets.length)) {
      return this.gloveLoadout(glove.data.hits, glove.data.spells);
    }
    if (!definition.extra.hits) {
      throw new Error(`Glove artifact ${glove.artifactId} is missing extra.hits`);
    }
    const catalogSpells = [];
    for (const socket of definition.extra.sockets) {
      if (socket.artikulId0 < 1) {
        throw new Error(`Glove item ${glove.id} is missing rolled hits/spells`);
      }
      catalogSpells.push({
        artikul_id: socket.artikulId0,
        cost: socket.cost,
        row: socket.row,
      });
    }
    return this.gloveLoadout(definition.extra.hits, catalogSpells);
  }

  private async gloveLoadout(
    hits: readonly number[],
    spells: readonly { artikul_id: number; cost: number; row: number }[],
  ): Promise<CombatGloveLoadout> {
    const cards = [];
    for (const socket of spells) {
      const spellArt = await this.requireArtifact(socket.artikul_id);
      if (!spellArt.extra.spell) {
        throw new Error(`Glove spell ${socket.artikul_id} is missing extra.spell`);
      }
      cards.push({
        artikulId: socket.artikul_id,
        cost: socket.cost,
        row: socket.row,
        title: spellArt.title,
        picture: spellArt.picture,
        spell: toCombatSpell(spellArt.extra.spell),
      });
    }
    return { hits, spells: cards };
  }

  private async requireArtifact(id: number): Promise<ArtifactDefinition> {
    const definition = await this.catalog.artifact(id);
    if (!definition) throw new Error(`Artifact catalog entry ${id} is missing`);
    return definition;
  }
}
