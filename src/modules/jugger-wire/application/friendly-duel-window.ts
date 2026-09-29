import { createHash } from "node:crypto";
import type { UserMacroToken } from "./user-macro.ts";

export function friendlyDuelBanKey(challengerAccountId: number, targetAccountId: number): string {
  if (!Number.isInteger(challengerAccountId) || challengerAccountId < 1) {
    throw new Error("Duel challenger account id is invalid");
  }
  if (!Number.isInteger(targetAccountId) || targetAccountId < 1) {
    throw new Error("Duel target account id is invalid");
  }
  return createHash("md5")
    .update(`friendly-duel:${challengerAccountId}:${targetAccountId}`)
    .digest("hex");
}

/** Live `common|window` for a duel invite; the buttons carry the challenger nick (2players dump). */
export function friendlyDuelInviteWindow(
  challengerNick: string,
  userToken: UserMacroToken,
  banKey: string,
): Readonly<Record<string, unknown>> {
  return {
    status: 100,
    title: "Приглашение на дуэль",
    image: "images/duel.png",
    text: `Игрок ${userToken.token}<br> пригласил вас на дуэль.`,
    macroses: { [userToken.key]: userToken.macro },
    ban_keys: [banKey],
    buttons: [
      {
        caption: "Согласиться",
        action: { object: "user", action: "friendly_duel_accept", form: { nick: challengerNick } },
      },
      {
        caption: "Отказаться",
        action: { object: "user", action: "friendly_duel_decline", form: { nick: challengerNick } },
      },
      { caption: "Игнорировать", ban_key: banKey },
    ],
  };
}
