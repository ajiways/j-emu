import type { UseScriptDocument } from "../../src/modules/content/domain/content-playable-entities.ts";
import { isRecord, rejectUnknownKeys, requireInteger, requireString } from "./json-object-keys.ts";

const ROOT_KEYS = new Set(["_note", "scripts"]);
const SCRIPT_KEYS = new Set(["bonusId", "require", "failPlaque", "effects", "requires"]);
const REQUIRE_KEYS = new Set(["artikulId", "count"]);
const CONSUME_GRANT_KEYS = new Set(["type", "artikulId", "count"]);

const OMITTED_USE_SCRIPTS: ReadonlyMap<number, string> = new Map([
  [2006, "grantMany and LEVEL requires are not a DATA-05 UseScriptDocument"],
  [2007, "grantMany and LEVEL requires are not a DATA-05 UseScriptDocument"],
  [900584, "openDialog is DATA-06"],
]);

export function useScriptsFromJson(raw: unknown): UseScriptDocument[] {
  if (!isRecord(raw)) throw new Error("artifact-use root must be an object");
  rejectUnknownKeys(raw, ROOT_KEYS, "artifact-use");
  requireString(raw._note, "artifact-use _note");
  if (!Array.isArray(raw.scripts)) throw new Error("artifact-use.scripts must be an array");
  const scripts: UseScriptDocument[] = [];
  const seen = new Set<number>();
  for (const row of raw.scripts) {
    if (!isRecord(row)) throw new Error("use script must be an object");
    rejectUnknownKeys(row, SCRIPT_KEYS, "use script");
    const bonusId = requireInteger(row.bonusId, "use script bonusId");
    if (bonusId < 1) throw new Error("use script bonusId must be positive");
    if (seen.has(bonusId)) throw new Error(`Duplicate use script ${bonusId}`);
    seen.add(bonusId);
    const omit = OMITTED_USE_SCRIPTS.get(bonusId);
    if (omit) continue;
    if (row.requires !== undefined) {
      throw new Error(`use script ${bonusId} requires is not supported in DATA-05`);
    }
    scripts.push({
      bonusId,
      require: parseRequire(row.require, bonusId),
      failPlaque: requireString(row.failPlaque, `use script ${bonusId} failPlaque`),
      effects: parseEffects(row.effects, bonusId),
    });
  }
  if (!scripts.some((script) => script.bonusId === 2827)) {
    throw new Error("use script 2827 is required");
  }
  return scripts;
}

function parseRequire(raw: unknown, bonusId: number): UseScriptDocument["require"] {
  if (!Array.isArray(raw)) throw new Error(`use script ${bonusId} require must be an array`);
  return raw.map((row, index) => {
    if (!isRecord(row)) throw new Error(`use script ${bonusId} require ${index} must be an object`);
    rejectUnknownKeys(row, REQUIRE_KEYS, `use script ${bonusId} require ${index}`);
    const artikulId = requireInteger(
      row.artikulId,
      `use script ${bonusId} require ${index} artikulId`,
    );
    const count = requireInteger(row.count, `use script ${bonusId} require ${index} count`);
    if (artikulId < 1 || count < 1) {
      throw new Error(`use script ${bonusId} require ${index} is invalid`);
    }
    return { artikulId, count };
  });
}

function parseEffects(raw: unknown, bonusId: number): UseScriptDocument["effects"] {
  if (!Array.isArray(raw) || raw.length < 1) {
    throw new Error(`use script ${bonusId} effects must be a non-empty array`);
  }
  return raw.map((row, index) => {
    if (!isRecord(row)) throw new Error(`use script ${bonusId} effect ${index} must be an object`);
    const type = row.type;
    if (type !== "consume" && type !== "grant") {
      throw new Error(
        `use script ${bonusId} effect ${String(type)} is not a DATA-05 consume/grant effect`,
      );
    }
    rejectUnknownKeys(row, CONSUME_GRANT_KEYS, `use script ${bonusId} effect ${index}`);
    const artikulId = requireInteger(
      row.artikulId,
      `use script ${bonusId} effect ${index} artikulId`,
    );
    const count = requireInteger(row.count, `use script ${bonusId} effect ${index} count`);
    if (artikulId < 1 || count < 1) {
      throw new Error(`use script ${bonusId} effect ${index} is invalid`);
    }
    return { type, artikulId, count };
  });
}
