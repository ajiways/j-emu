import { honorProgress, honorRankTitle, type HonorRankCatalog } from "./honor-progress.ts";
import type { StoreRequires } from "./store-requires.ts";

export type StoreRequireHero = Readonly<{
  level: number;
  honor: number;
  reputations: ReadonlyMap<number, number>;
}>;

export type StoreRequireCatalog = Readonly<{
  ranks: HonorRankCatalog;
  reputationTitle(objectId: number): string;
}>;

export function storeRequiresDeny(
  requires: StoreRequires | null,
  hero: StoreRequireHero,
  catalog: StoreRequireCatalog,
): string | null {
  if (!requires || requires.all.length === 0) return null;
  const progress = honorProgress(catalog.ranks, hero.honor, hero.level);
  for (const pred of requires.all) {
    if (pred.type === "LEVEL") {
      if (hero.level < pred.min) return "Нельзя купить этот товар.";
      continue;
    }
    if (pred.type === "RANK") {
      if (progress.rank < pred.min) {
        return `Нужно звание «${honorRankTitle(catalog.ranks, pred.min)}».`;
      }
      continue;
    }
    const have = hero.reputations.get(pred.objectId);
    const value = have === undefined ? 0 : have;
    if (value < pred.min) {
      return `Нужно ${pred.min} репутации ${reputationShortTitle(catalog.reputationTitle(pred.objectId))}.`;
    }
  }
  return null;
}

export function storeEntryDeny(
  requires: StoreRequires | null,
  denyError: string,
  hero: StoreRequireHero,
  catalog: StoreRequireCatalog,
): string | null {
  const lotText = storeRequiresDeny(requires, hero, catalog);
  if (!lotText) return null;
  if (lotText !== "Нельзя купить этот товар.") return lotText;
  if (denyError.length > 0) return denyError;
  return "Сюда нельзя войти.";
}

function reputationShortTitle(title: string): string {
  if (!title) throw new Error("Reputation track title is required");
  const stripped = title.replace(/^Репутация\s+/i, "").trim();
  if (!stripped) throw new Error(`Reputation track title ${title} has no short form`);
  return stripped;
}
