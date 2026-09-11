import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ContentEditorError } from "../../../content/application/content-editor-error.ts";
import type { OperatorAuthPolicy } from "../../../content/application/operator-auth-policy.ts";
import type { ContentEditor } from "../../../content/ports/content-editor.ts";
import {
  parseBuildCandidateBody,
  parseCandidateId,
  parseDocumentQuery,
  parseKeysQuery,
  parseSaveDraftBody,
} from "./operator-content-body.ts";

export class OperatorContentRouteRegistrar {
  constructor(
    private readonly editor: ContentEditor,
    private readonly auth: OperatorAuthPolicy,
  ) {}

  async register(app: FastifyInstance): Promise<void> {
    await app.register(
      async (scope) => {
        scope.addHook("preHandler", async (request, reply) => {
          if (!this.auth.matches(request.headers.authorization)) {
            return reply.code(401).send({ error: "Unauthorized" });
          }
        });
        scope.post("/drafts", async (request, reply) => {
          return send(reply, request, async () => {
            const body = parseSaveDraftBody(request.body);
            return this.editor.saveDraft(body);
          });
        });
        scope.post("/candidates", async (request, reply) => {
          return send(reply, request, async () => {
            const body = parseBuildCandidateBody(request.body);
            return this.editor.buildCandidate(body);
          });
        });
        scope.post("/candidates/:id/validate", async (request, reply) => {
          return send(reply, request, async () => {
            const id = parseCandidateId(paramId(request));
            return this.editor.validateCandidate(id);
          });
        });
        scope.post("/candidates/:id/activate", async (request, reply) => {
          return send(reply, request, async () => {
            const id = parseCandidateId(paramId(request));
            return this.editor.activateCandidate(id);
          });
        });
        scope.get("/status", async (request, reply) => {
          return send(reply, request, async () => this.editor.status());
        });
        scope.get("/document", async (request, reply) => {
          return send(reply, request, async () => {
            const query = parseDocumentQuery(request.query);
            return this.editor.readDocument(query);
          });
        });
        scope.get("/keys", async (request, reply) => {
          return send(reply, request, async () => {
            const query = parseKeysQuery(request.query);
            return this.editor.listKeys(query.contentType);
          });
        });
      },
      { prefix: "/operator/content" },
    );
  }
}

async function send(
  reply: FastifyReply,
  request: FastifyRequest,
  work: () => Promise<unknown>,
): Promise<FastifyReply> {
  try {
    return reply.code(200).send(await work());
  } catch (error) {
    if (error instanceof ContentEditorError) {
      return reply.code(error.status).send({
        error: error.message,
        ...(error.reportId === undefined ? {} : { reportId: error.reportId }),
      });
    }
    request.log.error(error);
    return reply.code(500).send({ error: "Internal server error" });
  }
}

function paramId(request: FastifyRequest): string {
  const params = request.params;
  if (!params || typeof params !== "object" || !("id" in params)) {
    throw new ContentEditorError(400, "candidate id is required");
  }
  const id = params.id;
  if (typeof id !== "string") throw new ContentEditorError(400, "candidate id is required");
  return id;
}
