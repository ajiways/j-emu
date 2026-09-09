import { findStoreLot } from "../modules/catalog/domain/find-store-lot.ts";
import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import { goldToMinor } from "../modules/character/shared/gold-to-minor.ts";
import { InsufficientMoneyError } from "../modules/character/domain/insufficient-money-error.ts";
import type { CharacterMoney } from "../modules/character/ports/character-money.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { WorldService } from "../modules/world/domain/world-service.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import { StoreDeniedError } from "./store-denied-error.ts";

export type StoreBasketLine = Readonly<{
  key: string;
  count: number;
}>;

export type StorePurchaseCommand = Readonly<{
  characterId: number;
  areaId: string;
  lines: readonly StoreBasketLine[];
}>;

export class StorePurchase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly characters: CharacterMoney,
    private readonly inventory: InventoryService,
    private readonly catalog: Catalog,
    private readonly world: WorldService,
  ) {}

  async buy(command: StorePurchaseCommand): Promise<void> {
    const area = await this.world.area(command.areaId);
    if (area.code !== "store") throw new StoreDeniedError("Здесь нельзя торговать");
    if (command.lines.length < 1) throw new StoreDeniedError("пустая корзина");
    const lots = await this.catalog.storeLots(command.areaId);
    const grants: Array<{ artifactId: number; quantity: number }> = [];
    let minorUnits = 0;
    for (const line of command.lines) {
      const lot = findStoreLot(lots, line.key);
      if (!lot) throw new StoreDeniedError(`неизвестный товар ${line.key}`);
      minorUnits += goldToMinor(lot.price) * line.count;
      grants.push({ artifactId: lot.artikulId, quantity: line.count });
    }
    try {
      await this.unitOfWork.run(async () => {
        await this.characters.debitMoney({
          characterId: command.characterId,
          minorUnits,
        });
        for (const grant of grants) {
          await this.inventory.grantToBag({
            characterId: command.characterId,
            artifactId: grant.artifactId,
            quantity: grant.quantity,
          });
        }
      });
    } catch (error) {
      if (error instanceof InsufficientMoneyError) {
        throw new StoreDeniedError("Недостаточно денег");
      }
      throw error;
    }
  }
}
