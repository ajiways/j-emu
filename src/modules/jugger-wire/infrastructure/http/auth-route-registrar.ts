import fastifyFormbody from "@fastify/formbody";
import type { FastifyInstance } from "fastify";
import { DuplicateAccountError } from "../../../identity/domain/duplicate-account-error.ts";
import { RegistrationValidationError } from "../../../identity/domain/registration-validation-error.ts";
import type { Session } from "../../../identity/domain/session.ts";
import { AuthHtmlPages } from "./auth-html-pages.ts";
import { parseGameSessionRequest } from "./game-session-request.ts";
import type { JuggerHttpDependencies } from "./jugger-http-dependencies.ts";
import { clearSessionCookies, setSessionCookies } from "./session-cookies.ts";

export class AuthRouteRegistrar {
  constructor(private readonly dependencies: JuggerHttpDependencies) {}

  async register(app: FastifyInstance): Promise<void> {
    const pages = AuthHtmlPages.fromModule(import.meta.url);
    const html = "text/html; charset=utf-8";
    await app.register(async (auth) => {
      await auth.register(fastifyFormbody);
      auth.get("/", async (_request, reply) => reply.type(html).send(pages.login()));
      auth.get("/login", async (_request, reply) => reply.type(html).send(pages.login()));
      auth.get("/login.php", async (_request, reply) => reply.type(html).send(pages.login()));
      auth.get("/register", async (_request, reply) => reply.type(html).send(pages.register()));
      auth.post("/login", async (request, reply) => {
        const body = request.body;
        if (!body || typeof body !== "object") {
          return reply.type(html).send(pages.login("Заполните все поля."));
        }
        const login = (body as { login?: unknown }).login;
        const password = (body as { password?: unknown }).password;
        if (
          typeof login !== "string" ||
          typeof password !== "string" ||
          login.trim() === "" ||
          password.length === 0
        ) {
          return reply.type(html).send(pages.login("Заполните все поля."));
        }
        const authenticated = await this.dependencies.identity.login(login, password);
        if (!authenticated) {
          return reply.type(html).send(pages.login("Неверный логин или пароль."));
        }
        await this.requireHero(authenticated.account.id, authenticated.account.nick);
        await this.dependencies.presence.afterSessionCommitted(
          authenticated.account.id,
          authenticated.replacedExisting,
        );
        return reply.redirect(gameHandoffUrl(authenticated.session));
      });
      auth.post("/register", async (request, reply) => {
        const body = request.body;
        if (!body || typeof body !== "object") {
          return reply.type(html).send(pages.register("Заполните все поля."));
        }
        try {
          const record = body as { login?: unknown; nick?: unknown; password?: unknown };
          const authenticated = await this.dependencies.registration.register(
            record.login,
            record.nick,
            record.password,
          );
          return reply.redirect(gameHandoffUrl(authenticated.session));
        } catch (error) {
          if (
            error instanceof RegistrationValidationError ||
            error instanceof DuplicateAccountError
          ) {
            return reply.type(html).send(pages.register(error.message));
          }
          throw error;
        }
      });
      auth.get("/logout", async (request, reply) => {
        const accountId = await this.dependencies.identity.logout(request.cookies.PHPSESSID);
        if (accountId) await this.dependencies.presence.afterLogout(accountId);
        clearSessionCookies(reply);
        return reply.redirect("/login");
      });
      auth.get("/soc_auth.php", async (request, reply) => {
        const slotText = (request.query as { slot?: unknown }).slot;
        if (typeof slotText !== "string" || !/^[1-9]\d*$/.test(slotText)) {
          return reply.code(400).send("Development slot must be a positive integer");
        }
        const authenticated = await this.dependencies.developmentIdentity.create(Number(slotText));
        return reply.redirect(gameHandoffUrl(authenticated.session));
      });
      auth.get("/game.php", async (request, reply) => {
        const parsed = parseGameSessionRequest(request.query, request.cookies);
        if (parsed.kind === "missing") return reply.redirect("/login");
        const authenticated = await this.dependencies.identity.sessionById(parsed.sessionId);
        if (!authenticated) return reply.redirect("/login");
        if (parsed.kind === "handoff") setSessionCookies(reply, authenticated.session);
        return reply.type(html).send(pages.game(authenticated.account));
      });
      auth.post("/game.php", async (_request, reply) => reply.code(200).send("ok"));
    });
  }

  private async requireHero(accountId: number, nick: string): Promise<void> {
    const hero = await this.dependencies.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Account ${accountId} (${nick}) has no hero`);
  }
}

function gameHandoffUrl(session: Session): string {
  const query = new URLSearchParams({
    _s: session.id,
    _k: session.sessionKey,
    _u: String(session.accountId),
  });
  return `/game.php?${query.toString()}`;
}
