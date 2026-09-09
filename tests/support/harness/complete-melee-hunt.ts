import type { AuthenticatedClient } from "./authenticated-client.ts";
import { MAP_HUNT_SPAWN_ID } from "./map-hunt-spawn.ts";
import { framesIncludeFightFinish, huntFightIdFrom } from "./wire-payload.ts";

export async function completeMeleeHunt(
  client: AuthenticatedClient,
  sequenceStart = 4,
): Promise<string> {
  const start = await client.objectAction({
    object: "common",
    action: "object",
    form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
    sq: sequenceStart,
  });
  const fightId = huntFightIdFrom(start);
  await finishStartedMeleeHunt(client, fightId, sequenceStart + 1);
  return fightId;
}

async function finishStartedMeleeHunt(
  client: AuthenticatedClient,
  fightId: string,
  sequenceStart: number,
): Promise<void> {
  const authBody = await client.fight({ rc: "auth", eid: fightId, sq: sequenceStart });
  if (authBody.length !== 0) throw new Error("fproxy auth must return an empty body");
  await client.pollFight();
  let finished = false;
  for (let strike = 0; strike < 4 && !finished; strike += 1) {
    const castBody = await client.fight({
      rc: "castSpell",
      srcType: 1,
      srcId: 2,
      sq: sequenceStart + 1 + strike,
    });
    if (castBody.length !== 0) throw new Error("castSpell must return an empty body");
    finished = framesIncludeFightFinish(await client.pollFight());
  }
  if (!finished) throw new Error("Hunt fight did not finish");
}
