import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { CombatEvent, FightCommand } from "../../../combat/ports/combat-port.ts";
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
        request.log.info(
          {
            event: "fproxy",
            kind: command.kind,
            bytes: Buffer.isBuffer(request.body) ? request.body.length : 0,
          },
          "fproxy",
        );
        const events = await this.fightEvents(request, account.id, command);
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

  private async fightEvents(
    request: FastifyRequest,
    accountId: number,
    command: FightCommand,
  ): Promise<readonly CombatEvent[]> {
    if (command.kind !== "poll") {
      const events = await this.dependencies.combat.execute(accountId, command);
      this.dependencies.longPoll.wake(accountId);
      return events;
    }
    const queued = await this.dependencies.combat.execute(accountId, command);
    if (queued.length > 0) return queued;
    await waitForLongPoll(
      request,
      this.dependencies.longPoll,
      this.dependencies.config.fproxyPollMs,
      accountId,
    );
    return this.dependencies.combat.execute(accountId, command);
  }
}
