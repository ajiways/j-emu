export type GameSessionRequest =
  | { kind: "handoff"; sessionId: string }
  | { kind: "cookie"; sessionId: string }
  | { kind: "missing" };

export function parseGameSessionRequest(
  query: Readonly<{ _s?: unknown; _k?: unknown; _u?: unknown }>,
  cookies: Readonly<{ PHPSESSID?: string }>,
): GameSessionRequest {
  if (query._s !== undefined || query._k !== undefined || query._u !== undefined) {
    if (!nonEmpty(query._s) || !nonEmpty(query._k) || !nonEmpty(query._u)) {
      return { kind: "missing" };
    }
    return { kind: "handoff", sessionId: query._s };
  }
  if (!cookies.PHPSESSID) return { kind: "missing" };
  return { kind: "cookie", sessionId: cookies.PHPSESSID };
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
