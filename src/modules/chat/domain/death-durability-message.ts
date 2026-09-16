import type { ArtifactItemMacroToken } from "./artifact-item-macro.ts";

export function deathDurabilityMessage(
  tokens: readonly ArtifactItemMacroToken[],
): Readonly<{ msg: string; macroses: Readonly<Record<string, unknown>> }> {
  if (tokens.length === 0) {
    throw new Error("Death durability chat requires at least one item");
  }
  const macroses: Record<string, unknown> = {};
  for (const token of tokens) macroses[token.key] = token.macro;
  return {
    msg: `Вещи потеряли прочность: ${tokens.map((row) => `${row.token} (-1)`).join(", ")}.`,
    macroses,
  };
}
