import type { HuntBotSnapshot } from "./hunt-bot-snapshot.ts";
import type { HuntMaskPoint, HuntRouteStop, HuntSpawn } from "./hunt-spawn.ts";
import type { HuntRandom } from "../ports/hunt-random.ts";

/** Catalog hunt speed 10 → 20 px/s; floor matches live Flash interpolation. */
const HUNT_MIN_WALK_PX_PER_SEC = 4;
const HUNT_MIN_WALK_MS = 400;
const HUNT_NEAR_DEST_PX = 12;
const HUNT_HOME_PARK_MS = 86_400_000;
const HUNT_ZONE_SAMPLE_ATTEMPTS = 48;

export type LiveHuntBot = {
  spawn: HuntSpawn;
  x: number;
  y: number;
  destX: number;
  destY: number;
  walkStartedAt: number;
  walkDurationMs: number;
  phase: "walk" | "wait";
  waitUntil: number;
  routeIndex: number;
  hiddenUntil: number;
  locked: boolean;
};

function huntWalkSpeedPxPerSec(catalogSpeed: number): number {
  if (!Number.isInteger(catalogSpeed) || catalogSpeed < 0) {
    throw new Error(`Hunt walk speed ${catalogSpeed} is invalid`);
  }
  return Math.max(HUNT_MIN_WALK_PX_PER_SEC, catalogSpeed * 2);
}

function currentPos(bot: LiveHuntBot, now: number): HuntMaskPoint {
  if (bot.phase !== "walk" || bot.walkDurationMs <= 0) return { x: bot.x, y: bot.y };
  const t = Math.min(1, Math.max(0, (now - bot.walkStartedAt) / bot.walkDurationMs));
  return {
    x: Math.round(bot.x + (bot.destX - bot.x) * t),
    y: Math.round(bot.y + (bot.destY - bot.y) * t),
  };
}

export function createLiveBot(spawn: HuntSpawn, now: number, random: HuntRandom): LiveHuntBot {
  const bot: LiveHuntBot = {
    spawn,
    x: spawn.x,
    y: spawn.y,
    destX: spawn.x,
    destY: spawn.y,
    walkStartedAt: now,
    walkDurationMs: 1,
    phase: "wait",
    waitUntil: now,
    routeIndex: spawn.route.length >= 2 ? -1 : 0,
    hiddenUntil: 0,
    locked: false,
  };
  pickDest(bot, now, random);
  return bot;
}

export function hideForRespawn(bot: LiveHuntBot, now: number, random: HuntRandom): void {
  const delay = waitMs(bot.spawn.respawnTimeMin, bot.spawn.respawnTimeMax, random);
  bot.locked = false;
  if (delay <= 0) {
    bot.hiddenUntil = 0;
    resetToHome(bot);
    pickDest(bot, now, random);
    return;
  }
  bot.hiddenUntil = now + delay;
  bot.phase = "wait";
}

export function tickLiveBot(
  bot: LiveHuntBot,
  now: number,
  locked: boolean,
  random: HuntRandom,
): boolean {
  if (bot.hiddenUntil > 0) {
    if (now < bot.hiddenUntil) return false;
    bot.hiddenUntil = 0;
    resetToHome(bot);
    bot.locked = false;
    pickDest(bot, now, random);
    return true;
  }
  if (locked) {
    if (!bot.locked) {
      const point = currentPos(bot, now);
      bot.x = point.x;
      bot.y = point.y;
      bot.destX = point.x;
      bot.destY = point.y;
      bot.phase = "wait";
      bot.waitUntil = now + HUNT_HOME_PARK_MS;
      bot.locked = true;
      return true;
    }
    return false;
  }
  if (bot.locked) {
    bot.locked = false;
    pickDest(bot, now, random);
    return true;
  }
  if (bot.phase === "walk") {
    if (now - bot.walkStartedAt >= bot.walkDurationMs) {
      bot.x = bot.destX;
      bot.y = bot.destY;
      bot.phase = "wait";
      bot.waitUntil = now + arrivalWaitMs(bot, random);
      return true;
    }
    return false;
  }
  if (now >= bot.waitUntil) {
    pickDest(bot, now, random);
    return true;
  }
  return false;
}

export function liveToSnapshot(
  bot: LiveHuntBot,
  now: number,
  fightId: number,
): HuntBotSnapshot | null {
  if (bot.hiddenUntil > now) return null;
  const walking = bot.phase === "walk" && !bot.locked && fightId === 0;
  const here = currentPos(bot, now);
  return {
    id: bot.spawn.id,
    artikulId: bot.spawn.botId,
    fightId,
    huntMask: bot.spawn.huntMask,
    positionX: walking ? bot.destX : here.x,
    positionY: walking ? bot.destY : here.y,
    prevX: walking ? bot.x : here.x,
    prevY: walking ? bot.y : here.y,
  };
}

export function nextDueAt(bot: LiveHuntBot): number | null {
  if (bot.hiddenUntil > 0) return bot.hiddenUntil;
  if (bot.locked) return null;
  if (bot.phase === "walk") return bot.walkStartedAt + bot.walkDurationMs;
  return bot.waitUntil;
}

function pickDest(bot: LiveHuntBot, now: number, random: HuntRandom): void {
  const spawn = bot.spawn;
  if (spawn.route.length >= 2) {
    const stop = nextRouteStop(bot);
    setDest(bot, stop, now);
    if (bot.phase === "wait") bot.waitUntil = now + waitMs(stop.waitMin, stop.waitMax, random);
    return;
  }
  if (spawn.zone.length >= 3) {
    setDest(bot, randomPointInPolygon(spawn.zone, random), now);
    if (bot.phase === "wait") {
      bot.waitUntil = now + waitMs(spawn.waitMin, spawn.waitMax, random);
    }
    return;
  }
  bot.destX = spawn.x;
  bot.destY = spawn.y;
  bot.x = spawn.x;
  bot.y = spawn.y;
  bot.phase = "wait";
  bot.waitUntil = now + HUNT_HOME_PARK_MS;
}

function nextRouteStop(bot: LiveHuntBot): HuntRouteStop {
  const route = bot.spawn.route;
  if (route.length < 2) throw new Error(`Hunt spawn ${bot.spawn.id} route is too short`);
  bot.routeIndex = (bot.routeIndex + 1) % route.length;
  const stop = route[bot.routeIndex];
  if (!stop) throw new Error(`Hunt spawn ${bot.spawn.id} route stop ${bot.routeIndex} is missing`);
  return stop;
}

function setDest(bot: LiveHuntBot, dest: HuntMaskPoint, now: number): void {
  const here = currentPos(bot, now);
  bot.x = here.x;
  bot.y = here.y;
  bot.destX = dest.x;
  bot.destY = dest.y;
  bot.walkStartedAt = now;
  const distance = Math.hypot(dest.x - bot.x, dest.y - bot.y);
  bot.walkDurationMs = Math.max(
    HUNT_MIN_WALK_MS,
    (distance / huntWalkSpeedPxPerSec(bot.spawn.huntSpeed)) * 1000,
  );
  bot.phase = distance < HUNT_NEAR_DEST_PX ? "wait" : "walk";
  if (bot.phase === "wait") {
    bot.x = dest.x;
    bot.y = dest.y;
  }
}

function resetToHome(bot: LiveHuntBot): void {
  bot.x = bot.spawn.x;
  bot.y = bot.spawn.y;
  bot.destX = bot.x;
  bot.destY = bot.y;
  bot.routeIndex = bot.spawn.route.length >= 2 ? -1 : 0;
}

function arrivalWaitMs(bot: LiveHuntBot, random: HuntRandom): number {
  if (bot.spawn.route.length >= 2) {
    const stop = bot.spawn.route[bot.routeIndex];
    if (!stop) {
      throw new Error(`Hunt spawn ${bot.spawn.id} route stop ${bot.routeIndex} is missing`);
    }
    return waitMs(stop.waitMin, stop.waitMax, random);
  }
  return waitMs(bot.spawn.waitMin, bot.spawn.waitMax, random);
}

function waitMs(minSec: number, maxSec: number, random: HuntRandom): number {
  return random.integer(minSec, maxSec) * 1000;
}

function randomPointInPolygon(poly: readonly HuntMaskPoint[], random: HuntRandom): HuntMaskPoint {
  if (poly.length < 3) throw new Error("Hunt zone polygon must have at least 3 points");
  let minX = poly[0]!.x;
  let maxX = poly[0]!.x;
  let minY = poly[0]!.y;
  let maxY = poly[0]!.y;
  for (const point of poly) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  for (let i = 0; i < HUNT_ZONE_SAMPLE_ATTEMPTS; i++) {
    const x = minX + random.unit() * (maxX - minX);
    const y = minY + random.unit() * (maxY - minY);
    if (pointInPolygon(x, y, poly)) return { x: Math.round(x), y: Math.round(y) };
  }
  return polygonCentroid(poly);
}

function pointInPolygon(x: number, y: number, poly: readonly HuntMaskPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.x;
    const yi = poly[i]!.y;
    const xj = poly[j]!.x;
    const yj = poly[j]!.y;
    const hit = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0000001) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function polygonCentroid(poly: readonly HuntMaskPoint[]): HuntMaskPoint {
  if (poly.length === 0) throw new Error("Hunt zone polygon is empty");
  let x = 0;
  let y = 0;
  for (const point of poly) {
    x += point.x;
    y += point.y;
  }
  return { x: Math.round(x / poly.length), y: Math.round(y / poly.length) };
}
