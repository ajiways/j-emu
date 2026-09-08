export function requireBootstrapBlock(
  blocks: Readonly<Record<string, unknown>>,
  key: string,
): object {
  if (!key) throw new Error("Bootstrap block key is required");
  const value = blocks[key];
  if (!value || typeof value !== "object") throw new Error(`${key} is missing`);
  return value;
}
