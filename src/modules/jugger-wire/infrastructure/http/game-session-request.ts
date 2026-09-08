export type GameSessionRequest =
  | { kind: "handoff"; sessionId: string }
  | { kind: "cookie"; sessionId: string }
  | { kind: "missing" };

export function parseGameSessionRequest(query: unknown, cookies: unknown): GameSessionRequest {
  const fields = parseGameSessionQuery(query);
  if (fields._s !== undefined || fields._k !== undefined || fields._u !== undefined) {
    if (!nonEmpty(fields._s) || !nonEmpty(fields._k) || !nonEmpty(fields._u)) {
      return { kind: "missing" };
    }
    return { kind: "handoff", sessionId: fields._s };
  }
  const sessionId = phpSessionId(cookies);
  if (!sessionId) return { kind: "missing" };
  return { kind: "cookie", sessionId };
}

type GameSessionQuery = Readonly<{
  _s?: unknown;
  _k?: unknown;
  _u?: unknown;
}>;

function parseGameSessionQuery(query: unknown): GameSessionQuery {
  if (query === undefined) return {};
  if (!isPlainObject(query)) {
    throw new Error("game.php query must be a key/value object");
  }
  const fields: { _s?: unknown; _k?: unknown; _u?: unknown } = {};
  if (Object.hasOwn(query, "_s")) fields._s = Reflect.get(query, "_s");
  if (Object.hasOwn(query, "_k")) fields._k = Reflect.get(query, "_k");
  if (Object.hasOwn(query, "_u")) fields._u = Reflect.get(query, "_u");
  return fields;
}

function phpSessionId(cookies: unknown): string | undefined {
  if (cookies === undefined) return undefined;
  if (!isPlainObject(cookies)) {
    throw new Error("game.php cookies must be a key/value object");
  }
  if (!Object.hasOwn(cookies, "PHPSESSID")) return undefined;
  const value = Reflect.get(cookies, "PHPSESSID");
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isPlainObject(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
