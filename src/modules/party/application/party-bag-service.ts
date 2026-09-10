import type { Clock } from "../../../shared/kernel/clock.ts";
import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { UnitOfWork } from "../../../shared/kernel/unit-of-work.ts";
import { BAG_TTL_SEC } from "../domain/party-channel.ts";
import { PartyDeniedError } from "../domain/party-denied-error.ts";
import type { PartyBagItem } from "../domain/party-record.ts";
import type { PartyBagDeposit, PartyBagDrop } from "../ports/party-bag-deposit.ts";
import type { PartyBagRepository } from "../ports/party-bag-repository.ts";
import type { PartyRepository } from "../ports/party-repository.ts";

export class PartyBagService implements PartyBagDeposit {
  constructor(
    private readonly parties: PartyRepository,
    private readonly bags: PartyBagRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  list(partyId: number): Promise<readonly PartyBagItem[]> {
    return this.unitOfWork.run(() => this.listLocked(partyId));
  }

  async deposit(partyId: number, drops: readonly PartyBagDrop[]): Promise<void> {
    requireWireIdentity(partyId, "party id");
    await this.unitOfWork.run(async () => {
      await this.lockParty(partyId);
      await this.purgeLocked(partyId);
      const removeTime = this.clock.unixSeconds() + BAG_TTL_SEC;
      for (const drop of drops) {
        if (!Number.isInteger(drop.quantity) || drop.quantity < 1) {
          throw new Error("Party bag drop quantity must be a positive integer");
        }
        requireWireIdentity(drop.artikulId, "artikul id");
        for (let index = 0; index < drop.quantity; index += 1) {
          await this.bags.insertItem({
            partyId,
            artikulId: drop.artikulId,
            cnt: 1,
            removeTime,
          });
        }
      }
    });
  }

  takeOne(partyId: number, itemId: number): Promise<PartyBagItem> {
    return this.mutateItem(partyId, itemId, 1);
  }

  requireItem(partyId: number, itemId: number): Promise<PartyBagItem> {
    return this.unitOfWork.run(async () => {
      await this.lockParty(partyId);
      await this.purgeLocked(partyId);
      const now = this.clock.unixSeconds();
      const row = await this.bags.lockItem(partyId, itemId);
      if (!row || row.removeTime <= now || row.cnt < 1) {
        throw new PartyDeniedError("предмет не найден");
      }
      return row;
    });
  }

  dropQty(partyId: number, itemId: number, quantity: number): Promise<void> {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new PartyDeniedError("предмет не найден");
    }
    return this.mutateItem(partyId, itemId, quantity).then(() => undefined);
  }

  async dumpRows(partyId: number): Promise<readonly PartyBagItem[]> {
    return this.unitOfWork.run(() => this.listLocked(partyId));
  }

  private async listLocked(partyId: number): Promise<readonly PartyBagItem[]> {
    await this.lockParty(partyId);
    await this.purgeLocked(partyId);
    return this.bags.listItems(partyId);
  }

  private async mutateItem(
    partyId: number,
    itemId: number,
    quantity: number,
  ): Promise<PartyBagItem> {
    return this.unitOfWork.run(async () => {
      await this.lockParty(partyId);
      await this.purgeLocked(partyId);
      const now = this.clock.unixSeconds();
      const row = await this.bags.lockItem(partyId, itemId);
      if (!row || row.removeTime <= now || row.cnt < quantity) {
        throw new PartyDeniedError("предмет не найден");
      }
      if (row.cnt === quantity) await this.bags.deleteItem(partyId, itemId);
      else await this.bags.saveItem({ ...row, cnt: row.cnt - quantity });
      return row;
    });
  }

  private async purgeLocked(partyId: number): Promise<void> {
    await this.bags.deleteExpired(partyId, this.clock.unixSeconds());
  }

  private async lockParty(partyId: number): Promise<void> {
    const party = await this.parties.lockParty(partyId);
    if (!party) throw new PartyDeniedError("группа не найдена");
  }
}
