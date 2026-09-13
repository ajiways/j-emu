import { MailBagFullError } from "../modules/inventory/domain/mail-bag-full-error.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { HeldItemsRepository } from "../modules/trade/ports/held-items-repository.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import { mailSnapshotFromTrade } from "./trade-item-map.ts";

export async function refundTradeHeldItems(input: {
  heldItems: HeldItemsRepository;
  inventory: Pick<InventoryService, "grantMailSnapshots">;
  unitOfWork: UnitOfWork;
}): Promise<void> {
  const rows = await input.heldItems.listAll();
  for (const row of rows) {
    try {
      await input.unitOfWork.run(async () => {
        await input.inventory.grantMailSnapshots({
          characterId: row.heroId,
          snapshots: [mailSnapshotFromTrade(row)],
        });
        await input.heldItems.deleteById(row.id);
      });
    } catch (error) {
      if (error instanceof MailBagFullError) continue;
      throw error;
    }
  }
}
