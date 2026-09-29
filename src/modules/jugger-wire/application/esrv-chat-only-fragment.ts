const STANDALONE_ESRV_KEYS: ReadonlySet<string> = new Set([
  "chat|message",
  "user|bag_diff",
  "common|window",
]);

/** Live sends these as their own esrv frame; merging would overwrite a second window or line. */
export function isUnmergedEsrvFragment(fragment: object): boolean {
  const keys = Object.keys(fragment);
  const key = keys[0];
  return keys.length === 1 && key !== undefined && STANDALONE_ESRV_KEYS.has(key);
}
