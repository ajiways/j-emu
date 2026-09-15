import { z, ZodError } from "zod";
import { HeroOperatorError } from "../../application/hero-operator-error.ts";

const WIRE_INTEGER_MAX = 2_147_483_647;

const grantItemBodySchema = z
  .object({
    artifactId: z.number().int().positive().max(WIRE_INTEGER_MAX),
    quantity: z.number().int().positive().max(WIRE_INTEGER_MAX),
  })
  .strict();

const adjustMoneyBodySchema = z
  .object({
    minorUnits: z
      .number()
      .int()
      .refine((value) => value !== 0, "minorUnits must be a non-zero integer")
      .refine(
        (value) => Math.abs(value) <= WIRE_INTEGER_MAX,
        "minorUnits is outside the wire integer range",
      ),
  })
  .strict();

export function parseHeroId(raw: string): number {
  if (!/^[1-9]\d*$/.test(raw)) throw new HeroOperatorError(400, "hero id is invalid");
  const id = Number(raw);
  if (!Number.isInteger(id) || id > WIRE_INTEGER_MAX) {
    throw new HeroOperatorError(400, "hero id is invalid");
  }
  return id;
}

export function parseGrantItemBody(body: unknown) {
  return parseDto(grantItemBodySchema, readJsonBuffer(body));
}

export function parseAdjustMoneyBody(body: unknown) {
  return parseDto(adjustMoneyBodySchema, readJsonBuffer(body));
}

function readJsonBuffer(body: unknown): unknown {
  if (!Buffer.isBuffer(body)) throw new HeroOperatorError(400, "JSON body is required");
  if (body.length === 0) throw new HeroOperatorError(400, "JSON body is required");
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    throw new HeroOperatorError(400, "JSON body is invalid");
  }
}

function parseDto<T>(schema: z.ZodType<T>, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      const path = issue && issue.path.length > 0 ? issue.path.join(".") : "body";
      const message = issue ? issue.message : "request is invalid";
      throw new HeroOperatorError(400, `${path}: ${message}`);
    }
    throw error;
  }
}
