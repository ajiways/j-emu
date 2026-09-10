export type HuntMaskPoint = Readonly<{
  x: number;
  y: number;
}>;

export type HuntRouteStop = Readonly<{
  x: number;
  y: number;
  waitMin: number;
  waitMax: number;
}>;

export type HuntSpawnMotion = Readonly<{
  huntSpeed: number;
  waitMin: number;
  waitMax: number;
  respawnTimeMin: number;
  respawnTimeMax: number;
  zone: readonly HuntMaskPoint[];
  route: readonly HuntRouteStop[];
}>;

export class HuntSpawn {
  readonly huntSpeed: number;
  readonly waitMin: number;
  readonly waitMax: number;
  readonly respawnTimeMin: number;
  readonly respawnTimeMax: number;
  readonly zone: readonly HuntMaskPoint[];
  readonly route: readonly HuntRouteStop[];

  constructor(
    readonly id: number,
    readonly botId: number,
    readonly x: number,
    readonly y: number,
    readonly huntMask: string,
    motion: HuntSpawnMotion,
  ) {
    if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid hunt spawn id");
    if (!Number.isInteger(botId) || botId <= 0) throw new Error("Invalid hunt spawn bot id");
    if (!huntMask) throw new Error(`Hunt spawn ${id} is missing hunt_mask`);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`Hunt spawn ${id} home position is invalid`);
    }
    this.huntSpeed = requireSpeed(id, motion.huntSpeed);
    this.waitMin = requireRange(id, "wait", motion.waitMin, motion.waitMax).min;
    this.waitMax = requireRange(id, "wait", motion.waitMin, motion.waitMax).max;
    this.respawnTimeMin = requireRange(
      id,
      "respawn",
      motion.respawnTimeMin,
      motion.respawnTimeMax,
    ).min;
    this.respawnTimeMax = requireRange(
      id,
      "respawn",
      motion.respawnTimeMin,
      motion.respawnTimeMax,
    ).max;
    this.zone = requireZone(id, motion.zone);
    this.route = requireRoute(id, motion.route);
    if (this.zone.length >= 3 && this.route.length >= 2) {
      throw new Error(`Hunt spawn ${id} cannot author both a route and a zone`);
    }
  }
}

function requireSpeed(spawnId: number, huntSpeed: number): number {
  if (!Number.isInteger(huntSpeed) || huntSpeed < 0) {
    throw new Error(`Hunt spawn ${spawnId} hunt speed is invalid`);
  }
  return huntSpeed;
}

function requireRange(
  spawnId: number,
  label: string,
  min: number,
  max: number,
): { min: number; max: number } {
  if (!Number.isInteger(min) || min < 0) {
    throw new Error(`Hunt spawn ${spawnId} ${label} min is invalid`);
  }
  if (!Number.isInteger(max) || max < min) {
    throw new Error(`Hunt spawn ${spawnId} ${label} max is invalid`);
  }
  return { min, max };
}

function requireZone(spawnId: number, zone: readonly HuntMaskPoint[]): readonly HuntMaskPoint[] {
  if (!Array.isArray(zone)) throw new Error(`Hunt spawn ${spawnId} zone is invalid`);
  if (zone.length > 0 && zone.length < 3) {
    throw new Error(`Hunt spawn ${spawnId} zone must be empty or have at least 3 points`);
  }
  return zone.map((point) => requirePoint(spawnId, "zone", point));
}

function requireRoute(spawnId: number, route: readonly HuntRouteStop[]): readonly HuntRouteStop[] {
  if (!Array.isArray(route)) throw new Error(`Hunt spawn ${spawnId} route is invalid`);
  if (route.length === 1) {
    throw new Error(`Hunt spawn ${spawnId} route must be empty or have at least 2 stops`);
  }
  return route.map((stop) => {
    const point = requirePoint(spawnId, "route", stop);
    const wait = requireRange(spawnId, "route wait", stop.waitMin, stop.waitMax);
    return { x: point.x, y: point.y, waitMin: wait.min, waitMax: wait.max };
  });
}

function requirePoint(spawnId: number, label: string, point: HuntMaskPoint): HuntMaskPoint {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new Error(`Hunt spawn ${spawnId} ${label} point is invalid`);
  }
  return { x: point.x, y: point.y };
}
