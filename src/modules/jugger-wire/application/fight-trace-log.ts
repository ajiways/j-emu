import type { CombatEvent, FightCommand } from "../../combat/ports/combat-port.ts";
import { decodeFightRequest } from "../registry/fproxy-command-registry.ts";
import type { FightWireFrame } from "./fight-wire-event.ts";

export type FightTraceSink = Readonly<{
  info(obj: object, msg: string): void;
}>;

/** Leftover CMB-02 AOE debug: full fproxy request/response until CEF confirms list HP. */
export class FightTraceLog {
  static requestOf(body: unknown): unknown | null {
    if (!Buffer.isBuffer(body) || body.length <= 1) return null;
    return decodeFightRequest(body);
  }

  static record(input: {
    channel: "http" | "tcp";
    accountId: number;
    command: FightCommand;
    request: unknown | null;
    events: readonly CombatEvent[];
    frames: readonly FightWireFrame[];
  }): object {
    if (input.command.kind === "poll" && input.frames.length === 0) {
      return {
        event: "fight_trace",
        channel: input.channel,
        accountId: input.accountId,
        kind: "poll",
        empty: true,
      };
    }
    return {
      event: "fight_trace",
      channel: input.channel,
      accountId: input.accountId,
      kind: input.command.kind,
      command: input.command,
      request: input.request,
      eventTypes: input.events.map((event) => event.type),
      events: input.events,
      frames: input.frames,
      hp: fightTraceHp(input.frames),
    };
  }

  static write(log: FightTraceSink, input: Parameters<typeof FightTraceLog.record>[0]): void {
    log.info(this.record(input), "fight_trace");
  }
}

export function fightTraceHp(frames: readonly FightWireFrame[]): readonly object[] {
  const rows: object[] = [];
  collectHp(frames, rows);
  return rows;
}

function collectHp(value: unknown, rows: object[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectHp(item, rows);
    return;
  }
  if (!value || typeof value !== "object") return;
  const rec = value as Record<string, unknown>;
  const et = rec.et;
  if (et === "persChangeInfo") {
    rows.push({
      et,
      id: rec.id,
      nick: rec.nick,
      hp: rec.hp,
      maxHp: rec.maxHp,
      dead: rec.dead,
    });
  } else if (et === "hpChange") {
    rows.push({
      et,
      persId: rec.persId,
      targetId: rec.targetId,
      hp: rec.hp,
      maxHp: rec.maxHp,
    });
  } else if (et === "cast") {
    rows.push({
      et,
      persId: rec.persId,
      targetId: rec.targetId,
      animData: rec.animData,
      maxHp: rec.maxHp,
    });
  }
  for (const nested of Object.values(rec)) collectHp(nested, rows);
}
