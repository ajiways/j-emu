import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../character/application/character-service.ts";
import type { CombatPort } from "../../combat/ports/combat-port.ts";
import type { Clock } from "../../../shared/kernel/clock.ts";
import type { WorldService } from "../../world/domain/world-service.ts";
import { areaEsrvChannel, personalEsrvChannel } from "./esrv-channel.ts";
import type { EsrvOutbox, EsrvOutboxEntry } from "./esrv-outbox.ts";
import type { FightWireMapper } from "./fight-wire-mapper.ts";
import type { HeroHudPush } from "./hero-hud-push.ts";
import { isUnmergedEsrvFragment } from "./esrv-chat-only-fragment.ts";
import type { InstanceHuntWorld } from "../../instance/ports/instance-hunt.ts";
import type { QuestCatalog } from "../../quests/ports/quest-catalog.ts";
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
    private readonly instanceHunt: InstanceHuntWorld,
    private readonly quests: QuestCatalog,
    private readonly hud: HeroHudPush,
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
    const location = await locationAreaBlocks(
      this.world,
      this.catalog,
      hero,
      this.clock,
      this.instanceHunt,
      this.quests,
    );
    const ctime = this.clock.unixSeconds();
    const frames: EsrvFrame[] = [
      {
        channel: areaEsrvChannel(hero.areaId),
        ctime,
        object: { "common|hunt": location.hunt },
      },
    ];
    const personal = personalEsrvChannel(accountId);
    const pending = new Map<string, Record<string, unknown>>();
    for (const entry of this.outbox.take(accountId)) {
      appendOutboxEntry(frames, pending, entry, personal, ctime);
    }
    const loot = await this.combat.takeLoot(accountId);
    if (loot) mergeChannel(pending, personal, { "fight|loot": loot });
    const exit = await this.combat.takeExit(accountId);
    if (exit) mergeChannel(pending, personal, { "fight|exit": this.fightWire.exit(exit) });
    if (loot || exit) mergeChannel(pending, personal, await this.hud.fragment(accountId));
    flushChannel(frames, pending, personal, ctime);
    for (const channel of pending.keys()) {
      flushChannel(frames, pending, channel, ctime);
    }
    return frames;
  }
}

function appendOutboxEntry(
  frames: EsrvFrame[],
  pending: Map<string, Record<string, unknown>>,
  entry: EsrvOutboxEntry,
  personal: string,
  ctime: number,
): void {
  const channel = entry.channel ?? personal;
  if (isUnmergedEsrvFragment(entry.fragment)) {
    // Keep pending personal merges open; fight-end chat/unitframe must not
    // split dungeon instance_conf away from fight|loot.
    frames.push({ channel, ctime, object: entry.fragment });
    return;
  }
  mergeChannel(pending, channel, entry.fragment);
}

function mergeChannel(
  pending: Map<string, Record<string, unknown>>,
  channel: string,
  fragment: object,
): void {
  const bucket = pending.get(channel) ?? {};
  Object.assign(bucket, fragment);
  pending.set(channel, bucket);
}

function flushChannel(
  frames: EsrvFrame[],
  pending: Map<string, Record<string, unknown>>,
  channel: string,
  ctime: number,
): void {
  const object = pending.get(channel);
  if (!object || Object.keys(object).length === 0) return;
  pending.delete(channel);
  frames.push({ channel, ctime, object });
}
