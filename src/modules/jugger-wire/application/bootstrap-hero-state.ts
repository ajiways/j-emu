import type { CombatPort } from "../../combat/ports/combat-port.ts";
import type { Hero } from "../../character/domain/hero.ts";
import type { Clock } from "../../../shared/kernel/clock.ts";
import type { WorldService } from "../../world/domain/world-service.ts";
import type { UnreadMailQuery } from "../../mail/ports/unread-mail.ts";
import { buildHeroState, type HeroStateBlock } from "./hero-state-block.ts";
import { numericFightId } from "./numeric-fight-id.ts";

export async function bootstrapHeroState(input: {
  hero: Hero;
  accountId: number;
  combat: CombatPort;
  world: WorldService;
  clock: Clock;
  unreadMail: UnreadMailQuery;
}): Promise<HeroStateBlock> {
  const fightId = numericFightId(await input.combat.activeFightId(input.accountId));
  const area = await input.world.area(input.hero.areaId);
  const unread = await input.unreadMail.hasUnread(input.hero.id);
  return buildHeroState(input.hero, input.clock, {
    fightId,
    resurrectZoneTitle: area.title,
    newMessage: unread ? 1 : 0,
  });
}

export async function bootstrapFightId(
  combat: CombatPort,
  accountId: number,
): Promise<number | null> {
  return numericFightId(await combat.activeFightId(accountId));
}
