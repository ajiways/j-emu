import type { FastifyInstance } from "fastify";
import { encodePlainFrames } from "../../amf/framing.ts";
import { isChatAuth } from "../../application/esrv-chat-auth.ts";
import { esrvUnauthenticatedPacket } from "../../commands/esrv/esrv-packet.ts";
import type { JuggerHttpDependencies } from "./jugger-http-dependencies.ts";
import { waitForLongPoll } from "./long-poll-request.ts";

export class EsrvRouteRegistrar {
  constructor(private readonly dependencies: JuggerHttpDependencies) {}

  async register(app: FastifyInstance): Promise<void> {
    app.post("/esrv/*", async (request, reply) => {
      if (isChatAuth(request.body)) {
        return reply.type("application/octet-stream").send(Buffer.alloc(0));
      }
      const account = await this.dependencies.identity.authenticate(request.cookies.PHPSESSID);
      if (!account) {
        return reply
          .type("application/octet-stream")
          .send(encodePlainFrames([esrvUnauthenticatedPacket()]));
      }
      if (!(await this.dependencies.esrvPoll.hasImmediateWork(account.id))) {
        await waitForLongPoll(
          request,
          this.dependencies.longPoll,
          this.dependencies.config.esrvPollMs,
          account.id,
        );
      }
      const frames = await this.dependencies.esrvPoll.assemble(account.id);
      return reply.type("application/octet-stream").send(encodePlainFrames(frames));
    });
  }
}
