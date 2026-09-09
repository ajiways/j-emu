import { InsufficientMoneyError } from "../modules/character/domain/insufficient-money-error.ts";
import type { CharacterMoney } from "../modules/character/ports/character-money.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import { StoreDeniedError } from "./store-denied-error.ts";

export type StoreRepairCommand = Readonly<{
  characterId: number;
  itemId: number;
}>;

export class StoreRepair {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly characters: CharacterMoney,
    private readonly inventory: InventoryService,
  ) {}

  async repair(command: StoreRepairCommand): Promise<void> {
    try {
      await this.unitOfWork.run(async () => {
        const { costMinor } = await this.inventory.repair({
          characterId: command.characterId,
          itemId: command.itemId,
        });
        if (costMinor < 1) return;
        await this.characters.debitMoney({
          characterId: command.characterId,
          minorUnits: costMinor,
          allowGhost: true,
        });
      });
    } catch (error) {
      if (error instanceof InsufficientMoneyError) {
        throw new StoreDeniedError("Недостаточно денег");
      }
      throw error;
    }
  }
}
