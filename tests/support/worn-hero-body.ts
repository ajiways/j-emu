import fs from "node:fs";
import path from "node:path";
import { composeHeroBody, parseFBodyTokens } from "../../src/modules/character/domain/hero-body.ts";

export const NAKED_HERO_BODY = "armor();head(0,0,8,152);skin()";

export function wornHeroBodyFromGenerated(artikulId: number): string {
  const artifacts = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "content/pub1-items.generated.json"), "utf8"),
  ) as Array<{ id: number; fBody?: unknown }>;
  const artifact = artifacts.find((row) => row.id === artikulId);
  if (!artifact) throw new Error(`generated artifact ${artikulId} is missing`);
  if (typeof artifact.fBody !== "string" || artifact.fBody === "") {
    throw new Error(`generated artifact ${artikulId} fBody overlay is required`);
  }
  return composeHeroBody(NAKED_HERO_BODY, parseFBodyTokens(artifact.fBody));
}
