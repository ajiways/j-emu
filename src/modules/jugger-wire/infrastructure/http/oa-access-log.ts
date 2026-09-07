import { errorBlock, ProtocolError } from "../../application/protocol-error.ts";
import {
  oaRegistryKey,
  oaResponseKey,
  type ObjectActionEnvelope,
} from "../../commands/oa/object-action-envelope.ts";

type OaAccessOutcome =
  "ok" | "unsupported" | "decode_failure" | "protocol_error" | "internal_error";

export type OaAccessLogRecord = Readonly<{
  accountId: number | null;
  object: string | null;
  action: string | null;
  commandKey: string | null;
  sq: string | number | boolean | null;
  outcome: OaAccessOutcome;
  status: number | null;
  topLevelKeys: readonly string[];
  error?: string;
}>;

export class OaAccessLog {
  static completed(input: {
    accountId: number;
    envelope: ObjectActionEnvelope;
    implemented: boolean;
    payload: object;
  }): OaAccessLogRecord {
    const responseKey = oaResponseKey(input.envelope);
    return {
      accountId: input.accountId,
      object: input.envelope.object,
      action: input.envelope.action,
      commandKey: commandKeyOf(input.envelope),
      sq: input.envelope.sequence,
      outcome: input.implemented ? "ok" : "unsupported",
      status: statusOf(input.payload, responseKey),
      topLevelKeys: topLevelKeysOf(input.payload),
    };
  }

  static failed(input: {
    accountId: number | null;
    envelope: ObjectActionEnvelope | undefined;
    error: unknown;
  }): OaAccessLogRecord {
    const wire = errorBlock(input.error);
    const envelope = input.envelope;
    const record: OaAccessLogRecord = {
      accountId: input.accountId,
      object: envelope ? envelope.object : null,
      action: envelope ? envelope.action : null,
      commandKey: envelope ? commandKeyOf(envelope) : null,
      sq: envelope ? envelope.sequence : null,
      outcome: outcomeOfFailure(input.error, envelope),
      status: wire.status,
      topLevelKeys: topLevelKeysOf({
        [envelope ? oaResponseKey(envelope) : "common|unknown"]: wire,
        sq: envelope ? envelope.sequence : null,
      }),
      error: wire.error,
    };
    return record;
  }

  static write(
    log: { info(obj: object, msg: string): void; error(obj: object, msg: string): void },
    record: OaAccessLogRecord,
  ): void {
    const line = { oa: record };
    if (record.outcome === "decode_failure" || record.outcome === "internal_error") {
      log.error(line, "oa");
      return;
    }
    log.info(line, "oa");
  }
}

function commandKeyOf(envelope: ObjectActionEnvelope): string {
  try {
    return oaRegistryKey(envelope);
  } catch {
    return `${envelope.object}|${envelope.action}`;
  }
}

function statusOf(payload: object, responseKey: string): number | null {
  const block = (payload as Record<string, unknown>)[responseKey];
  if (!block || typeof block !== "object" || Array.isArray(block)) return null;
  const status = (block as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

function topLevelKeysOf(payload: object): readonly string[] {
  return Object.keys(payload).sort();
}

function outcomeOfFailure(
  error: unknown,
  envelope: ObjectActionEnvelope | undefined,
): OaAccessOutcome {
  if (error instanceof ProtocolError) {
    if (error.status === 204 && !envelope) return "decode_failure";
    return "protocol_error";
  }
  if (!envelope) return "decode_failure";
  return "internal_error";
}
