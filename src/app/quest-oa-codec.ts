import type { OaEncodedResponse } from "../modules/jugger-wire/commands/oa/oa-command.ts";
import type { ObjectActionEnvelope } from "../modules/jugger-wire/commands/oa/object-action-envelope.ts";
import { ProtocolError } from "../modules/jugger-wire/application/protocol-error.ts";
import type { DialogView } from "../modules/quests/domain/dialog-cursor.ts";
import { QuestDeniedError } from "../modules/quests/domain/quest-denied-error.ts";
import type { QuestService } from "../modules/quests/application/quest-service.ts";

export function jumpAreaAnswer(): Readonly<{
  status: 100;
  jump: "area";
  macros_list: readonly [];
}> {
  return { status: 100, jump: "area", macros_list: [] };
}

export function questDialogPayload(
  pointId: number,
  view: DialogView,
  info: Awaited<ReturnType<QuestService["npcInfo"]>>,
): object {
  return {
    status: 100,
    point: {
      id: pointId,
      message: view.message,
      award_message: view.awardMessage,
      target_message: view.targetMessage,
    },
    quest: { title: "" },
    answer_list: view.answers.map((answer, ord) => ({
      id: answer.id,
      message: answer.message,
      waiting_time: 0,
      ord,
      key: answer.key,
      ...(answer.toFight === 1 ? { to_fight: 1 } : {}),
    })),
    npc: info.npc,
    macros_list: [],
  };
}

export function npcRefOf(envelope: ObjectActionEnvelope): number {
  const raw = envelope.form?.["ref"] ?? envelope.root?.["ref"] ?? envelope.form?.["npc_id"];
  return requireQuestInt(raw, "ref");
}

export function answerIdOf(raw: unknown): number {
  if (raw === undefined || raw === null) return 0;
  if (typeof raw !== "number" && typeof raw !== "string") {
    throw new QuestDeniedError("answer_id is invalid");
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new QuestDeniedError("answer_id is invalid");
  return value;
}

export function requireQuestInt(raw: unknown, label: string): number {
  if (typeof raw !== "number" && typeof raw !== "string") {
    throw new ProtocolError(203, `${label} is required`);
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new ProtocolError(203, `${label} is invalid`);
  return value;
}

export function questFlat(blocks: Record<string, unknown>): OaEncodedResponse {
  return { kind: "flat", blocks };
}
