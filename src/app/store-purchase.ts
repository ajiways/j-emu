import { findStoreLot } from "../modules/catalog/domain/find-store-lot.ts";
import {
  SUM_REPUTATION_OBJECT_ID,
  SUM_REPUTATION_TITLE,
} from "../modules/catalog/domain/reputation-ids.ts";
import { honorRankCatalogFromConf } from "../modules/catalog/domain/honor-progress.ts";
import { storeRequiresDeny } from "../modules/catalog/domain/eval-store-requires.ts";
import { addStorePay, emptyStorePayTotals } from "../modules/catalog/domain/store-pay.ts";
import {
  storeRequirePredicates,
  type StoreRequires,
} from "../modules/catalog/domain/store-requires.ts";
import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import { goldToMinor } from "../modules/character/shared/gold-to-minor.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import { GhostHeroError } from "../modules/character/domain/ghost-hero-error.ts";
import { InsufficientDiamondsError } from "../modules/character/domain/insufficient-diamonds-error.ts";
import { InsufficientMoneyError } from "../modules/character/domain/insufficient-money-error.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { WorldService } from "../modules/world/domain/world-service.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import { StoreDeniedError } from "./store-denied-error.ts";
import { StoreGateError } from "./store-gate-error.ts";

type StoreCharacters = Pick<
  CharacterService,
  "lockById" | "reputations" | "debitMoney" | "debitMoneyGold"
>;

export type StoreBasketLine = Readonly<{
  key: string;
  count: number;
}>;

export type StorePurchaseCommand = Readonly<{
  characterId: number;
  areaId: string;
  lines: readonly StoreBasketLine[];
}>;

export class StorePurchase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly characters: StoreCharacters,
    private readonly inventory: InventoryService,
    private readonly catalog: Catalog,
    private readonly world: WorldService,
  ) {}

  async buy(command: StorePurchaseCommand): Promise<readonly number[]> {
    const area = await this.world.area(command.areaId);
    if (area.code !== "store") throw new StoreDeniedError("Здесь нельзя торговать");
    if (command.lines.length < 1) throw new StoreDeniedError("пустая корзина");
    const lots = await this.catalog.storeLots(command.areaId);
    const ranks = honorRankCatalogFromConf(await this.catalog.commonConf());
    const hero = await this.characters.lockById(command.characterId);
    if (hero.ghost) throw new GhostHeroError(command.characterId, "storeBuy");
    const reputations = new Map(
      (await this.characters.reputations(command.characterId)).map((row) => [
        row.objectId,
        row.value,
      ]),
    );
    const grants: Array<{ artifactId: number; quantity: number }> = [];
    let totals = emptyStorePayTotals();
    const reputationTitles = new Map<number, string>();
    for (const line of command.lines) {
      const lot = findStoreLot(lots, line.key);
      if (!lot) throw new StoreDeniedError(`неизвестный товар ${line.key}`);
      await this.loadReputationTitles(lot.requires, reputationTitles);
      const deny = storeRequiresDeny(
        lot.requires,
        { level: hero.level, honor: hero.honor, reputations },
        {
          ranks,
          reputationTitle: (objectId) => {
            const title = reputationTitles.get(objectId);
            if (!title) throw new Error(`Reputation track ${objectId} title is missing`);
            return title;
          },
        },
      );
      if (deny) throw new StoreGateError(deny);
      totals = addStorePay(totals, lot.pay, line.count);
      grants.push({ artifactId: lot.artikulId, quantity: line.count });
    }
    await this.payAndGrant(command.characterId, totals, grants);
    return grants.map((grant) => grant.artifactId);
  }

  private async loadReputationTitles(
    requires: StoreRequires | null,
    titles: Map<number, string>,
  ): Promise<void> {
    if (!requires) return;
    for (const pred of storeRequirePredicates(requires)) {
      if (pred.type !== "REPUTATION") continue;
      if (titles.has(pred.objectId)) continue;
      if (pred.objectId === SUM_REPUTATION_OBJECT_ID) {
        titles.set(pred.objectId, SUM_REPUTATION_TITLE);
        continue;
      }
      const track = await this.catalog.reputationTrack(pred.objectId);
      if (!track) throw new Error(`Reputation track ${pred.objectId} is missing`);
      if (!track.title) throw new Error(`Reputation track ${pred.objectId} title is required`);
      titles.set(pred.objectId, track.title);
    }
  }

  private async payAndGrant(
    characterId: number,
    totals: ReturnType<typeof emptyStorePayTotals>,
    grants: ReadonlyArray<{ artifactId: number; quantity: number }>,
  ): Promise<void> {
    try {
      await this.unitOfWork.run(async () => {
        if (totals.gold > 0) {
          await this.characters.debitMoney({
            characterId,
            minorUnits: goldToMinor(totals.gold),
            allowGhost: false,
          });
        }
        if (totals.diamond > 0) {
          await this.characters.debitMoneyGold({
            characterId,
            minorUnits: goldToMinor(totals.diamond),
            allowGhost: false,
          });
        }
        for (const [artikulId, need] of totals.barter) {
          const have = await this.inventory.countBagByArtifact({
            characterId,
            artifactId: artikulId,
          });
          if (have < need) {
            const artifact = await this.catalog.artifact(artikulId);
            if (!artifact) throw new Error(`Barter artifact ${artikulId} is missing`);
            throw new StoreDeniedError(`Недостаточно: ${artifact.title}`);
          }
          await this.inventory.consumeFromBag({
            characterId,
            artifactId: artikulId,
            quantity: need,
          });
        }
        for (const grant of grants) {
          await this.inventory.grantToBag({
            characterId,
            artifactId: grant.artifactId,
            quantity: grant.quantity,
          });
        }
      });
    } catch (error) {
      if (error instanceof InsufficientMoneyError) {
        throw new StoreDeniedError("Недостаточно денег");
      }
      if (error instanceof InsufficientDiamondsError) {
        throw new StoreDeniedError("Недостаточно алмазов");
      }
      throw error;
    }
  }
}
