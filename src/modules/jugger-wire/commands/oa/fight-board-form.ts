import { ProtocolError } from "../../application/protocol-error.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export function parseFightBoardForm(
  envelope: ObjectActionEnvelope,
  commandKey: string,
): {
  page: number;
  nick?: string;
  type?: number;
  levelMin?: number;
  levelMax?: number;
} {
  const nick = optionalFormText(envelope, "nick");
  const type = optionalFormInt(envelope, "type", commandKey);
  const levelMin = optionalFormInt(envelope, "level_min", commandKey);
  const levelMax = optionalFormInt(envelope, "level_max", commandKey);
  const requestedPage = optionalFormInt(envelope, "page", commandKey);
  const page = requestedPage === undefined ? 1 : requestedPage;
  return {
    page,
    ...(nick === undefined ? {} : { nick }),
    ...(type === undefined ? {} : { type }),
    ...(levelMin === undefined ? {} : { levelMin }),
    ...(levelMax === undefined ? {} : { levelMax }),
  };
}

function formValue(envelope: ObjectActionEnvelope, key: string): unknown {
  return envelope.form?.[key] ?? envelope.input?.[key];
}

function optionalFormText(envelope: ObjectActionEnvelope, key: string): string | undefined {
  const raw = formValue(envelope, key);
  if (raw === undefined || raw === null || raw === "") return undefined;
  const value = String(raw).trim();
  return value === "" ? undefined : value;
}

function optionalFormInt(
  envelope: ObjectActionEnvelope,
  key: string,
  commandKey: string,
): number | undefined {
  const raw = formValue(envelope, key);
  if (raw === undefined || raw === null || raw === "") return undefined;
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isInteger(value) || value < 1) {
    throw new ProtocolError(203, `${commandKey} ${key} is invalid`);
  }
  return value;
}
