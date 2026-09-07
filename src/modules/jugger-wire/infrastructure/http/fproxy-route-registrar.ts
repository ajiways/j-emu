import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { encodePlainFrames } from "../../amf/framing.ts";
import type { JuggerHttpDependencies } from "./jugger-http-dependencies.ts";
import { waitForLongPoll } from "./long-poll-request.ts";

export class FproxyRouteRegistrar {
  constructor(private readonly dependencies: JuggerHttpDependencies) {}

  async register(app: FastifyInstance): Promise<void> {
    const fightHandler = async (request: FastifyRequest, reply: FastifyReply) => {
      const account = await this.dependencies.identity.authenticate(request.cookies.PHPSESSID);
      if (!account) {
        return reply
          .type("application/octet-stream")
          .send(encodePlainFrames([{ rs: false, error: "No active session" }]));
      }
      try {
        const command = this.dependencies.commands.fproxy.decodeHttpBody(request.body);
        if (command.kind === "poll") {
          await waitForLongPoll(
            request,
            this.dependencies.longPoll,
            this.dependencies.config.fproxyPollMs,
          );
        }
        const events = await this.dependencies.combat.execute(account.id, command);
        return reply
          .type("application/octet-stream")
          .send(
            encodePlainFrames(
              events.map((event) => this.dependencies.commands.fightWire.event(event)),
            ),
          );
      } catch (error) {
        request.log.error({ err: error }, "fight_command_failed");
        const message = error instanceof Error ? error.message : "Unknown non-Error failure";
        return reply
          .type("application/octet-stream")
          .send(encodePlainFrames([{ rs: false, error: message }]));
      }
    };
    app.post("/fproxy", fightHandler);
    app.post("/fproxy/*", fightHandler);
  }
}
