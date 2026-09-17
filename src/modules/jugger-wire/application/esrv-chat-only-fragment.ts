export function isUnmergedEsrvFragment(fragment: object): boolean {
  const keys = Object.keys(fragment);
  return (
    keys.length === 1 &&
    (keys[0] === "chat|message" || keys[0] === "user|bag_diff" || keys[0] === "user|unitframe")
  );
}
