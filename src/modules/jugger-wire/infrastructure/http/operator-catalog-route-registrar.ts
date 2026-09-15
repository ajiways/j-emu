import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { OperatorAuthPolicy } from "../../../content/application/operator-auth-policy.ts";
import { CatalogOperatorError } from "../../application/catalog-operator-error.ts";
import type { CatalogOperator } from "../../application/catalog-operator.ts";
import { parseArtifactId, parseCatalogListQuery } from "./operator-catalog-query.ts";

export class OperatorCatalogRouteRegistrar {
  constructor(
    private readonly operator: CatalogOperator,
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
        scope.get("/", async (request, reply) => {
          return send(reply, request, async () =>
            this.operator.list(parseCatalogListQuery(request.query)),
          );
        });
        scope.get("/:id", async (request, reply) => {
          return send(reply, request, async () => this.operator.one(paramArtifactId(request)));
        });
      },
      { prefix: "/operator/catalog/artifacts" },
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
    if (error instanceof CatalogOperatorError) {
      return reply.code(error.status).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: "Internal server error" });
  }
}

function paramArtifactId(request: FastifyRequest): number {
  const params = request.params;
  if (!params || typeof params !== "object" || !("id" in params)) {
    throw new CatalogOperatorError(400, "artifact id is required");
  }
  const id = params.id;
  if (typeof id !== "string") throw new CatalogOperatorError(400, "artifact id is required");
  return parseArtifactId(id);
}
