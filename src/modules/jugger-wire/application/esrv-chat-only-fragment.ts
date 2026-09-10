export function isChatOnlyFragment(fragment: object): boolean {
  const keys = Object.keys(fragment);
  return keys.length === 1 && keys[0] === "chat|message";
}
