export function lootRulesLabel(rules: string): string | null {
  if (rules === "2") return "раздает лидер";
  if (rules === "3") return "по жребию";
  return null;
}
