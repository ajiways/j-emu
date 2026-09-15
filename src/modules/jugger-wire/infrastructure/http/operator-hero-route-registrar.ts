import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { OperatorAuthPolicy } from "../../../content/application/operator-auth-policy.ts";
import { HeroOperatorError } from "../../application/hero-operator-error.ts";
import type { HeroOperator } from "../../application/hero-operator.ts";
import { parseAdjustMoneyBody, parseGrantItemBody, parseHeroId } from "./operator-hero-body.ts";

export class OperatorHeroRouteRegistrar {
  constructor(
    private readonly operator: HeroOperator,
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
        scope.get("/:id", async (request, reply) => {
          return send(reply, request, async () => this.operator.state(paramHeroId(request)));
        });
        scope.post("/:id/items", async (request, reply) => {
          return send(reply, request, async () => {
            const body = parseGrantItemBody(request.body);
            return this.operator.grantItem(paramHeroId(request), body.artifactId, body.quantity);
          });
        });
        scope.post("/:id/money", async (request, reply) => {
          return send(reply, request, async () => {
            const body = parseAdjustMoneyBody(request.body);
            return this.operator.adjustMoney(paramHeroId(request), body.minorUnits);
          });
        });
      },
      { prefix: "/operator/hero" },
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
    if (error instanceof HeroOperatorError) {
      return reply.code(error.status).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: "Internal server error" });
  }
}

function paramHeroId(request: FastifyRequest): number {
  const params = request.params;
  if (!params || typeof params !== "object" || !("id" in params)) {
    throw new HeroOperatorError(400, "hero id is required");
  }
  const id = params.id;
  if (typeof id !== "string") throw new HeroOperatorError(400, "hero id is required");
  return parseHeroId(id);
}
