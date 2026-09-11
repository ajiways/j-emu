import { z, ZodError } from "zod";
import { ContentEditorError } from "../../../content/application/content-editor-error.ts";
import { CONTENT_TYPES } from "../../../content/domain/parse-content-document.ts";

const contentTypeSchema = z.enum(CONTENT_TYPES);

const saveDraftBodySchema = z
  .object({
    contentType: contentTypeSchema,
    contentKey: z.string().min(1),
    document: z.unknown(),
    expectedVersion: z.number().int().positive(),
  })
  .strict();

const overlaySchema = z
  .object({
    contentType: contentTypeSchema,
    contentKey: z.string().min(1),
    draftVersionId: z.string().uuid(),
  })
  .strict();

const buildCandidateBodySchema = z
  .object({
    overlays: z.array(overlaySchema),
    expectedActiveReleaseId: z.string().uuid(),
  })
  .strict();

function readJsonBuffer(body: unknown): unknown {
  if (!Buffer.isBuffer(body)) throw new ContentEditorError(400, "JSON body is required");
  if (body.length === 0) throw new ContentEditorError(400, "JSON body is required");
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    throw new ContentEditorError(400, "JSON body is invalid");
  }
}

export function parseSaveDraftBody(body: unknown) {
  return parseDto(saveDraftBodySchema, readJsonBuffer(body));
}

export function parseBuildCandidateBody(body: unknown) {
  return parseDto(buildCandidateBodySchema, readJsonBuffer(body));
}

export function parseCandidateId(id: string): string {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) throw new ContentEditorError(400, "candidate id is invalid");
  return parsed.data;
}

const documentQuerySchema = z
  .object({
    contentType: contentTypeSchema,
    contentKey: z.string().min(1),
  })
  .strict();

const keysQuerySchema = z
  .object({
    contentType: contentTypeSchema,
  })
  .strict();

export function parseDocumentQuery(query: unknown) {
  return parseDto(documentQuerySchema, query);
}

export function parseKeysQuery(query: unknown) {
  return parseDto(keysQuerySchema, query);
}

function parseDto<T>(schema: z.ZodType<T>, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      const path = issue && issue.path.length > 0 ? issue.path.join(".") : "body";
      const message = issue ? issue.message : "request is invalid";
      throw new ContentEditorError(400, `${path}: ${message}`);
    }
    throw error;
  }
}
