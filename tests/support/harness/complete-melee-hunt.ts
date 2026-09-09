import type { AuthenticatedClient } from "./authenticated-client.ts";
import { MAP_HUNT_SPAWN_ID } from "./map-hunt-spawn.ts";
import { framesIncludeFightFinish, huntFightIdFrom } from "./wire-payload.ts";

export async function completeMeleeHunt(
  client: AuthenticatedClient,
  elapse: (ms: number) => Promise<void>,
  sequenceStart = 4,
): Promise<string> {
  const start = await client.objectAction({
    object: "common",
    action: "object",
    form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
    sq: sequenceStart,
  });
  const fightId = huntFightIdFrom(start);
  await finishStartedMeleeHunt(client, fightId, elapse, sequenceStart + 1);
  return fightId;
}

async function finishStartedMeleeHunt(
  client: AuthenticatedClient,
  fightId: string,
  elapse: (ms: number) => Promise<void>,
  sequenceStart: number,
): Promise<void> {
  const authBody = await client.fight({ rc: "auth", eid: fightId, sq: sequenceStart });
  if (authBody.length !== 0) throw new Error("fproxy auth must return an empty body");
  await client.pollFight();
  await strikeUntilHuntFinish(client, elapse, sequenceStart + 1);
}

export async function strikeUntilHuntFinish(
  client: AuthenticatedClient,
  elapse: (ms: number) => Promise<void>,
  sequenceStart: number,
): Promise<void> {
  let finished = false;
  for (let strike = 0; strike < 8 && !finished; strike += 1) {
    const castBody = await client.fight({
      rc: "castSpell",
      srcType: 1,
      srcId: 2,
      sq: sequenceStart + strike,
    });
    if (castBody.length !== 0) throw new Error("castSpell must return an empty body");
    const melee = await client.pollFight();
    if (framesIncludeFightFinish(melee)) {
      finished = true;
      break;
    }
    await elapse(1400);
    const bot = await client.pollFight();
    if (framesIncludeFightFinish(bot)) {
      finished = true;
      break;
    }
    await elapse(1100);
    await client.pollFight();
  }
  if (!finished) throw new Error("Hunt fight did not finish");
}
