import type { FastifyInstance } from "fastify";
import { encodePlainFrames } from "../../amf/framing.ts";
import { esrvUnauthenticatedPacket } from "../../commands/esrv/esrv-packet.ts";
import type { JuggerHttpDependencies } from "./jugger-http-dependencies.ts";
import { waitForLongPoll } from "./long-poll-request.ts";

export class EsrvRouteRegistrar {
  constructor(private readonly dependencies: JuggerHttpDependencies) {}

  async register(app: FastifyInstance): Promise<void> {
    app.post("/esrv/*", async (request, reply) => {
      const account = await this.dependencies.identity.authenticate(request.cookies.PHPSESSID);
      if (!account) {
        return reply
          .type("application/octet-stream")
          .send(encodePlainFrames([esrvUnauthenticatedPacket()]));
      }
      const exit = await this.dependencies.commands.esrv.poll.handle(account.id);
      if (!exit)
        await waitForLongPoll(
          request,
          this.dependencies.longPoll,
          this.dependencies.config.esrvPollMs,
        );
      const frames = exit
        ? [this.dependencies.commands.esrv.fightExit.encode(account.id, exit, Date.now())]
        : [];
      return reply.type("application/octet-stream").send(encodePlainFrames(frames));
    });
  }
}
