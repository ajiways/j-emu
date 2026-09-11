export function encodeWorldFactValues(values: readonly string[]): string {
  return values.join("\n");
}

export function decodeWorldFactValues(raw: string): readonly string[] {
  if (raw === "") return [];
  return raw.split("\n");
}
