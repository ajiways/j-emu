import { and, asc, desc, eq, gt, gte, ilike, inArray, lte, sql, type SQL } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import { requireItemInstanceData } from "../../inventory/domain/item-instance-data.ts";
import type { ListingAttachment } from "../domain/listing-attachment.ts";
import { LISTING_KIND_LOT, LISTING_KIND_TENDER, type ListingKind } from "../domain/listing-kind.ts";
import type { ListingSearch } from "../domain/listing-search.ts";
import { LISTING_STATUS_OPEN, type ListingStatus } from "../domain/listing-status.ts";
import { LOT_PAGE_SIZE, TENDER_AVAILABLE_SCAN_LIMIT } from "../domain/auction-ttl.ts";
import type { Listing, NewListing } from "../domain/listing.ts";
import type { ListingRepository, LotSearchPage } from "../ports/listing-repository.ts";
import { listings } from "./schema.ts";

export class PostgresListingRepository implements ListingRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async insert(row: NewListing): Promise<Listing> {
    const inserted = await this.database.session().insert(listings).values(toRow(row)).returning();
    const created = inserted[0];
    if (inserted.length !== 1 || !created) throw new Error("Auction insert did not return an id");
    return toListing(created);
  }

  async lock(id: number): Promise<Listing | null> {
    requireWireIdentity(id, "lot id");
    const rows = await this.database
      .session()
      .select()
      .from(listings)
      .where(eq(listings.id, id))
      .for("update")
      .limit(1);
    const row = rows[0];
    return row ? toListing(row) : null;
  }

  async lockExpired(now: Date): Promise<readonly Listing[]> {
    const rows = await this.database
      .session()
      .select()
      .from(listings)
      .where(and(eq(listings.status, LISTING_STATUS_OPEN), lte(listings.expiresAt, now)))
      .for("update");
    return rows.map(toListing);
  }

  async save(listing: Listing): Promise<void> {
    const updated = await this.database
      .session()
      .update(listings)
      .set({
        status: listing.status,
        amount: listing.amount,
        startPriceMinor: BigInt(listing.startPriceMinor),
        buyoutMinor: BigInt(listing.buyoutMinor),
        currentBidMinor: BigInt(listing.currentBidMinor),
        bidderHeroId: listing.bidderHeroId,
        cancelFeeMinor: BigInt(listing.cancelFeeMinor),
      })
      .where(eq(listings.id, listing.id))
      .returning({ id: listings.id });
    if (updated.length !== 1) throw new Error(`Listing ${listing.id} update missed the row`);
  }

  async searchLots(search: ListingSearch, now: Date): Promise<LotSearchPage> {
    return this.searchKind(LISTING_KIND_LOT, search, now, false);
  }

  async searchTenders(search: ListingSearch, now: Date, unpaged: boolean): Promise<LotSearchPage> {
    return this.searchKind(LISTING_KIND_TENDER, search, now, unpaged);
  }

  private async searchKind(
    kind: ListingKind,
    search: ListingSearch,
    now: Date,
    unpaged: boolean,
  ): Promise<LotSearchPage> {
    const where = and(...filterSql(kind, search, now));
    const counted = await this.database
      .session()
      .select({ c: sql<number>`count(*)::int` })
      .from(listings)
      .where(where);
    const total = counted[0]?.c;
    if (total === undefined || !Number.isInteger(total) || total < 0) {
      throw new Error("Auction listing count is invalid");
    }
    const offset = unpaged ? 0 : search.offset;
    const rows = await this.database
      .session()
      .select()
      .from(listings)
      .where(where)
      .orderBy(orderExpr(search), asc(listings.id))
      .limit(unpaged ? TENDER_AVAILABLE_SCAN_LIMIT : LOT_PAGE_SIZE)
      .offset(offset);
    return { rows: rows.map(toListing), total, offset };
  }

  async listMine(kind: ListingKind, ownerHeroId: number, now: Date): Promise<readonly Listing[]> {
    requireWireIdentity(ownerHeroId, "hero id");
    const rows = await this.database
      .session()
      .select()
      .from(listings)
      .where(
        and(
          eq(listings.kind, kind),
          eq(listings.ownerHeroId, ownerHeroId),
          eq(listings.status, LISTING_STATUS_OPEN),
          gt(listings.expiresAt, now),
        ),
      )
      .orderBy(asc(listings.expiresAt));
    return rows.map(toListing);
  }

  async listMyBids(bidderHeroId: number, now: Date): Promise<readonly Listing[]> {
    requireWireIdentity(bidderHeroId, "hero id");
    const rows = await this.database
      .session()
      .select()
      .from(listings)
      .where(
        and(
          eq(listings.kind, LISTING_KIND_LOT),
          eq(listings.bidderHeroId, bidderHeroId),
          eq(listings.status, LISTING_STATUS_OPEN),
          gt(listings.expiresAt, now),
        ),
      )
      .orderBy(asc(listings.expiresAt));
    return rows.map(toListing);
  }

  async minListedUnitGold(artikulId: number, now: Date): Promise<number | null> {
    requireWireIdentity(artikulId, "artikul id");
    const rows = await this.database
      .session()
      .select()
      .from(listings)
      .where(
        and(
          eq(listings.kind, LISTING_KIND_LOT),
          eq(listings.status, LISTING_STATUS_OPEN),
          eq(listings.artikulId, artikulId),
          gt(listings.expiresAt, now),
        ),
      );
    let minUnit = Number.POSITIVE_INFINITY;
    for (const row of rows.map(toListing)) {
      if (row.amount < 1) throw new Error(`Listing ${row.id} amount is invalid`);
      const listed = row.buyoutMinor > 0 ? row.buyoutMinor : row.currentBidMinor;
      if (listed <= 0) continue;
      const unit = listed / 100 / row.amount;
      if (unit < minUnit) minUnit = unit;
    }
    return Number.isFinite(minUnit) ? minUnit : null;
  }
}

function filterSql(kind: ListingKind, search: ListingSearch, now: Date): SQL[] {
  const parts: SQL[] = [
    eq(listings.kind, kind),
    eq(listings.status, LISTING_STATUS_OPEN),
    gt(listings.expiresAt, now),
  ];
  if (search.title) parts.push(ilike(listings.title, `%${search.title}%`));
  if (search.levelMin > 0) parts.push(gte(listings.levelMin, search.levelMin));
  if (search.levelMax > 0) parts.push(lte(listings.levelMin, search.levelMax));
  if (search.countMin > 0) parts.push(gte(listings.amount, search.countMin));
  if (search.countMax > 0) parts.push(lte(listings.amount, search.countMax));
  if (search.kindIds.length > 0) parts.push(inArray(listings.kindId, [...search.kindIds]));
  if (search.quality >= 0) parts.push(eq(listings.quality, search.quality));
  if (search.ownerKinds.length > 0) parts.push(inArray(listings.ownerKind, [...search.ownerKinds]));
  return parts;
}

function orderExpr(search: ListingSearch) {
  const dir = search.reverse ? desc : asc;
  switch (search.order) {
    case "title":
      return dir(listings.title);
    case "bid":
      return dir(listings.currentBidMinor);
    case "buyout":
      return dir(listings.buyoutMinor);
    case "time":
      return dir(listings.expiresAt);
  }
}

function toRow(row: NewListing) {
  return {
    kind: row.kind,
    status: row.status,
    ownerHeroId: row.ownerHeroId,
    ownerKind: row.ownerKind,
    artikulId: row.artikulId,
    title: row.title,
    kindId: row.kindId,
    quality: row.quality,
    levelMin: row.levelMin,
    amount: row.amount,
    startPriceMinor: BigInt(row.startPriceMinor),
    buyoutMinor: BigInt(row.buyoutMinor),
    currentBidMinor: BigInt(row.currentBidMinor),
    bidderHeroId: row.bidderHeroId,
    cancelFeeMinor: BigInt(row.cancelFeeMinor),
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    originalItemId: row.attachment.originalItemId,
    durability: row.attachment.durability,
    durabilityMax: row.attachment.durabilityMax,
    upgradeId: row.attachment.upgradeId,
    upgradeLevel: row.attachment.upgradeLevel,
    upgradeSkillId: row.attachment.upgradeSkillId,
    upgradeBound: row.attachment.upgradeBound,
    dataJson: row.attachment.data,
    wholeStackOnly: row.wholeStackOnly,
    requiredDurability: row.requiredDurability,
    requiredDurabilityMax: row.requiredDurabilityMax,
    magicId: row.magicId,
    requiredUpgradeId: row.requiredUpgradeId,
  };
}

function toListing(row: typeof listings.$inferSelect): Listing {
  if (row.kind !== LISTING_KIND_LOT && row.kind !== LISTING_KIND_TENDER) {
    throw new Error(`Listing ${row.id} kind ${row.kind} is invalid`);
  }
  const status = row.status;
  if (status !== "open" && status !== "sold" && status !== "cancelled" && status !== "expired") {
    throw new Error(`Listing ${row.id} status ${status} is invalid`);
  }
  const upgradeBound = row.upgradeBound;
  if (upgradeBound !== 0 && upgradeBound !== 1) {
    throw new Error(`Listing ${row.id} upgrade_bound is invalid`);
  }
  const wholeStackOnly = row.wholeStackOnly;
  if (wholeStackOnly !== 0 && wholeStackOnly !== 1) {
    throw new Error(`Listing ${row.id} whole_stack_only is invalid`);
  }
  const originalItemId =
    row.kind === LISTING_KIND_TENDER && row.originalItemId === 0
      ? 0
      : requireWireIdentity(row.originalItemId, "original item id");
  const attachment: ListingAttachment = {
    originalItemId,
    artifactId: requireWireIdentity(row.artikulId, "artikul id"),
    quantity: row.amount < 1 ? 1 : row.amount,
    durability: row.durability,
    durabilityMax: row.durabilityMax,
    upgradeId: row.upgradeId,
    upgradeLevel: row.upgradeLevel,
    upgradeSkillId: row.upgradeSkillId,
    upgradeBound,
    data: requireItemInstanceData(row.dataJson, `listing ${row.id} data_json`),
  };
  return {
    id: requireWireIdentity(row.id, "lot id"),
    kind: row.kind,
    status: status as ListingStatus,
    ownerHeroId: requireWireIdentity(row.ownerHeroId, "owner hero id"),
    ownerKind: row.ownerKind,
    artikulId: attachment.artifactId,
    title: row.title,
    kindId: row.kindId,
    quality: row.quality,
    levelMin: row.levelMin,
    amount: row.amount,
    startPriceMinor: safeInteger(row.startPriceMinor, `listing ${row.id} start`),
    buyoutMinor: safeInteger(row.buyoutMinor, `listing ${row.id} buyout`),
    currentBidMinor: safeInteger(row.currentBidMinor, `listing ${row.id} bid`),
    bidderHeroId:
      row.bidderHeroId === null ? null : requireWireIdentity(row.bidderHeroId, "bidder hero id"),
    cancelFeeMinor: safeInteger(row.cancelFeeMinor, `listing ${row.id} cancel`),
    expiresAt: requireTimestamp(row.expiresAt, `listing ${row.id} expires_at`),
    createdAt: requireTimestamp(row.createdAt, `listing ${row.id} created_at`),
    attachment,
    wholeStackOnly,
    requiredDurability: row.requiredDurability,
    requiredDurabilityMax: row.requiredDurabilityMax,
    magicId: row.magicId,
    requiredUpgradeId: row.requiredUpgradeId,
  };
}

function requireTimestamp(value: Date, label: string): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function safeInteger(value: bigint, label: string): number {
  const converted = Number(value);
  if (!Number.isSafeInteger(converted) || converted < 0) throw new Error(`Unsafe ${label}`);
  return converted;
}
