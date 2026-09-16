import type { CombatPort } from "../../combat/ports/combat-port.ts";
import type { Hero } from "../../character/domain/hero.ts";
import type { Clock } from "../../../shared/kernel/clock.ts";
import type { WorldService } from "../../world/domain/world-service.ts";
import type { UnreadMailQuery } from "../../mail/ports/unread-mail.ts";
import type { PartyMembershipQuery } from "../../party/ports/party-membership-query.ts";
import { buildHeroState, type HeroStateBlock, type HeroStateOverlay } from "./hero-state-block.ts";
import { ghostResurrectZone } from "./ghost-resurrect-zone.ts";
import { numericFightId } from "./numeric-fight-id.ts";

export async function bootstrapHeroState(input: {
  hero: Hero;
  accountId: number;
  combat: CombatPort;
  world: WorldService;
  clock: Clock;
  unreadMail: UnreadMailQuery;
  party: PartyMembershipQuery;
}): Promise<HeroStateBlock> {
  const fightId = numericFightId(await input.combat.activeFightId(input.accountId));
  const unread = await input.unreadMail.hasUnread(input.hero.id);
  const overlay: HeroStateOverlay = {
    fightId,
    newMessage: unread ? 1 : 0,
    inParty: await input.party.inParty(input.hero.id),
  };
  if (!input.hero.ghost) return buildHeroState(input.hero, input.clock, overlay);
  const zone = await ghostResurrectZone(input.hero, input.world);
  return buildHeroState(input.hero, input.clock, {
    ...overlay,
    resurrectZoneId: zone.id,
    resurrectZoneTitle: zone.title,
  });
}

export async function bootstrapFightId(
  combat: CombatPort,
  accountId: number,
): Promise<number | null> {
  return numericFightId(await combat.activeFightId(accountId));
}
