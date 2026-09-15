import type { FastifyInstance } from "fastify";
import type { CombatPort } from "../../../combat/ports/combat-port.ts";
import { FightInfoPages } from "./fight-info-pages.ts";

export class FightInfoRouteRegistrar {
  constructor(private readonly combat: CombatPort) {}

  async register(app: FastifyInstance): Promise<void> {
    const pages = FightInfoPages.fromModule(import.meta.url);
    const html = "text/html; charset=utf-8";
    app.get("/fight_info.php", async (request, reply) => {
      const raw = (request.query as { fight_id?: unknown }).fight_id;
      if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw)) {
        return reply.code(400).type(html).send(pages.invalid());
      }
      const card = await this.combat.fightInfo(raw);
      if (!card) return reply.type(html).send(pages.missing(raw));
      return reply.type(html).send(pages.card(card));
    });
  }
}
