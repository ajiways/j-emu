import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { MailService } from "../modules/mail/application/mail-service.ts";
import type { AuctionService } from "../modules/auction/application/auction-service.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import { expireListing } from "./auction-mail.ts";

export class AuctionExpiry {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly auction: Pick<AuctionService, "lockExpired" | "save">,
    private readonly mail: Pick<MailService, "deliverSystemInbox">,
    private readonly heroes: Pick<CharacterService, "getById">,
  ) {}

  async sweep(): Promise<void> {
    await this.unitOfWork.run(() => this.sweepUnlocked());
  }

  async withSweep<T>(fn: () => Promise<T>): Promise<T> {
    return this.unitOfWork.run(async () => {
      await this.sweepUnlocked();
      return fn();
    });
  }

  async sweepUnlocked(): Promise<void> {
    const rows = await this.auction.lockExpired();
    for (const listing of rows) {
      await expireListing(listing, this.mail, this.heroes, (row) => this.auction.save(row));
    }
  }
}
