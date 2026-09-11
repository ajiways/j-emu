import type { Clock } from "../shared/kernel/clock.ts";
import type { DelayScheduler } from "../shared/kernel/delay-scheduler.ts";
import type { AuctionExpiry } from "./auction-expiry.ts";
import { AuctionTtlSweep } from "./auction-ttl-sweep.ts";
import { FarmSweep } from "./farm-sweep.ts";
import type { InstanceDesk } from "./instance-desk.ts";
import { InstanceTtlSweep } from "./instance-ttl-sweep.ts";
import { MailTtlSweep } from "./mail-ttl-sweep.ts";
import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { MailService } from "../modules/mail/application/mail-service.ts";
import type { ProfessionsService } from "../modules/professions/application/professions-service.ts";
import type { EsrvOutbox } from "../modules/jugger-wire/application/esrv-outbox.ts";

export function startTtlSweeps(input: {
  mail: MailService;
  instanceDesk: InstanceDesk;
  auctionExpiry: Pick<AuctionExpiry, "sweep">;
  professions: ProfessionsService;
  delay: DelayScheduler;
  clock: Clock;
  outbox: EsrvOutbox;
  wake: Readonly<{ wake(accountId: number): void }>;
  characters: CharacterService;
  inventory: InventoryService;
  catalog: Catalog;
}): ReadonlyArray<{ close(): Promise<void> }> {
  const mailSweep = new MailTtlSweep(input.mail, input.delay, input.clock);
  mailSweep.start();
  const instanceSweep = new InstanceTtlSweep(input.instanceDesk, input.delay, input.clock);
  instanceSweep.start();
  const auctionSweep = new AuctionTtlSweep(input.auctionExpiry, input.delay, input.clock);
  auctionSweep.start();
  const farmSweep = new FarmSweep(
    input.professions,
    input.delay,
    input.clock,
    input.outbox,
    input.wake,
    input.characters,
    input.inventory,
    input.catalog,
  );
  farmSweep.start();
  return [mailSweep, instanceSweep, auctionSweep, farmSweep];
}
