import { GhostHeroError } from "../modules/character/domain/ghost-hero-error.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import { ProfessionDeniedError } from "../modules/professions/domain/profession-denied-error.ts";
import type { ProfessionsService } from "../modules/professions/application/professions-service.ts";
import type { ObjectActionEnvelope } from "../modules/jugger-wire/commands/oa/object-action-envelope.ts";
import type { OaEncodedResponse } from "../modules/jugger-wire/commands/oa/oa-command.ts";

export class AssistantDesk {
  constructor(
    private readonly professions: ProfessionsService,
    private readonly characters: CharacterService,
  ) {}

  async execute(
    key: string,
    accountId: number,
    envelope: ObjectActionEnvelope,
  ): Promise<OaEncodedResponse> {
    const hero = await this.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    const fields = mergedFields(envelope);
    try {
      return nested(await this.dispatch(key, hero.id, fields));
    } catch (error) {
      if (error instanceof ProfessionDeniedError || error instanceof GhostHeroError) {
        return nested({ status: 2, error: error.message });
      }
      throw error;
    }
  }

  private async dispatch(
    key: string,
    heroId: number,
    fields: Readonly<Record<string, unknown>>,
  ): Promise<object> {
    if (key === "assistant|info") return this.professions.info(heroId);
    if (key === "assistant|farm_info") {
      const hero = await this.characters.getById(heroId);
      if (!hero) throw new Error(`Hero ${heroId} is missing`);
      return this.professions.farmInfo(hero.areaId);
    }
    if (key === "assistant|work") {
      const started = await this.professions.work(
        heroId,
        requireId(fields, "id"),
        requireId(fields, "farm_id"),
      );
      return { status: 100, ftime: started.ftime, stime: started.stime };
    }
    if (key === "assistant|repeat") {
      const started = await this.professions.repeat(heroId, requireId(fields, "id"));
      return { status: 100, ftime: started.ftime, stime: started.stime };
    }
    if (key === "assistant|revoke") {
      await this.professions.revoke(heroId, requireId(fields, "id"));
      return { status: 100 };
    }
    if (key === "assistant|save") {
      await this.professions.save(heroId, requireId(fields, "id"), savePatch(fields));
      return { status: 100 };
    }
    if (key === "assistant|create") {
      await this.professions.create(heroId, requireId(fields, "artikul_id"));
      return { status: 100 };
    }
    if (key === "assistant|upgrade") {
      await this.professions.upgrade(heroId, requireId(fields, "id"));
      return { status: 100 };
    }
    throw new Error(`Assistant OA ${key} is not registered`);
  }
}

function nested(value: object): OaEncodedResponse {
  return { kind: "nested", value };
}

function mergedFields(envelope: ObjectActionEnvelope): Readonly<Record<string, unknown>> {
  return { ...(envelope.form ?? {}), ...(envelope.root ?? {}) };
}

function savePatch(fields: Readonly<Record<string, unknown>>): {
  nick?: string;
  tactics?: number;
  speed?: number;
  defence?: number;
  intellect?: number;
} {
  const skills = asRecord(fields["skills"]);
  const nick = fields["nick"];
  const tactics = optionalInt(fields, "tactics");
  const speed = optionalInt(skills, "speed") ?? optionalInt(fields, "skill_speed");
  const defence = optionalInt(skills, "defence") ?? optionalInt(fields, "skill_defence");
  const intellect = optionalInt(skills, "intellect") ?? optionalInt(fields, "skill_intellect");
  return {
    ...(typeof nick === "string" ? { nick } : {}),
    ...(tactics === undefined ? {} : { tactics }),
    ...(speed === undefined ? {} : { speed }),
    ...(defence === undefined ? {} : { defence }),
    ...(intellect === undefined ? {} : { intellect }),
  };
}

function requireId(fields: Readonly<Record<string, unknown>>, key: string): number {
  const value = optionalInt(fields, key);
  if (value === undefined || value < 1) {
    throw new ProfessionDeniedError(`${key} is required`);
  }
  return value;
}

function optionalInt(
  fields: Readonly<Record<string, unknown>> | undefined,
  key: string,
): number | undefined {
  if (!fields || !(key in fields)) return undefined;
  const raw = fields[key];
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
  if (!Number.isInteger(value) || value < 0) throw new ProfessionDeniedError(`${key} is invalid`);
  return value;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
