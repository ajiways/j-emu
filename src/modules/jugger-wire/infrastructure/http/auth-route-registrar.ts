import fastifyFormbody from "@fastify/formbody";
import type { FastifyInstance } from "fastify";
import { ProtocolError } from "../../application/protocol-error.ts";
import type { JuggerHttpDependencies } from "./jugger-http-dependencies.ts";

export class AuthRouteRegistrar {
  constructor(private readonly dependencies: JuggerHttpDependencies) {}

  async register(app: FastifyInstance): Promise<void> {
    const { identity } = this.dependencies;
    await app.register(async (auth) => {
      await auth.register(fastifyFormbody);
      auth.get("/login", async (_request, reply) =>
        reply
          .type("text/html; charset=utf-8")
          .send(
            '<!doctype html><form method="post"><input name="login"><input name="password" type="password"><button>Login</button></form>',
          ),
      );
      auth.post<{ Body: { login?: unknown; password?: unknown } }>(
        "/login",
        async (request, reply) => {
          if (typeof request.body.login !== "string" || typeof request.body.password !== "string") {
            throw new ProtocolError(203, "Login and password are required");
          }
          const authenticated = await identity.login(request.body.login, request.body.password);
          if (!authenticated) return reply.code(401).send("Invalid credentials");
          await this.ensureHero(authenticated.account.id, authenticated.account.nick);
          return reply.redirect(this.gameUrl(authenticated.session));
        },
      );
    });

    app.get<{ Querystring: { slot?: string } }>("/soc_auth.php", async (request, reply) => {
      const slotText = request.query.slot;
      if (typeof slotText !== "string" || !/^\d+$/.test(slotText)) {
        throw new ProtocolError(203, "Development slot is required");
      }
      const authenticated = await identity.createDevelopmentIdentity(Number(slotText));
      await this.ensureHero(authenticated.account.id, authenticated.account.nick);
      return reply.redirect(this.gameUrl(authenticated.session));
    });

    app.get<{ Querystring: { _s?: string; _k?: string; _u?: string } }>(
      "/game.php",
      async (request, reply) => {
        const { _s: sessionId, _k: sessionKey, _u: accountId } = request.query;
        if (!sessionId || !sessionKey || !accountId) {
          throw new ProtocolError(4, "Session handoff parameters are required");
        }
        reply.setCookie("PHPSESSID", sessionId, { path: "/", httpOnly: true, sameSite: "lax" });
        reply.setCookie("sess_key", sessionKey, { path: "/", httpOnly: true, sameSite: "lax" });
        reply.setCookie("sess_uid", accountId, { path: "/", sameSite: "lax" });
        return reply
          .type("text/html; charset=utf-8")
          .send(
            '<!doctype html><div id="game">Jugger client shell</div><script>history.replaceState({}, "", "/game.php")</script>',
          );
      },
    );
  }

  private gameUrl(session: { id: string; sessionKey: string; accountId: string }): string {
    const query = new URLSearchParams({
      _s: session.id,
      _k: session.sessionKey,
      _u: session.accountId,
    });
    return `/game.php?${query.toString()}`;
  }

  private async ensureHero(accountId: string, nick: string): Promise<void> {
    const hero = await this.dependencies.characters.getOrCreateForAccount(accountId, nick);
    await this.dependencies.inventory.ensureStarterInventory(hero.id);
  }
}
