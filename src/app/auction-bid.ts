import { goldToMinor } from "../modules/character/shared/gold-to-minor.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import { InsufficientMoneyError } from "../modules/character/domain/insufficient-money-error.ts";
import type { MailService } from "../modules/mail/application/mail-service.ts";
import type { AuctionService } from "../modules/auction/application/auction-service.ts";
import { AuctionDeniedError } from "../modules/auction/domain/auction-denied-error.ts";
import { LISTING_KIND_LOT } from "../modules/auction/domain/listing-kind.ts";
import { LISTING_STATUS_OPEN } from "../modules/auction/domain/listing-status.ts";
import { moneyRound } from "../modules/auction/domain/listing-tax.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import { deliverAuctionMail } from "./auction-mail.ts";
import type { AuctionExpiry } from "./auction-expiry.ts";

export type AuctionBidCommand = Readonly<{
  heroId: number;
  lotId: number;
  bidGold: number;
}>;

export class AuctionBid {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly expiry: Pick<AuctionExpiry, "sweepUnlocked">,
    private readonly characters: Pick<CharacterService, "lockById" | "getById" | "debitMoney">,
    private readonly mail: Pick<MailService, "deliverSystemInbox">,
    private readonly auction: Pick<AuctionService, "lock" | "save" | "now">,
  ) {}

  async place(command: AuctionBidCommand): Promise<Readonly<{ lotId: number; bidGold: number }>> {
    const bid = moneyRound(command.bidGold);
    if (!Number.isInteger(command.lotId) || command.lotId < 1 || bid <= 0) {
      throw new AuctionDeniedError("ставка слишком мала");
    }
    try {
      return await this.unitOfWork.run(async () => {
        await this.expiry.sweepUnlocked();
        const row = await this.auction.lock(command.lotId);
        const now = this.auction.now();
        if (
          !row ||
          row.kind !== LISTING_KIND_LOT ||
          row.status !== LISTING_STATUS_OPEN ||
          row.expiresAt.getTime() <= now.getTime()
        ) {
          throw new AuctionDeniedError("лот не найден");
        }
        if (row.ownerHeroId === command.heroId) throw new AuctionDeniedError("свой лот");
        if (row.bidderHeroId === command.heroId)
          throw new AuctionDeniedError("у вас уже есть ставка");
        const currentGold = row.currentBidMinor / 100;
        if (row.bidderHeroId) {
          if (!(bid > currentGold)) throw new AuctionDeniedError("ставка слишком мала");
        } else if (bid + 1e-9 < row.startPriceMinor / 100) {
          throw new AuctionDeniedError("ставка слишком мала");
        }
        const hero = await this.characters.lockById(command.heroId);
        await this.characters.debitMoney({
          characterId: hero.id,
          minorUnits: goldToMinor(bid),
          allowGhost: true,
        });
        const previous = row;
        await this.auction.save({
          ...row,
          currentBidMinor: goldToMinor(bid),
          bidderHeroId: hero.id,
        });
        if (previous.bidderHeroId) {
          await deliverAuctionMail(this.mail, this.characters, {
            toHeroId: previous.bidderHeroId,
            fromHeroId: hero.id,
            fromNick: hero.nick,
            subject: "Аукцион: ставка не выиграла",
            text: `Ваша ставка на «${previous.title}» не выиграла. Золото возвращено на почту.`,
            moneyComeMinor: previous.currentBidMinor,
            listing: previous,
            withItem: false,
          });
        }
        return { lotId: command.lotId, bidGold: bid };
      });
    } catch (error) {
      if (error instanceof InsufficientMoneyError) {
        throw new AuctionDeniedError("недостаточно денег");
      }
      throw error;
    }
  }
}
