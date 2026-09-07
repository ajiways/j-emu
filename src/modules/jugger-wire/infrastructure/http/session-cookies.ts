import type { FastifyReply } from "fastify";
import type { Session } from "../../../identity/domain/session.ts";

const COOKIE = { path: "/", httpOnly: false, sameSite: "lax" } as const;

export const SESSION_COOKIE_NAMES = ["PHPSESSID", "sess_key", "sess_uid", "sstype", "cid"] as const;

export function setSessionCookies(reply: FastifyReply, session: Session): void {
  const accountId = String(session.accountId);
  reply
    .setCookie("PHPSESSID", session.id, COOKIE)
    .setCookie("sess_key", session.sessionKey, COOKIE)
    .setCookie("sess_uid", accountId, COOKIE)
    .setCookie("sstype", "18", COOKIE)
    .setCookie("cid", accountId, COOKIE);
}

export function clearSessionCookies(reply: FastifyReply): void {
  for (const name of SESSION_COOKIE_NAMES) {
    reply.clearCookie(name, { path: "/" });
  }
}
