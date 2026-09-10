import { goldToMinor } from "../modules/character/shared/gold-to-minor.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import { InsufficientMoneyError } from "../modules/character/domain/insufficient-money-error.ts";
import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import { isClanThingFlags, isNogiveFlags } from "../modules/inventory/domain/artifact-flags.ts";
import type { AuctionService } from "../modules/auction/application/auction-service.ts";
import { AuctionDeniedError } from "../modules/auction/domain/auction-denied-error.ts";
import {
  LISTING_QUALITY_UNPUBLISHED,
  TENDER_TTL_MS,
} from "../modules/auction/domain/auction-ttl.ts";
import { LISTING_KIND_TENDER } from "../modules/auction/domain/listing-kind.ts";
import { LISTING_STATUS_OPEN } from "../modules/auction/domain/listing-status.ts";
import { ORDER_TAX_GOLD, moneyRound } from "../modules/auction/domain/listing-tax.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import type { AuctionExpiry } from "./auction-expiry.ts";

type TenderAddInput = Readonly<{
  heroId: number;
  artikulId: number;
  amount: number;
  buyoutGold: number;
  wholeStackOnly: 0 | 1;
  requiredDurability: number;
  requiredDurabilityMax: number;
  magicId: number;
  requiredUpgradeId: number;
}>;

export class AuctionTenderAdd {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly expiry: Pick<AuctionExpiry, "sweepUnlocked">,
    private readonly characters: Pick<CharacterService, "lockById" | "debitMoney">,
    private readonly catalog: Catalog,
    private readonly auction: Pick<AuctionService, "insert" | "now">,
  ) {}

  async add(command: TenderAddInput): Promise<void> {
    if (!Number.isInteger(command.artikulId) || command.artikulId < 1) {
      throw new AuctionDeniedError("выберите предмет");
    }
    if (!Number.isInteger(command.amount) || command.amount < 1) {
      throw new AuctionDeniedError("выберите предмет");
    }
    const buyout = moneyRound(command.buyoutGold);
    if (buyout <= 0) throw new AuctionDeniedError("укажите цену заказа");
    try {
      await this.unitOfWork.run(async () => {
        await this.expiry.sweepUnlocked();
        const definition = await this.catalog.artifact(command.artikulId);
        if (!definition) throw new AuctionDeniedError("предмет не найден");
        if (isNogiveFlags(definition.flags) || isClanThingFlags(definition.flags)) {
          throw new AuctionDeniedError("непередаваемый предмет");
        }
        const hero = await this.characters.lockById(command.heroId);
        await this.characters.debitMoney({
          characterId: hero.id,
          minorUnits: goldToMinor(moneyRound(buyout + ORDER_TAX_GOLD)),
          allowGhost: true,
        });
        const now = this.auction.now();
        await this.auction.insert({
          kind: LISTING_KIND_TENDER,
          status: LISTING_STATUS_OPEN,
          ownerHeroId: hero.id,
          ownerKind: hero.kind,
          artikulId: definition.id,
          title: definition.title,
          kindId: definition.kindId,
          quality: LISTING_QUALITY_UNPUBLISHED,
          levelMin: definition.levelMin,
          amount: command.amount,
          startPriceMinor: 0,
          buyoutMinor: goldToMinor(buyout),
          currentBidMinor: goldToMinor(buyout),
          bidderHeroId: null,
          cancelFeeMinor: goldToMinor(ORDER_TAX_GOLD),
          expiresAt: new Date(now.getTime() + TENDER_TTL_MS),
          createdAt: now,
          attachment: {
            originalItemId: 0,
            artifactId: definition.id,
            quantity: 1,
            durability: definition.durability,
            durabilityMax: definition.durabilityMax,
            upgradeId: 0,
            upgradeLevel: 0,
            upgradeSkillId: "",
            upgradeBound: 0,
          },
          wholeStackOnly: command.wholeStackOnly,
          requiredDurability: command.requiredDurability,
          requiredDurabilityMax: command.requiredDurabilityMax,
          magicId: command.magicId,
          requiredUpgradeId: command.requiredUpgradeId,
        });
      });
    } catch (error) {
      if (error instanceof InsufficientMoneyError) {
        throw new AuctionDeniedError("недостаточно денег");
      }
      throw error;
    }
  }
}
