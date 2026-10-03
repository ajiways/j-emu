import type { ArtifactDefinition } from "../modules/catalog/domain/artifact-definition.ts";
import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { Hero } from "../modules/character/domain/hero.ts";
import type { FightArtikulListWire } from "../modules/combat/domain/fight-loot-block.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import { capDropQuantity } from "../modules/quests/domain/quest-loot-needed.ts";
import type { QuestLootNeeded } from "../modules/quests/ports/quest-loot-needed.ts";

type SettlementCharacters = Readonly<{
  noteDefeat(input: { characterId: number; hp: 0 }): Promise<unknown>;
  noteHp(input: { characterId: number; hp: number }): Promise<unknown>;
  noteMp(input: { characterId: number; mp: number }): Promise<unknown>;
  lockById(characterId: number): Promise<Hero>;
}>;

/**
 * What a hero keeps of his hit points and mana after a fight. A bonus to the maximum (an elixir, a
 * scenario's own maximum) lasts only for the fight, so the remainder is cut to the hero's real
 * maximum. Mana goes first: a defeated hero becomes a ghost, and a ghost takes no resource updates.
 */
export async function persistFightResources(
  characters: SettlementCharacters,
  resources: Readonly<{ characterId: number; hp: number; mp: number }>,
): Promise<void> {
  const { characterId } = resources;
  const hero = await characters.lockById(characterId);
  const hp = Math.min(resources.hp, hero.maxHp);
  const mp = Math.min(resources.mp, hero.maxMp);
  await characters.noteMp({ characterId, mp });
  if (hp === 0) await characters.noteDefeat({ characterId, hp: 0 });
  else await characters.noteHp({ characterId, hp });
}

function artikulListEntry(definition: ArtifactDefinition): FightArtikulListWire {
  return {
    id: definition.id,
    title: definition.title,
    picture: definition.picture,
    type_id: definition.typeId,
    kind_id: definition.kindId,
    price: definition.priceMinor / 100,
    level_min: definition.levelMin,
    level_max: definition.levelMax,
    flags: definition.flags,
    slot_mask: definition.slotMask,
    cnt: 1,
  };
}

export async function capRolledDrops(input: {
  inventory: InventoryService;
  lootNeeded: QuestLootNeeded;
  characterId: number;
  rolled: readonly { artikulId: number; quantity: number }[];
}): Promise<readonly { artikulId: number; quantity: number }[]> {
  const owned = new Map<number, number>();
  const capped: { artikulId: number; quantity: number }[] = [];
  for (const drop of input.rolled) {
    const counted = owned.get(drop.artikulId);
    const have =
      counted === undefined
        ? await input.inventory.countBagByArtifact({
            characterId: input.characterId,
            artifactId: drop.artikulId,
          })
        : counted;
    const needed = await input.lootNeeded.needed(input.characterId, drop.artikulId, have);
    const quantity = capDropQuantity(drop.quantity, needed);
    owned.set(drop.artikulId, have + quantity);
    if (quantity < 1) continue;
    capped.push({ artikulId: drop.artikulId, quantity });
  }
  return capped;
}

export async function loadArtikulList(
  catalog: Catalog,
  rolled: readonly { artikulId: number; quantity: number }[],
): Promise<readonly FightArtikulListWire[]> {
  const entries: FightArtikulListWire[] = [];
  for (const drop of rolled) {
    const definition = await catalog.artifact(drop.artikulId);
    if (!definition) throw new Error(`Artifact catalog entry ${drop.artikulId} is missing`);
    entries.push(artikulListEntry(definition));
  }
  return entries;
}
