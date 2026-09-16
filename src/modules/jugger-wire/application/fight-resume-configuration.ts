import type { Hero } from "../../character/domain/hero.ts";
import type { FightStart } from "../../combat/ports/combat-port.ts";
import { heroFightConfLook } from "./hero-fight-appearance.ts";
import type { FightConfigurationBlock, FightWireMapper } from "./fight-wire-mapper.ts";
import { pvpFightWireOverlay } from "./pvp-fight-wire-overlay.ts";

export function fightResumeConfiguration(
  fightWire: FightWireMapper,
  resume: FightStart,
  hero: Hero,
): FightConfigurationBlock {
  const look = heroFightConfLook(hero);
  if (resume.purpose === "pvp") {
    return fightWire.pvpConfiguration(resume, { ...pvpFightWireOverlay(resume), ...look });
  }
  return fightWire.fightConfiguration(resume, {
    ...look,
    ...(hero.instanceCopyId === null
      ? {}
      : { canLeave: 0, instanceId: String(hero.instanceCopyId) }),
  });
}
