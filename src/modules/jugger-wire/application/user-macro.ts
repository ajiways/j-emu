import { macroKeyId } from "../../../shared/kernel/macro-key-id.ts";

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
