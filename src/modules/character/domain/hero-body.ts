const HEAD_RE = /head\([^)]*\)/i;
const SKIN_RE = /skin\([^)]*\)/i;

export function extractHeadSkin(body: string): { head: string; skin: string } {
  if (!body) throw new Error("Hero body is required");
  const head = body.match(HEAD_RE)?.[0];
  const skin = body.match(SKIN_RE)?.[0];
  if (!head) throw new Error("Hero body is missing head()");
  if (!skin) throw new Error("Hero body is missing skin()");
  return { head, skin };
}

export function parseFBodyTokens(fBody: string): string[] {
  if (typeof fBody !== "string") throw new Error("Artifact fBody is required");
  return fBody
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function tokenSlot(token: string): number {
  const index = token.lastIndexOf("#");
  if (index < 0) return 0;
  const slot = Number(token.slice(index + 1));
  if (!Number.isInteger(slot)) throw new Error(`f_body token slot is invalid: ${token}`);
  return slot;
}

export function composeHeroBody(currentBody: string, armorTokens: readonly string[]): string {
  const { head, skin } = extractHeadSkin(currentBody);
  const sorted = [...armorTokens].sort((left, right) => tokenSlot(left) - tokenSlot(right));
  const armor = sorted.length > 0 ? `armor(${sorted.join(",")})` : "armor()";
  return `${armor};${head};${skin}`;
}
