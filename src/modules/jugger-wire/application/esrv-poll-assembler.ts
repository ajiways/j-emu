import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../character/application/character-service.ts";
import type { CombatPort } from "../../combat/ports/combat-port.ts";
import type { Clock } from "../../../shared/kernel/clock.ts";
import type { WorldService } from "../../world/domain/world-service.ts";
import { areaEsrvChannel, personalEsrvChannel } from "./esrv-channel.ts";
import type { EsrvOutbox } from "./esrv-outbox.ts";
import type { FightWireMapper } from "./fight-wire-mapper.ts";
import { isChatOnlyFragment } from "./esrv-chat-only-fragment.ts";
import { locationAreaBlocks } from "./location-area-read.ts";

type EsrvFrame = Readonly<{
  channel: string;
  ctime: number;
  object: object;
}>;

export class EsrvPollAssembler {
  constructor(
    private readonly characters: CharacterService,
    private readonly world: WorldService,
    private readonly catalog: Catalog,
    private readonly combat: CombatPort,
    private readonly fightWire: FightWireMapper,
    private readonly outbox: EsrvOutbox,
    private readonly clock: Clock,
  ) {}

  async hasImmediateWork(accountId: number): Promise<boolean> {
    if (this.outbox.peek(accountId)) return true;
    return (
      (await this.combat.peekLoot(accountId)) !== null ||
      (await this.combat.peekExit(accountId)) !== null
    );
  }

  async assemble(accountId: number): Promise<readonly EsrvFrame[]> {
    const hero = await this.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    const location = await locationAreaBlocks(this.world, this.catalog, hero, this.clock);
    const ctime = this.clock.unixSeconds();
    const frames: EsrvFrame[] = [
      {
        channel: areaEsrvChannel(hero.areaId),
        ctime,
        object: { "common|hunt": location.hunt },
      },
    ];
    const personal: Record<string, unknown> = {};
    for (const fragment of this.outbox.take(accountId)) {
      if (isChatOnlyFragment(fragment)) {
        frames.push({
          channel: personalEsrvChannel(accountId),
          ctime,
          object: fragment,
        });
        continue;
      }
      Object.assign(personal, fragment);
    }
    const loot = await this.combat.takeLoot(accountId);
    if (loot) personal["fight|loot"] = loot;
    const exit = await this.combat.takeExit(accountId);
    if (exit) personal["fight|exit"] = this.fightWire.exit(exit);
    if (Object.keys(personal).length > 0) {
      frames.push({
        channel: personalEsrvChannel(accountId),
        ctime,
        object: personal,
      });
    }
    return frames;
  }
}
