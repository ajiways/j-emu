import type { CharacterService } from "../modules/character/application/character-service.ts";
import { InsufficientMoneyError } from "../modules/character/domain/insufficient-money-error.ts";
import type { MailService } from "../modules/mail/application/mail-service.ts";
import type { AuctionService } from "../modules/auction/application/auction-service.ts";
import { AuctionDeniedError } from "../modules/auction/domain/auction-denied-error.ts";
import { LISTING_KIND_LOT } from "../modules/auction/domain/listing-kind.ts";
import {
  LISTING_STATUS_OPEN,
  LISTING_STATUS_SOLD,
} from "../modules/auction/domain/listing-status.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import { deliverAuctionMail } from "./auction-mail.ts";
import type { AuctionExpiry } from "./auction-expiry.ts";

export class AuctionBuyout {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly expiry: Pick<AuctionExpiry, "sweepUnlocked">,
    private readonly characters: Pick<CharacterService, "lockById" | "getById" | "debitMoney">,
    private readonly mail: Pick<MailService, "deliverSystemInbox">,
    private readonly auction: Pick<AuctionService, "lock" | "save" | "now">,
  ) {}

  async buy(heroId: number, lotId: number): Promise<void> {
    if (!Number.isInteger(lotId) || lotId < 1) throw new AuctionDeniedError("лот не найден");
    try {
      await this.unitOfWork.run(async () => {
        await this.expiry.sweepUnlocked();
        const row = await this.auction.lock(lotId);
        const now = this.auction.now();
        if (
          !row ||
          row.kind !== LISTING_KIND_LOT ||
          row.status !== LISTING_STATUS_OPEN ||
          row.expiresAt.getTime() <= now.getTime()
        ) {
          throw new AuctionDeniedError("лот уже куплен");
        }
        if (row.ownerHeroId === heroId) throw new AuctionDeniedError("свой лот");
        if (row.buyoutMinor <= 0) throw new AuctionDeniedError("у лота нет выкупа");
        const buyer = await this.characters.lockById(heroId);
        await this.characters.debitMoney({
          characterId: buyer.id,
          minorUnits: row.buyoutMinor,
          allowGhost: true,
        });
        await this.auction.save({
          ...row,
          status: LISTING_STATUS_SOLD,
          bidderHeroId: null,
          currentBidMinor: 0,
        });
        const seller = await this.characters.getById(row.ownerHeroId);
        if (!seller) throw new Error(`Hero ${row.ownerHeroId} is missing for auction buyout`);
        await deliverAuctionMail(this.mail, this.characters, {
          toHeroId: buyer.id,
          fromHeroId: row.ownerHeroId,
          fromNick: seller.nick,
          subject: "Аукцион: покупка",
          text: `Вы выкупили ${row.title}, ${row.amount} шт на аукционе. Товар доставлен вам на почту.`,
          moneyComeMinor: 0,
          listing: row,
          withItem: true,
        });
        await deliverAuctionMail(this.mail, this.characters, {
          toHeroId: row.ownerHeroId,
          fromHeroId: buyer.id,
          fromNick: buyer.nick,
          subject: "Аукцион: продажа",
          text: `Вы продали ${row.title}, ${row.amount} шт. Деньги доставлены вам на почту.`,
          moneyComeMinor: row.buyoutMinor,
          listing: row,
          withItem: false,
        });
        if (row.bidderHeroId && row.bidderHeroId !== buyer.id) {
          await deliverAuctionMail(this.mail, this.characters, {
            toHeroId: row.bidderHeroId,
            fromHeroId: buyer.id,
            fromNick: buyer.nick,
            subject: "Аукцион: ставка не выиграла",
            text: `Ваша ставка на «${row.title}» не выиграла. Золото возвращено на почту.`,
            moneyComeMinor: row.currentBidMinor,
            listing: row,
            withItem: false,
          });
        }
      });
    } catch (error) {
      if (error instanceof InsufficientMoneyError) {
        throw new AuctionDeniedError("недостаточно денег");
      }
      throw error;
    }
  }
}
