import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../character/application/character-service.ts";
import { InventoryItem } from "../../inventory/domain/inventory-item.ts";
import type { Listing } from "../../auction/domain/listing.ts";
import type { ListingAttachment } from "../../auction/domain/listing-attachment.ts";
import { lotFlags } from "../../auction/domain/listing-flags.ts";
import { formatRtime, remainingSec } from "../../auction/domain/listing-rtime.ts";
import { PRICE_TYPE_GOLD } from "../../auction/domain/listing-tax.ts";
import { buildBagItemBlock } from "./bag-item-block.ts";
import { moneyNumberFromMinorUnits } from "./money-from-minor-units.ts";
import { buildUserMacro, type UserMacroSource } from "./user-macro.ts";

type AuctionOwner = UserMacroSource;

export async function loadAuctionOwners(
  rows: readonly Listing[],
  characters: Pick<CharacterService, "getById">,
): Promise<ReadonlyMap<number, AuctionOwner>> {
  const ids = [...new Set(rows.map((row) => row.ownerHeroId))];
  const owners = new Map<number, AuctionOwner>();
  for (const id of ids) {
    const hero = await characters.getById(id);
    if (!hero) throw new Error(`Auction owner hero ${id} is missing`);
    owners.set(id, { nick: hero.nick, level: hero.level, kind: hero.kind });
  }
  return owners;
}

export async function buildLotListBlock(
  rows: readonly Listing[],
  viewerId: number,
  owners: ReadonlyMap<number, AuctionOwner>,
  catalog: Catalog,
  now: Date,
  paging: Readonly<{ total: number; offs: number }> | null,
): Promise<object> {
  const list = [];
  for (const row of rows) {
    const owner = owners.get(row.ownerHeroId);
    if (!owner) throw new Error(`Auction owner hero ${row.ownerHeroId} was not loaded`);
    list.push(await listingToWire(row, viewerId, owner, catalog, now));
  }
  if (paging) {
    return { status: 100, list, total: paging.total, offs: paging.offs };
  }
  return { status: 100, list };
}

async function listingToWire(
  row: Listing,
  viewerId: number,
  owner: AuctionOwner,
  catalog: Catalog,
  now: Date,
): Promise<object> {
  const { rtime, rtime_num } = formatRtime(remainingSec(row.expiresAt, now));
  const token = buildUserMacro(owner);
  const lotHasBid = row.bidderHeroId !== null;
  const cancel =
    row.ownerHeroId === viewerId && !lotHasBid ? moneyNumberFromMinorUnits(row.cancelFeeMinor) : 0;
  const definition = await catalog.artifact(row.artikulId);
  if (!definition) throw new Error(`Artifact catalog entry ${row.artikulId} is missing`);
  const item = itemFromAttachment(row.ownerHeroId, row.attachment);
  const artifact = await buildBagItemBlock(definition, item, catalog);
  return {
    id: row.id,
    artifact: { ...artifact, cnt: row.amount },
    amount: row.amount,
    rtime,
    rtime_num,
    bid: moneyNumberFromMinorUnits(row.currentBidMinor),
    buyout: moneyNumberFromMinorUnits(row.buyoutMinor),
    cancel,
    flags: lotFlags(row.ownerHeroId, row.bidderHeroId, viewerId),
    user_id: String(row.ownerHeroId),
    user_nick: token.token,
    bid_user_id: String(row.bidderHeroId ?? 0),
    overbid: 0,
    overbid_user: "",
    price_type: PRICE_TYPE_GOLD,
    macroses: [token.macro],
  };
}

function itemFromAttachment(ownerHeroId: number, attachment: ListingAttachment): InventoryItem {
  return new InventoryItem(
    attachment.originalItemId,
    ownerHeroId,
    attachment.artifactId,
    attachment.quantity,
    { kind: "bag" },
    attachment.durability,
    attachment.durabilityMax,
    {
      id: attachment.upgradeId,
      level: attachment.upgradeLevel,
      skillId: attachment.upgradeSkillId,
      bound: attachment.upgradeBound === 1,
    },
    0,
  );
}
