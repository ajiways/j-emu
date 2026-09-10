import { macroKeyId } from "../../../shared/kernel/macro-key-id.ts";

export type ActionMacroToken = Readonly<{
  key: string;
  token: string;
  macro: Readonly<{
    macro_type: "ACTION";
    macro_text: string;
    key_id: string;
    href: Readonly<{
      object: "common";
      action: "action";
      form: Readonly<{ code: "FIGHT_JOIN" }>;
      in: Readonly<{ fight: string; team: string }>;
    }>;
  }>;
}>;

export function buildFightJoinActionMacro(fightId: string, team: 1 | 2): ActionMacroToken {
  if (!fightId) throw new Error("FIGHT_JOIN action fight id is required");
  const key = macroKeyId("ACTION", `${fightId}:${team}`);
  return {
    key,
    token: `[[ACTION ${key}]]`,
    macro: {
      macro_type: "ACTION",
      macro_text: "ПОМОЧЬ",
      key_id: key,
      href: {
        object: "common",
        action: "action",
        form: { code: "FIGHT_JOIN" },
        in: { fight: String(fightId), team: String(team) },
      },
    },
  };
}
