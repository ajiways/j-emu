import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { Hero } from "../../character/domain/hero.ts";
import type { InventoryService } from "../../inventory/domain/inventory-service.ts";
import { InventoryItem } from "../../inventory/domain/inventory-item.ts";
import type {
  TradeItemSnapshot,
  TradeSession,
  TradeTray,
} from "../../trade/domain/trade-session.ts";
import { goldFromMinorUnits, trayTax } from "../../trade/domain/trade-tax.ts";
import { buildBagItemBlock, type BagItemBlock } from "./bag-item-block.ts";
import { buildUserBag } from "./user-bag-block.ts";

export type ClosedTradeSessionBlock = Readonly<{ status: 100 }>;

type TradeTrayItemsBlock =
  | readonly []
  | Readonly<{
      artifacts?: Readonly<Record<string, BagItemBlock>>;
      money?: number;
    }>;

type TradeTrayBlock = Readonly<{
  id: number;
  nick: string;
  confirmed: 0 | 1 | 2;
  tax: number;
  items: TradeTrayItemsBlock;
}>;

export type TradeSessionBlock = Readonly<{
  status: 100;
  confirm_key: string;
  my_tray: TradeTrayBlock;
  opponent_tray: TradeTrayBlock | readonly [];
  bag: Readonly<Record<string, BagItemBlock>>;
  money: number;
}>;

export function closedTradeSession(): ClosedTradeSessionBlock {
  return { status: 100 };
}

export async function buildTradeSessionBlock(
  hero: Hero,
  session: TradeSession,
  inventory: InventoryService,
  catalog: Catalog,
): Promise<TradeSessionBlock | ClosedTradeSessionBlock> {
  const mine = session.trays.get(hero.id);
  if (!mine) return closedTradeSession();
  const opponent = session.inviteeHeroId === null ? null : peerTrayOf(session, hero.id);
  const bag = await buildUserBag(hero, inventory, catalog);
  return {
    status: 100,
    confirm_key: session.confirmKey,
    my_tray: await trayBlock(mine, catalog),
    opponent_tray: opponent ? await trayBlock(opponent, catalog) : [],
    bag: bag.bag,
    money: goldFromMinorUnits(hero.moneyMinor),
  };
}

function peerTrayOf(session: TradeSession, heroId: number): TradeTray | null {
  const otherId =
    session.initiatorHeroId === heroId ? session.inviteeHeroId : session.initiatorHeroId;
  if (otherId === null) return null;
  const tray = session.trays.get(otherId);
  return tray === undefined ? null : tray;
}

async function trayBlock(tray: TradeTray, catalog: Catalog): Promise<TradeTrayBlock> {
  const arts = [...tray.artifacts.values()];
  const priced: Array<{ priceGold: number; quantity: number }> = [];
  for (const snap of arts) {
    const definition = await catalog.artifact(snap.artifactId);
    if (!definition) throw new Error(`Artifact catalog entry ${snap.artifactId} is missing`);
    priced.push({
      priceGold: goldFromMinorUnits(definition.priceMinor),
      quantity: snap.quantity,
    });
  }
  return {
    id: tray.id,
    nick: tray.nick,
    confirmed: tray.confirmed,
    tax: trayTax(tray.moneyGold, priced),
    items: await trayItems(tray, catalog),
  };
}

async function trayItems(tray: TradeTray, catalog: Catalog): Promise<TradeTrayItemsBlock> {
  const hasArts = tray.artifacts.size > 0;
  const hasMoney = tray.moneyGold > 0;
  if (!hasArts && !hasMoney) return [];
  const items: { artifacts?: Record<string, BagItemBlock>; money?: number } = {};
  if (hasArts) {
    const artifacts: Record<string, BagItemBlock> = {};
    for (const [id, snap] of tray.artifacts) {
      artifacts[String(id)] = await artifactBlock(tray.heroId, snap, catalog);
    }
    items.artifacts = artifacts;
  }
  if (hasMoney) items.money = tray.moneyGold;
  return items;
}

async function artifactBlock(
  heroId: number,
  snap: TradeItemSnapshot,
  catalog: Catalog,
): Promise<BagItemBlock> {
  const definition = await catalog.artifact(snap.artifactId);
  if (!definition) throw new Error(`Artifact catalog entry ${snap.artifactId} is missing`);
  const item = new InventoryItem(
    snap.originalItemId,
    heroId,
    snap.artifactId,
    snap.quantity,
    { kind: "bag" },
    snap.durability,
    snap.durabilityMax,
    snap.upgrade,
    0,
    snap.data,
  );
  return buildBagItemBlock(definition, item, catalog);
}
