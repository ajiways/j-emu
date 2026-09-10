import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { MailService } from "../modules/mail/application/mail-service.ts";
import type { AuctionService } from "../modules/auction/application/auction-service.ts";
import { AuctionDeniedError } from "../modules/auction/domain/auction-denied-error.ts";
import { LISTING_KIND_LOT } from "../modules/auction/domain/listing-kind.ts";
import {
  LISTING_STATUS_CANCELLED,
  LISTING_STATUS_OPEN,
} from "../modules/auction/domain/listing-status.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import { deliverAuctionMail } from "./auction-mail.ts";
import type { AuctionExpiry } from "./auction-expiry.ts";

export class AuctionCancel {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly expiry: Pick<AuctionExpiry, "sweepUnlocked">,
    private readonly characters: Pick<CharacterService, "lockById" | "getById">,
    private readonly mail: Pick<MailService, "deliverSystemInbox">,
    private readonly auction: Pick<AuctionService, "lock" | "save">,
  ) {}

  async cancel(heroId: number, lotId: number): Promise<void> {
    if (!Number.isInteger(lotId) || lotId < 1) throw new AuctionDeniedError("лот не найден");
    await this.unitOfWork.run(async () => {
      await this.expiry.sweepUnlocked();
      const row = await this.auction.lock(lotId);
      if (!row || row.status !== LISTING_STATUS_OPEN) throw new AuctionDeniedError("лот не найден");
      if (row.kind !== LISTING_KIND_LOT) throw new AuctionDeniedError("лот не найден");
      if (row.ownerHeroId !== heroId) throw new AuctionDeniedError("не ваш лот");
      if (row.bidderHeroId) throw new AuctionDeniedError("нельзя отменить лот со ставкой");
      const hero = await this.characters.lockById(heroId);
      await this.auction.save({ ...row, status: LISTING_STATUS_CANCELLED });
      await deliverAuctionMail(this.mail, this.characters, {
        toHeroId: hero.id,
        fromHeroId: null,
        fromNick: "Аукцион",
        subject: "Аукцион: возврат",
        text: `Лот «${row.title}» снят с аукциона. Предметы вернутся на вашу почту.`,
        moneyComeMinor: 0,
        listing: row,
        withItem: true,
      });
    });
  }
}
