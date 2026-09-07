import type { AuthenticatedClient } from "./authenticated-client.ts";
import { framesIncludeFightFinish, huntFightIdFrom } from "./wire-payload.ts";

export async function completeMeleeHunt(
  client: AuthenticatedClient,
  sequenceStart = 4,
): Promise<string> {
  const start = await client.objectAction({
    object: "common",
    action: "object",
    form: { code: "ATTACK_BOT", bot_id: 2 },
    sq: sequenceStart,
  });
  const fightId = huntFightIdFrom(start);
  const authBody = await client.fight({ rc: "auth", eid: fightId, sq: sequenceStart + 1 });
  if (authBody.length !== 0) throw new Error("fproxy auth must return an empty body");
  await client.pollFight();
  let finished = false;
  for (let strike = 0; strike < 4 && !finished; strike += 1) {
    const castBody = await client.fight({
      rc: "castSpell",
      srcType: 1,
      srcId: 2,
      sq: sequenceStart + 2 + strike,
    });
    if (castBody.length !== 0) throw new Error("castSpell must return an empty body");
    finished = framesIncludeFightFinish(await client.pollFight());
  }
  if (!finished) throw new Error("Hunt fight did not finish");
  return fightId;
}
