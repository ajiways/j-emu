import { SUM_REPUTATION_OBJECT_ID, SUM_REPUTATION_TITLE } from "./reputation-ids.ts";
import {
  honorProgress,
  honorRankTitle,
  type HonorProgress,
  type HonorRankCatalog,
} from "./honor-progress.ts";
import { storeRequirePredicates, type StoreRequire, type StoreRequires } from "./store-requires.ts";

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
  if (!requires) return null;
  const progress = honorProgress(catalog.ranks, hero.honor, hero.level);
  const preds = storeRequirePredicates(requires);
  if (preds.length === 0) return null;
  const denials = preds.map((pred) => denyPredicate(pred, hero, catalog, progress));
  if ("any" in requires) {
    if (denials.some((deny) => deny === null)) return null;
    const first = denials[0];
    if (!first) throw new Error("Store requires.any produced no deny text");
    return first;
  }
  return denials.find((deny) => deny !== null) ?? null;
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

function denyPredicate(
  pred: StoreRequire,
  hero: StoreRequireHero,
  catalog: StoreRequireCatalog,
  progress: HonorProgress,
): string | null {
  if (pred.type === "LEVEL") {
    return hero.level < pred.min ? "Нельзя купить этот товар." : null;
  }
  if (pred.type === "RANK") {
    if (progress.rank < pred.min) {
      return `Нужно звание «${honorRankTitle(catalog.ranks, pred.min)}».`;
    }
    return null;
  }
  const have =
    pred.objectId === SUM_REPUTATION_OBJECT_ID
      ? [...hero.reputations.values()].reduce((sum, value) => sum + value, 0)
      : hero.reputations.get(pred.objectId);
  const value = have === undefined ? 0 : have;
  if (value < pred.min) {
    const title =
      pred.objectId === SUM_REPUTATION_OBJECT_ID
        ? SUM_REPUTATION_TITLE
        : catalog.reputationTitle(pred.objectId);
    return `Нужно ${pred.min} репутации ${reputationShortTitle(title)}.`;
  }
  return null;
}

function reputationShortTitle(title: string): string {
  if (!title) throw new Error("Reputation track title is required");
  const stripped = title.replace(/^Репутация\s+/i, "").trim();
  if (!stripped) throw new Error(`Reputation track title ${title} has no short form`);
  return stripped;
}
