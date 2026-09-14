import type { AmfValue } from "../../../src/modules/jugger-wire/amf/amf3.ts";
import type { AuthenticatedClient } from "./authenticated-client.ts";
import { MAP_HUNT_SPAWN_ID } from "./map-hunt-spawn.ts";
import {
  bagItemByArtikulId,
  fightEventTypes,
  framesIncludeFightFinish,
  huntFightIdFrom,
} from "./wire-payload.ts";

const STARTER_GLOVE_ARTIKUL = 9095;
const MAX_MELEE_STRIKES = 40;

export async function completeMeleeHunt(
  client: AuthenticatedClient,
  elapse: (ms: number) => Promise<void>,
  sequenceStart = 4,
  options: Readonly<{ equipGlove?: boolean }> = {},
): Promise<string> {
  let sq = sequenceStart;
  if (options.equipGlove !== false) {
    sq = await putOnStarterGloveIfInBag(client, sq);
  }
  const start = await client.objectAction({
    object: "common",
    action: "object",
    form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
    sq,
  });
  const fightId = huntFightIdFrom(start);
  await finishStartedMeleeHunt(client, fightId, elapse, sq + 1);
  return fightId;
}

export async function finishStartedMeleeHunt(
  client: AuthenticatedClient,
  fightId: string,
  elapse: (ms: number) => Promise<void>,
  sequenceStart: number,
  maxStrikes = MAX_MELEE_STRIKES,
): Promise<void> {
  const authBody = await client.fight({ rc: "auth", eid: fightId, sq: sequenceStart });
  if (authBody.length !== 0) throw new Error("fproxy auth must return an empty body");
  await client.pollFight();
  await strikeUntilHuntFinish(client, elapse, sequenceStart + 1, undefined, undefined, maxStrikes);
}

export async function strikeUntilHuntFinish(
  opener: AuthenticatedClient,
  elapse: (ms: number) => Promise<void>,
  sequenceStart: number,
  joiner?: AuthenticatedClient,
  collect?: (frames: readonly AmfValue[]) => void,
  maxStrikes = MAX_MELEE_STRIKES,
): Promise<void> {
  let striker = opener;
  let finished = false;
  for (let strike = 0; strike < maxStrikes && !finished; strike += 1) {
    const castBody = await striker.fight({
      rc: "castSpell",
      srcType: 1,
      srcId: 2,
      sq: sequenceStart + strike,
    });
    if (castBody.length !== 0) throw new Error("castSpell must return an empty body");
    const melee = await striker.pollFight();
    collect?.(melee);
    if (framesIncludeFightFinish(melee)) {
      finished = true;
      break;
    }
    await elapse(1400);
    const bot = await striker.pollFight();
    collect?.(bot);
    const other = joiner && striker === opener ? joiner : opener;
    const otherFrames = joiner ? await other.pollFight() : [];
    collect?.(otherFrames);
    if (framesIncludeFightFinish(bot) || framesIncludeFightFinish(otherFrames)) {
      finished = true;
      break;
    }
    const handedOff =
      fightEventTypes(bot).includes("oppwait") || fightEventTypes(otherFrames).includes("oppnew");
    if (joiner && handedOff) {
      await elapse(2500);
      collect?.(await other.pollFight());
      striker = other;
      continue;
    }
    await elapse(1100);
    const after = await striker.pollFight();
    collect?.(after);
    if (framesIncludeFightFinish(after)) finished = true;
  }
  if (!finished) throw new Error("Hunt fight did not finish");
}

/** Human↔human: each melee hit grants the opponent after `turnGrantDelayMs`. */
export async function strikeUntilPvpFinish(
  opener: AuthenticatedClient,
  opponent: AuthenticatedClient,
  elapse: (ms: number) => Promise<void>,
  sequenceStart: number,
  collect?: (frames: readonly AmfValue[]) => void,
  maxStrikes = MAX_MELEE_STRIKES,
): Promise<void> {
  let striker = opener;
  let other = opponent;
  let finished = false;
  for (let strike = 0; strike < maxStrikes && !finished; strike += 1) {
    const castBody = await striker.fight({
      rc: "castSpell",
      srcType: 1,
      srcId: 2,
      sq: sequenceStart + strike,
    });
    if (castBody.length !== 0) throw new Error("castSpell must return an empty body");
    const melee = await striker.pollFight();
    collect?.(melee);
    if (framesIncludeFightFinish(melee)) {
      finished = true;
      break;
    }
    await elapse(2500);
    const otherFrames = await other.pollFight();
    collect?.(otherFrames);
    const strikerFrames = await striker.pollFight();
    collect?.(strikerFrames);
    if (framesIncludeFightFinish(otherFrames) || framesIncludeFightFinish(strikerFrames)) {
      finished = true;
      break;
    }
    if (fightEventTypes(otherFrames).includes("attacknow")) {
      const next = other;
      other = striker;
      striker = next;
    }
  }
  if (!finished) throw new Error("Hunt fight did not finish");
}

export async function putOnStarterGloveIfInBag(
  client: AuthenticatedClient,
  sq: number,
): Promise<number> {
  const bag = await client.objectAction({ object: "user", action: "bag", sq });
  let itemId: number | null = null;
  try {
    const glove = bagItemByArtikulId(bag, STARTER_GLOVE_ARTIKUL);
    itemId = typeof glove.id === "number" ? glove.id : null;
  } catch {
    itemId = null;
  }
  if (itemId === null) return sq + 1;
  await client.objectAction({
    object: "common",
    action: "object",
    form: { code: "PUT_ON", artifact_id: itemId },
    sq: sq + 1,
  });
  return sq + 2;
}
