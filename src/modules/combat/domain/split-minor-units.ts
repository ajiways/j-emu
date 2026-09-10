export function splitMinorUnits(total: number, parts: number): readonly number[] {
  if (!Number.isInteger(total) || total < 0) throw new Error("Money split total is invalid");
  if (!Number.isInteger(parts) || parts < 1) throw new Error("Money split parts is invalid");
  const base = Math.floor(total / parts);
  let remainder = total - base * parts;
  const shares: number[] = [];
  for (let index = 0; index < parts; index += 1) {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    shares.push(base + extra);
  }
  return shares;
}
