const AREA_SCOPED = new Set(["main", "trade", "kind", "raid", "capture"]);

export function chatChannelType(raw: unknown): string {
  if (raw === undefined || raw === null || raw === "") return "main";
  if (typeof raw !== "string" && typeof raw !== "number") {
    throw new Error("chat type is invalid");
  }
  const type = String(raw).trim();
  return type === "" ? "main" : type;
}

export function isAreaScopedChat(type: string): boolean {
  return AREA_SCOPED.has(type);
}
