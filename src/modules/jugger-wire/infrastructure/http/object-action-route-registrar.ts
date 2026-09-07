import type { FastifyInstance } from "fastify";
import { decodeAmf3, encodeAmf3 } from "../../amf/amf3.ts";
import { toAmfValue } from "../../amf/to-amf-value.ts";
import { errorBlock, ProtocolError } from "../../application/protocol-error.ts";
import {
  decodeObjectActionEnvelope,
  oaResponseKey,
} from "../../commands/oa/object-action-envelope.ts";
import type { JuggerHttpDependencies } from "./jugger-http-dependencies.ts";

export class ObjectActionRouteRegistrar {
  constructor(private readonly dependencies: JuggerHttpDependencies) {}

  async register(app: FastifyInstance): Promise<void> {
    app.post("/entry_point.php", async (request, reply) => {
      const raw = request.body;
      if (!Buffer.isBuffer(raw)) throw new ProtocolError(204, "AMF request body is required");
      let responseKey = "common|unknown";
      let sequence: string | number | boolean | null = null;
      try {
        const envelope = decodeObjectActionEnvelope(decodeAmf3(raw));
        responseKey = oaResponseKey(envelope);
        sequence = envelope.sequence;
        const account = await this.dependencies.identity.authenticate(request.cookies.PHPSESSID);
        if (!account) throw new ProtocolError(4, "No active session");
        const result = await this.dependencies.commands.oa.dispatch(account.id, envelope);
        const payload =
          result.kind === "flat"
            ? { ...result.blocks, sq: sequence }
            : { [responseKey]: result.value, sq: sequence };
        return reply.type("application/octet-stream").send(encodeAmf3(toAmfValue(payload)));
      } catch (error) {
        request.log.error({ err: error, responseKey }, "object_action_failed");
        return reply
          .type("application/octet-stream")
          .send(encodeAmf3(toAmfValue({ [responseKey]: errorBlock(error), sq: sequence })));
      }
    });
  }
}
