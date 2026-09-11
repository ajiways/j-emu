import type { AssistantTypeDefinition } from "../../catalog/domain/assistant-type-definition.ts";
import { InsufficientDiamondsError } from "../../character/domain/insufficient-diamonds-error.ts";
import { InsufficientMoneyError } from "../../character/domain/insufficient-money-error.ts";
import { goldToMinor } from "../../character/shared/gold-to-minor.ts";
import type { InventoryService } from "../../inventory/domain/inventory-service.ts";
import { parseRequirementXml } from "../domain/parse-requirement-xml.ts";
import { ProfessionDeniedError } from "../domain/profession-denied-error.ts";

type UpgradeCharacters = Readonly<{
  lockById(heroId: number): Promise<{ moneyMinor: number; moneyGoldMinor: number }>;
  debitMoney(command: {
    characterId: number;
    minorUnits: number;
    allowGhost: boolean;
  }): Promise<void>;
  debitMoneyGold(command: {
    characterId: number;
    minorUnits: number;
    allowGhost: boolean;
  }): Promise<void>;
}>;

export async function consumeAssistantUpgrade(
  inventory: InventoryService,
  characters: UpgradeCharacters,
  heroId: number,
  level: number,
  next: AssistantTypeDefinition,
): Promise<void> {
  const reqs = parseRequirementXml(next.restrictionsXml);
  for (const req of reqs) await assertRequirement(inventory, characters, heroId, level, req);
  for (const req of reqs) await payRequirement(inventory, characters, heroId, req);
}

async function assertRequirement(
  inventory: InventoryService,
  characters: UpgradeCharacters,
  heroId: number,
  level: number,
  req: Readonly<{ type: string; id: number; value: number }>,
): Promise<void> {
  if (req.type === "artifact") {
    const have = await inventory.countBagByArtifact({
      characterId: heroId,
      artifactId: req.id,
    });
    if (have < req.value) throw new ProfessionDeniedError("Не хватает ресурсов");
    return;
  }
  if (req.type === "money") {
    const hero = await characters.lockById(heroId);
    if (hero.moneyMinor < goldToMinor(req.value)) {
      throw new ProfessionDeniedError("Не хватает ресурсов");
    }
    return;
  }
  if (req.type === "diamonds") {
    const hero = await characters.lockById(heroId);
    if (hero.moneyGoldMinor < goldToMinor(req.value)) {
      throw new ProfessionDeniedError("Не хватает ресурсов");
    }
    return;
  }
  if (req.type === "level" && level < req.value) {
    throw new ProfessionDeniedError("Не хватает ресурсов");
  }
}

async function payRequirement(
  inventory: InventoryService,
  characters: UpgradeCharacters,
  heroId: number,
  req: Readonly<{ type: string; id: number; value: number }>,
): Promise<void> {
  if (req.type === "artifact") {
    await inventory.consumeFromBag({
      characterId: heroId,
      artifactId: req.id,
      quantity: req.value,
    });
    return;
  }
  if (req.type === "money") {
    try {
      await characters.debitMoney({
        characterId: heroId,
        minorUnits: goldToMinor(req.value),
        allowGhost: false,
      });
    } catch (error) {
      if (error instanceof InsufficientMoneyError) {
        throw new ProfessionDeniedError("Не хватает ресурсов");
      }
      throw error;
    }
    return;
  }
  if (req.type === "diamonds") {
    try {
      await characters.debitMoneyGold({
        characterId: heroId,
        minorUnits: goldToMinor(req.value),
        allowGhost: false,
      });
    } catch (error) {
      if (error instanceof InsufficientDiamondsError) {
        throw new ProfessionDeniedError("Не хватает ресурсов");
      }
      throw error;
    }
  }
}
