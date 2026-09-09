import type { ArtifactDefinition } from "../../catalog/domain/artifact-definition.ts";
import type { ArtifactSpell } from "../../catalog/domain/artifact-spell.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import type {
  CombatGloveLoadout,
  CombatLoadout,
  CombatSpell,
} from "../../combat/domain/combat-loadout.ts";
import type { InventoryItem } from "../../inventory/domain/inventory-item.ts";
import type { InventoryService } from "../../inventory/domain/inventory-service.ts";

const GLOVE_SLOT = 32;

export class HuntCombatLoadout {
  constructor(
    private readonly inventory: InventoryService,
    private readonly catalog: Catalog,
  ) {}

  async snapshot(characterId: number): Promise<CombatLoadout> {
    const items = await this.inventory.list(characterId);
    const pocket = [];
    for (const item of items.filter((entry) => entry.location.kind === "pocket")) {
      const definition = await this.requireArtifact(item.artifactId);
      if (!definition.extra.spell) {
        throw new Error(
          `Pocket artifact ${item.artifactId} is missing extra.spell in the active catalog release`,
        );
      }
      pocket.push({
        itemId: item.id,
        artifactId: item.artifactId,
        count: item.quantity,
        title: definition.title,
        picture: definition.picture,
        spell: toCombatSpell(definition.extra.spell),
      });
    }
    return { pocket, glove: await this.gloveFrom(items) };
  }

  private async gloveFrom(items: readonly InventoryItem[]): Promise<CombatGloveLoadout | null> {
    const equipped = items.filter(
      (item) => item.location.kind === "equipment" && item.location.slot === GLOVE_SLOT,
    );
    if (equipped.length > 1) throw new Error("Multiple gloves are equipped");
    const glove = equipped[0];
    if (!glove) return null;
    const definition = await this.requireArtifact(glove.artifactId);
    if (definition.extra.sockets.length < 1) {
      throw new Error(`Glove artifact ${glove.artifactId} is missing extra.spells`);
    }
    if (!definition.extra.hits) {
      throw new Error(`Glove artifact ${glove.artifactId} is missing extra.hits`);
    }
    const spells = [];
    for (const socket of definition.extra.sockets) {
      const spellArt = await this.requireArtifact(socket.artikulId0);
      if (!spellArt.extra.spell) {
        throw new Error(`Glove spell ${socket.artikulId0} is missing extra.spell`);
      }
      spells.push({
        artikulId: socket.artikulId0,
        cost: socket.cost,
        row: socket.row,
        title: spellArt.title,
        picture: spellArt.picture,
        spell: toCombatSpell(spellArt.extra.spell),
      });
    }
    return { hits: definition.extra.hits, spells };
  }

  private async requireArtifact(id: number): Promise<ArtifactDefinition> {
    const definition = await this.catalog.artifact(id);
    if (!definition) throw new Error(`Artifact catalog entry ${id} is missing`);
    return definition;
  }
}

function toCombatSpell(spell: ArtifactSpell): CombatSpell {
  return {
    ...(spell.animData !== undefined ? { animData: spell.animData } : {}),
    ...(spell.groupId !== undefined ? { groupId: spell.groupId } : {}),
    ...(spell.cooldown !== undefined ? { cooldown: spell.cooldown } : {}),
    ...(spell.endTurn !== undefined ? { endTurn: spell.endTurn } : {}),
    ...(spell.flags !== undefined ? { flags: spell.flags } : {}),
    ...(spell.persRestr !== undefined ? { persRestr: spell.persRestr } : {}),
    ...(spell.targetRestr !== undefined ? { targetRestr: spell.targetRestr } : {}),
    effects: spell.effects.map((effect) => ({
      kind: effect.kind,
      ...(effect.amount !== undefined ? { amount: effect.amount } : {}),
      ...(effect.dmgType !== undefined ? { dmgType: effect.dmgType } : {}),
      ...(effect.charging !== undefined ? { charging: effect.charging } : {}),
      ...(effect.targetCount !== undefined ? { targetCount: effect.targetCount } : {}),
      ...(effect.skills ? { skills: effect.skills } : {}),
    })),
  };
}
