import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";

const BOT_FIGHT_ID_MIN = 1_000_000;
const BOT_FIGHT_ID_MAX = 2_147_483_647;

export class EphemeralBotFightIds {
  private next = BOT_FIGHT_ID_MIN;

  allocate(heroId: number): number {
    requireWireIdentity(heroId, "hero id");
    for (;;) {
      const id = this.next;
      this.next += 1;
      if (id > BOT_FIGHT_ID_MAX) throw new Error("Fight bot id range exhausted");
      if (id < BOT_FIGHT_ID_MIN) throw new Error("Fight bot id is below the ephemeral floor");
      if (id === heroId) continue;
      return id;
    }
  }
}
