import type { ArtifactDefinition } from "../../catalog/domain/artifact-definition.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../character/application/character-service.ts";
import { InventoryItem } from "../../inventory/domain/inventory-item.ts";
import type { Listing } from "../../auction/domain/listing.ts";
import type { ListingAttachment } from "../../auction/domain/listing-attachment.ts";
import { LISTING_KIND_LOT, LISTING_KIND_TENDER } from "../../auction/domain/listing-kind.ts";
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
  const lotHasBid = row.kind === LISTING_KIND_LOT && row.bidderHeroId !== null;
  const cancel =
    row.ownerHeroId === viewerId && !lotHasBid ? moneyNumberFromMinorUnits(row.cancelFeeMinor) : 0;
  const definition = await catalog.artifact(row.artikulId);
  if (!definition) throw new Error(`Artifact catalog entry ${row.artikulId} is missing`);
  const artifact =
    row.kind === LISTING_KIND_TENDER
      ? catalogStaticArtifact(definition, row.quality)
      : {
          ...(await buildBagItemBlock(
            definition,
            itemFromAttachment(row.ownerHeroId, row.attachment),
            catalog,
          )),
          cnt: row.amount,
        };
  const out: Record<string, unknown> = {
    id: row.id,
    artifact,
    amount: row.amount,
    rtime,
    rtime_num,
    bid: moneyNumberFromMinorUnits(
      row.kind === LISTING_KIND_TENDER ? row.buyoutMinor : row.currentBidMinor,
    ),
    buyout: moneyNumberFromMinorUnits(row.buyoutMinor),
    cancel,
    flags: lotFlags(row.ownerHeroId, row.bidderHeroId, viewerId, row.wholeStackOnly),
    user_id: String(row.ownerHeroId),
    user_nick: token.token,
    bid_user_id: String(row.bidderHeroId ?? 0),
    overbid: 0,
    overbid_user: "",
    price_type: PRICE_TYPE_GOLD,
    macroses: [token.macro],
  };
  if (row.kind === LISTING_KIND_TENDER) {
    out.required_durability = String(row.requiredDurability);
    out.required_durability_max = String(row.requiredDurabilityMax);
    out.required_upgrade_id = String(row.requiredUpgradeId);
    out.magic_id = String(row.magicId);
  }
  return out;
}

function catalogStaticArtifact(definition: ArtifactDefinition, quality: number): object {
  return {
    id: definition.id,
    title: definition.title,
    picture: definition.picture,
    type_id: definition.typeId,
    kind_id: definition.kindId,
    quality,
    level_min: definition.levelMin,
    price: moneyNumberFromMinorUnits(definition.priceMinor),
    flags: definition.flags,
    durability: definition.durability,
    durability_max: definition.durabilityMax,
    cnt: 1,
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
