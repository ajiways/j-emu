import type { ArtifactBonus } from "../../catalog/domain/artifact-bonus.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { InventoryRepository } from "../ports/inventory-repository.ts";
import { addHpGain } from "./add-hp-gain.ts";
import { amountFromParams } from "./amount-from-params.ts";
import { applyDrink } from "./apply-drink.ts";
import { applyUseScript } from "./apply-use-script.ts";
import { consumeDispose } from "./consume-dispose.ts";
import type { InventoryItem } from "./inventory-item.ts";
import { UseDeniedError } from "./use-denied-error.ts";

export type UseFromBagCommand = Readonly<{
  characterId: number;
  itemId: number;
  hpMax: number;
  mpMax: number;
  heroLevel: number;
  nowSec: number;
  bagCapacity: number;
}>;

export type UseFromBagResult =
  | Readonly<{ kind: "add_hp"; gain: number }>
  | Readonly<{ kind: "add_mp"; gain: number }>
  | Readonly<{ kind: "drink"; title: string }>
  | Readonly<{ kind: "script" }>
  | Readonly<{
      kind: "learn_bonus";
      bonus: ArtifactBonus;
      dispose: number;
      artikulId: number;
      itemId: number;
    }>
  | Readonly<{ kind: "learn_recipe"; dispose: number; artikulId: number; itemId: number }>
  | Readonly<{ kind: "open_npc"; npcId: number }>;

export async function useFromBag(
  inventory: InventoryRepository,
  catalog: Catalog,
  command: UseFromBagCommand,
): Promise<UseFromBagResult> {
  const items = await inventory.lockForHero(command.characterId);
  const item = requireBagItem(items, command.characterId, command.itemId);
  const definition = await catalog.artifact(item.artifactId);
  if (!definition) throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
  const action = definition.useAction;
  if (!action) throw UseDeniedError.withoutAction();
  if (definition.levelMin > 0 && command.heroLevel < definition.levelMin) {
    throw new UseDeniedError(`С ${definition.levelMin} уровня!`);
  }
  if (action.code === "ADD_HP") {
    const gain = addHpGain(
      command.hpMax,
      requireIntegerActionParam(action.param1, "ADD_HP param1"),
      requireIntegerActionParam(action.param2, "ADD_HP param2"),
    );
    if (gain < 1) throw UseDeniedError.invalidEffect();
    await consumeDispose(inventory, item, action);
    return { kind: "add_hp", gain };
  }
  if (action.code === "ADD_MP") {
    const gain = amountFromParams(
      command.mpMax,
      requireIntegerActionParam(action.param1, "ADD_MP param1"),
      requireIntegerActionParam(action.param2, "ADD_MP param2"),
      "ADD_MP",
    );
    if (gain < 1) throw UseDeniedError.invalidEffect();
    await consumeDispose(inventory, item, action);
    return { kind: "add_mp", gain };
  }
  if (action.code === "DRINK") {
    await applyDrink(inventory, catalog, {
      characterId: command.characterId,
      item,
      definition,
      nowSec: command.nowSec,
    });
    return { kind: "drink", title: action.title };
  }
  if (action.code === "NPC") {
    const npcId = requireIntegerActionParam(action.param1, "NPC param1");
    if (npcId < 1) throw new Error("NPC use action requires param1 npc id");
    return { kind: "open_npc", npcId };
  }
  if (action.code === "LEARN_RECIPE") {
    return {
      kind: "learn_recipe",
      dispose: action.dispose,
      artikulId: item.artifactId,
      itemId: item.id,
    };
  }
  if (action.code !== "") throw UseDeniedError.unsupported(action.code);
  if (action.bonusId < 1) throw new UseDeniedError("у предмета нет бонуса");
  const script = await catalog.useScript(action.bonusId);
  if (script) {
    await applyUseScript(inventory, catalog, command.bagCapacity, {
      characterId: command.characterId,
      script,
      description: action.description,
    });
    return { kind: "script" };
  }
  const bonus = await catalog.bonus(action.bonusId);
  if (!bonus) throw new UseDeniedError(`бонус ${action.bonusId} пока не поддержан`);
  return {
    kind: "learn_bonus",
    bonus,
    dispose: action.dispose,
    artikulId: item.artifactId,
    itemId: item.id,
  };
}

function requireBagItem(
  items: readonly InventoryItem[],
  heroId: number,
  itemId: number,
): InventoryItem {
  const matches = items.filter((item) => item.id === itemId);
  if (matches.length > 1) throw new Error(`Multiple items found for ${itemId}`);
  const item = matches[0];
  if (!item || item.heroId !== heroId) throw UseDeniedError.itemMissing();
  if (item.location.kind !== "bag") throw UseDeniedError.mustUnequip();
  return item;
}

function requireIntegerActionParam(value: number | string, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${label} must be an integer`);
  }
  return value;
}

export async function consumeBagCharge(
  inventory: InventoryRepository,
  characterId: number,
  itemId: number,
): Promise<void> {
  const items = await inventory.lockForHero(characterId);
  const item = requireBagItem(items, characterId, itemId);
  if (item.quantity <= 1) await inventory.delete(item);
  else await inventory.save(item.withQuantity(item.quantity - 1));
}
