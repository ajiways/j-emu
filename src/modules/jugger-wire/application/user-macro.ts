export type UserMacroSource = Readonly<{
  nick: string;
  level: number;
  kind: number;
}>;

export type UserMacroToken = Readonly<{
  key: string;
  token: string;
  macro: Readonly<{
    nick: string;
    macro_text: string;
    level: number;
    kind: number;
    rank: 0;
    server_id: 1;
    key_id: string;
    macro_type: "USER";
  }>;
}>;

export const SYSTEM_MAIL_PEER: UserMacroSource = {
  nick: "Почтальон",
  level: 0,
  kind: 0,
};

export function buildUserMacro(source: UserMacroSource): UserMacroToken {
  if (!source.nick) throw new Error("User macro nick is required");
  const key = macroKeyId("USER", source.nick.toLowerCase());
  return {
    key,
    token: `[[USER ${key}]]`,
    macro: {
      nick: source.nick,
      macro_text: source.nick,
      level: source.level,
      kind: source.kind,
      rank: 0,
      server_id: 1,
      key_id: key,
      macro_type: "USER",
    },
  };
}

function macroKeyId(kind: string, id: string): string {
  const s = `${kind}:${id}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const a = h.toString(16).padStart(8, "0");
  let h2 = 0;
  for (let i = s.length - 1; i >= 0; i--) h2 = (h2 * 33 + s.charCodeAt(i)) >>> 0;
  const b = h2.toString(16).padStart(8, "0");
  return `${a}${b}${a}${b}`.slice(0, 32);
}
