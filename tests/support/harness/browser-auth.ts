export const REQUIRED_FLASH_VAR_KEYS = [
  "nick",
  "id",
  "swfPath",
  "amfPath",
  "serverTime",
  "tutorialReady",
] as const;

export function cookieHeaderFromSetCookie(header: string | string[] | undefined): string {
  if (!header) throw new Error("Set-Cookie header is missing");
  const values = Array.isArray(header) ? header : [header];
  return values.map((value) => cookiePair(value)).join("; ");
}

export function cookieMapFromSetCookie(header: string | string[] | undefined): Map<string, string> {
  if (!header) throw new Error("Set-Cookie header is missing");
  const values = Array.isArray(header) ? header : [header];
  const cookies = new Map<string, string>();
  for (const value of values) {
    const pair = cookiePair(value);
    const separator = pair.indexOf("=");
    if (separator <= 0) throw new Error(`Invalid Set-Cookie pair: ${value}`);
    cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  return cookies;
}

function cookiePair(value: string): string {
  const pair = value.split(";")[0];
  if (!pair) throw new Error(`Invalid Set-Cookie header: ${value}`);
  return pair;
}

export function formBody(fields: Readonly<Record<string, string>>): string {
  return new URLSearchParams(fields).toString();
}
