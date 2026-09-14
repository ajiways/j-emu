import { amfInteger, amfOmittedZeroInteger, isRecord } from "./amf-fields.ts";
import type { BotSource } from "./bot-source.ts";

export type RadveiHuntLook = Readonly<{
  swf: string;
  scale: number;
  fps: number;
  speed: number;
  nick: string;
  avatar: string;
  hideOnMap: 0 | 1;
}>;

export function loadRadveiHuntLooks(decoded: unknown): ReadonlyMap<number, RadveiHuntLook> {
  if (!isRecord(decoded)) throw new Error("radvei-hunt-bots.json root must be an object");
  const areas = isRecord(decoded.areas) ? decoded.areas : decoded;
  const out = new Map<number, RadveiHuntLook>();
  for (const [areaId, area] of Object.entries(areas)) {
    if (areaId === "generated_from" || areaId === "note") continue;
    if (!isRecord(area)) throw new Error(`radvei-hunt-bots.json area ${areaId} must be an object`);
    for (const [key, row] of Object.entries(area)) {
      if (!isRecord(row)) {
        throw new Error(`radvei-hunt-bots.json area ${areaId} bot ${key} must be an object`);
      }
      const id = amfInteger(
        row.id ?? row.artikul_id ?? key,
        `radvei-hunt-bots.json ${areaId}:${key} id`,
      );
      if (id < 1) throw new Error(`radvei-hunt-bots.json ${areaId}:${key} id must be positive`);
      if (out.has(id)) continue;
      const swf = stringField(row.hunt_swf, `radvei-hunt-bots.json bot ${id} hunt_swf`);
      if (!swf) continue;
      const hide = amfOmittedZeroInteger(
        row.hide_on_map,
        `radvei-hunt-bots.json bot ${id} hide_on_map`,
      );
      if (hide !== 0 && hide !== 1) {
        throw new Error(`radvei-hunt-bots.json bot ${id} hide_on_map must be 0 or 1`);
      }
      out.set(id, {
        swf,
        scale: positive(
          amfInteger(row.hunt_scale, `radvei-hunt-bots.json bot ${id} hunt_scale`),
          `radvei-hunt-bots.json bot ${id} hunt_scale`,
        ),
        fps: positive(
          amfInteger(row.hunt_fps, `radvei-hunt-bots.json bot ${id} hunt_fps`),
          `radvei-hunt-bots.json bot ${id} hunt_fps`,
        ),
        speed: amfOmittedZeroInteger(row.speed, `radvei-hunt-bots.json bot ${id} speed`),
        nick: stringField(row.nick, `radvei-hunt-bots.json bot ${id} nick`),
        avatar: stringField(row.avatar, `radvei-hunt-bots.json bot ${id} avatar`),
        hideOnMap: hide,
      });
    }
  }
  return out;
}

export function fillUnmappedHuntLooks(
  bots: readonly BotSource[],
  looks: ReadonlyMap<number, RadveiHuntLook>,
): BotSource[] {
  return bots.map((bot) => {
    if (bot.hunt.swf) return bot;
    const look = looks.get(bot.id);
    if (!look) return bot;
    return {
      ...bot,
      hunt: {
        ...bot.hunt,
        nick: look.nick || bot.hunt.nick,
        swf: look.swf,
        scale: look.scale,
        fps: look.fps,
        speed: look.speed,
        avatar: look.avatar || bot.hunt.avatar,
        hideOnMap: look.hideOnMap,
      },
    };
  });
}

function stringField(value: unknown, label: string): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  return value;
}

function positive(value: number, label: string): number {
  if (value < 1) throw new Error(`${label} must be positive`);
  return value;
}
