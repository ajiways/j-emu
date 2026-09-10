import { goldToMinor } from "../modules/character/shared/gold-to-minor.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import { AuctionBagTakeError } from "../modules/inventory/domain/auction-bag-take-error.ts";
import type { AuctionService } from "../modules/auction/application/auction-service.ts";
import type { MailService } from "../modules/mail/application/mail-service.ts";
import { AuctionDeniedError } from "../modules/auction/domain/auction-denied-error.ts";
import { LISTING_KIND_TENDER } from "../modules/auction/domain/listing-kind.ts";
import { bagItemMatchesOrder } from "../modules/auction/domain/listing-match.ts";
import {
  LISTING_STATUS_OPEN,
  LISTING_STATUS_SOLD,
} from "../modules/auction/domain/listing-status.ts";
import { moneyRound } from "../modules/auction/domain/listing-tax.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import { listingAttachmentFromSnapshot } from "./auction-attachment-map.ts";
import { deliverAuctionMail } from "./auction-mail.ts";
import type { AuctionExpiry } from "./auction-expiry.ts";

type TenderSellInput = Readonly<{
  heroId: number;
  lotId: number;
  artifactId: number;
  count: number;
}>;

export class AuctionTenderSell {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly expiry: Pick<AuctionExpiry, "sweepUnlocked">,
    private readonly characters: Pick<CharacterService, "lockById" | "getById">,
    private readonly inventory: Pick<InventoryService, "list" | "takeFromBagForAuction">,
    private readonly mail: Pick<MailService, "deliverSystemInbox">,
    private readonly auction: Pick<AuctionService, "lock" | "save" | "now">,
  ) {}

  async sell(command: TenderSellInput): Promise<void> {
    if (!Number.isInteger(command.lotId) || command.lotId < 1) {
      throw new AuctionDeniedError("заказ не найден");
    }
    try {
      await this.unitOfWork.run(async () => {
        await this.expiry.sweepUnlocked();
        const row = await this.auction.lock(command.lotId);
        if (
          !row ||
          row.kind !== LISTING_KIND_TENDER ||
          row.status !== LISTING_STATUS_OPEN ||
          row.expiresAt.getTime() <= this.auction.now().getTime()
        ) {
          throw new AuctionDeniedError("заказ уже закрыт");
        }
        if (row.ownerHeroId === command.heroId) throw new AuctionDeniedError("свой заказ");
        const bag = await this.inventory.list(command.heroId);
        let takeId = command.artifactId;
        let takeQty = Math.floor(command.count);
        if (command.artifactId > 0) {
          const inst = bag.find((item) => item.id === command.artifactId);
          if (!inst) throw new AuctionDeniedError("предмет не найден в рюкзаке");
          if (!bagItemMatchesOrder(inst, row)) {
            throw new AuctionDeniedError("предмет не подходит под заказ");
          }
          takeQty = 1;
        } else {
          const match = bag.find((item) => bagItemMatchesOrder(item, row));
          if (!match) throw new AuctionDeniedError("нет подходящего предмета");
          takeId = match.id;
          if (!Number.isInteger(takeQty) || takeQty < 1) takeQty = 1;
          takeQty = Math.min(takeQty, match.quantity, row.amount);
        }
        if (row.wholeStackOnly === 1 && takeQty < row.amount) {
          throw new AuctionDeniedError("нужно закрыть заказ целиком");
        }
        if (takeQty < 1) throw new AuctionDeniedError("нечего продавать");
        const snapshot = await this.inventory.takeFromBagForAuction({
          characterId: command.heroId,
          itemId: takeId,
          quantity: takeQty,
        });
        const unitGold = row.amount > 0 ? row.buyoutMinor / 100 / row.amount : 0;
        const payGold = moneyRound(unitGold * takeQty);
        const remainingQty = row.amount - takeQty;
        const remainingGold = moneyRound(row.buyoutMinor / 100 - payGold);
        if (remainingQty <= 0) {
          await this.auction.save({
            ...row,
            status: LISTING_STATUS_SOLD,
            amount: 0,
            buyoutMinor: 0,
          });
        } else {
          await this.auction.save({
            ...row,
            amount: remainingQty,
            buyoutMinor: goldToMinor(remainingGold),
          });
        }
        const seller = await this.characters.lockById(command.heroId);
        const buyer = await this.characters.getById(row.ownerHeroId);
        if (!buyer) throw new Error(`Hero ${row.ownerHeroId} is missing for tender fill`);
        await deliverAuctionMail(this.mail, this.characters, {
          toHeroId: row.ownerHeroId,
          fromHeroId: seller.id,
          fromNick: seller.nick,
          subject: "Аукцион: покупка",
          text: `По заказу получен ${row.title}, ${takeQty} шт. Товар доставлен вам на почту.`,
          moneyComeMinor: 0,
          listing: row,
          withItem: true,
          item: listingAttachmentFromSnapshot(snapshot),
        });
        await deliverAuctionMail(this.mail, this.characters, {
          toHeroId: seller.id,
          fromHeroId: row.ownerHeroId,
          fromNick: buyer.nick,
          subject: "Заказ: лот выкуплен",
          text: `Вы продали ${row.title}, ${takeQty} шт. Деньги доставлены вам на почту.`,
          moneyComeMinor: goldToMinor(payGold),
          listing: row,
          withItem: false,
        });
      });
    } catch (error) {
      if (error instanceof AuctionBagTakeError) throw new AuctionDeniedError(error.message);
      throw error;
    }
  }
}
