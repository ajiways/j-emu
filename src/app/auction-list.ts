import { goldToMinor } from "../modules/character/shared/gold-to-minor.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import { InsufficientMoneyError } from "../modules/character/domain/insufficient-money-error.ts";
import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import { AuctionBagTakeError } from "../modules/inventory/domain/auction-bag-take-error.ts";
import type { AuctionService } from "../modules/auction/application/auction-service.ts";
import { AuctionDeniedError } from "../modules/auction/domain/auction-denied-error.ts";
import { LISTING_KIND_LOT } from "../modules/auction/domain/listing-kind.ts";
import { LISTING_STATUS_OPEN } from "../modules/auction/domain/listing-status.ts";
import { LISTING_QUALITY_UNPUBLISHED } from "../modules/auction/domain/auction-ttl.ts";
import {
  durationHours,
  listingTaxGold,
  minBuyoutGold,
  MIN_START_BID_GOLD,
  moneyRound,
} from "../modules/auction/domain/listing-tax.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import { listingAttachmentFromSnapshot } from "./auction-attachment-map.ts";
import type { AuctionExpiry } from "./auction-expiry.ts";

export type AuctionListCommand = Readonly<{
  heroId: number;
  itemId: number;
  amount: number;
  startPriceGold: number;
  buyoutGold: number;
  duration: unknown;
}>;

export class AuctionList {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly expiry: Pick<AuctionExpiry, "sweepUnlocked">,
    private readonly characters: Pick<CharacterService, "lockById" | "debitMoney">,
    private readonly inventory: Pick<InventoryService, "takeFromBagForAuction">,
    private readonly catalog: Catalog,
    private readonly auction: Pick<AuctionService, "insert" | "now">,
  ) {}

  async add(command: AuctionListCommand): Promise<void> {
    if (!Number.isInteger(command.itemId) || command.itemId < 1) {
      throw new AuctionDeniedError("предмет не найден");
    }
    if (!Number.isInteger(command.amount) || command.amount < 1) {
      throw new AuctionDeniedError("предмет не найден");
    }
    const start = moneyRound(command.startPriceGold);
    const buyout = moneyRound(command.buyoutGold);
    if (start + 1e-9 < MIN_START_BID_GOLD) {
      throw new AuctionDeniedError("Минимальная ставка должна быть не менее 0.21 золотого.");
    }
    if (buyout > 0 && buyout <= minBuyoutGold(start)) {
      throw new AuctionDeniedError("цена выкупа слишком низкая");
    }
    const hours = durationHours(command.duration);
    try {
      await this.unitOfWork.run(async () => {
        await this.expiry.sweepUnlocked();
        const hero = await this.characters.lockById(command.heroId);
        const snapshot = await this.inventory.takeFromBagForAuction({
          characterId: hero.id,
          itemId: command.itemId,
          quantity: command.amount,
        });
        const definition = await this.catalog.artifact(snapshot.artifactId);
        if (!definition) {
          throw new Error(`Artifact catalog entry ${snapshot.artifactId} is missing`);
        }
        const taxGold = listingTaxGold(definition.priceMinor / 100, command.amount, hours);
        await this.characters.debitMoney({
          characterId: hero.id,
          minorUnits: goldToMinor(taxGold),
          allowGhost: true,
        });
        const now = this.auction.now();
        await this.auction.insert({
          kind: LISTING_KIND_LOT,
          status: LISTING_STATUS_OPEN,
          ownerHeroId: hero.id,
          ownerKind: hero.kind,
          artikulId: snapshot.artifactId,
          title: definition.title,
          kindId: definition.kindId,
          quality: LISTING_QUALITY_UNPUBLISHED,
          levelMin: definition.levelMin,
          amount: command.amount,
          startPriceMinor: goldToMinor(start),
          buyoutMinor: goldToMinor(buyout),
          currentBidMinor: goldToMinor(start),
          bidderHeroId: null,
          cancelFeeMinor: goldToMinor(taxGold),
          expiresAt: new Date(now.getTime() + hours * 3600 * 1000),
          createdAt: now,
          attachment: listingAttachmentFromSnapshot(snapshot),
          wholeStackOnly: 0,
          requiredDurability: 0,
          requiredDurabilityMax: 0,
          magicId: 0,
          requiredUpgradeId: 0,
        });
      });
    } catch (error) {
      if (error instanceof InsufficientMoneyError) {
        throw new AuctionDeniedError("У вас не хватает денег, чтобы оплатить налог.");
      }
      if (error instanceof AuctionBagTakeError) throw new AuctionDeniedError(error.message);
      throw error;
    }
  }
}
