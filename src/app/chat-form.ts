export function chatText(form: Readonly<Record<string, unknown>> | undefined): string {
  if (!form) return "";
  const raw = form["message"] !== undefined ? form["message"] : form["msg"];
  if (raw === undefined || raw === null) return "";
  if (typeof raw !== "string" && typeof raw !== "number") {
    throw new Error("chat message is invalid");
  }
  return String(raw).trim();
}

export function chatLng(raw: unknown, heroLanguage: string): string {
  if (!heroLanguage) throw new Error("Hero language is required");
  if (raw === undefined || raw === null || raw === "") return heroLanguage;
  if (typeof raw !== "string") throw new Error("chat lng is invalid");
  const trimmed = raw.trim();
  return trimmed === "" ? heroLanguage : trimmed;
}

export function chatRecipients(raw: unknown): readonly string[] {
  if (raw === undefined || raw === null || raw === "") return [];
  const values = Array.isArray(raw) ? raw : [raw];
  const nicks: string[] = [];
  for (const value of values) {
    if (typeof value !== "string" && typeof value !== "number") {
      throw new Error("chat recipient_list is invalid");
    }
    const nick = String(value).trim();
    if (nick) nicks.push(nick);
  }
  return nicks;
}
