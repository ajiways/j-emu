import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import { goldFromMinorUnits, moneyRound, trayTax } from "../modules/trade/domain/trade-tax.ts";
import type { TradeTray } from "../modules/trade/domain/trade-session.ts";

export async function trayCost(
  tray: TradeTray,
  catalog: Catalog,
): Promise<{ tax: number; need: number }> {
  const arts: Array<{ priceGold: number; quantity: number }> = [];
  for (const snap of tray.artifacts.values()) {
    const definition = await catalog.artifact(snap.artifactId);
    if (!definition) throw new Error(`Artifact catalog entry ${snap.artifactId} is missing`);
    arts.push({
      priceGold: goldFromMinorUnits(definition.priceMinor),
      quantity: snap.quantity,
    });
  }
  const tax = moneyRound(trayTax(tray.moneyGold, arts));
  return { tax, need: moneyRound(tray.moneyGold + tax) };
}
