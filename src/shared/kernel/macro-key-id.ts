export function macroKeyId(kind: string, id: string | number): string {
  if (!kind) throw new Error("Macro kind is required");
  const source = `${kind}:${id}`;
  let forward = 0;
  for (let index = 0; index < source.length; index += 1) {
    forward = (forward * 31 + source.charCodeAt(index)) >>> 0;
  }
  const a = forward.toString(16).padStart(8, "0");
  let backward = 0;
  for (let index = source.length - 1; index >= 0; index -= 1) {
    backward = (backward * 33 + source.charCodeAt(index)) >>> 0;
  }
  const b = backward.toString(16).padStart(8, "0");
  return `${a}${b}${a}${b}`.slice(0, 32);
}
