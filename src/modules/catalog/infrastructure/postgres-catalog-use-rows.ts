import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { BonusDocument, UseScriptDocument } from "../../content/domain/content-document.ts";
import { bonuses, useScripts } from "./schema.ts";

export async function insertBonuses(
  session: ReturnType<PostgresDatabase["session"]>,
  releaseId: string,
  rows: readonly BonusDocument[],
): Promise<void> {
  if (rows.length === 0) return;
  await session.insert(bonuses).values(
    rows.map((bonus) => ({
      releaseId,
      id: bonus.id,
      kind: bonus.kind,
      skillId: bonus.skillId,
      delta: bonus.delta,
      needValue: bonus.needValue,
      artikulId: bonus.artikulId,
      title: bonus.title,
      chatMsg: bonus.chatMsg,
    })),
  );
}

export async function insertUseScripts(
  session: ReturnType<PostgresDatabase["session"]>,
  releaseId: string,
  rows: readonly UseScriptDocument[],
): Promise<void> {
  if (rows.length === 0) return;
  await session.insert(useScripts).values(
    rows.map((script) => ({
      releaseId,
      bonusId: script.bonusId,
      failPlaque: script.failPlaque,
      require: script.require,
      effects: script.effects,
    })),
  );
}
