import type { StoreRepair } from "../../../../app/store-repair.ts";
import { StoreDeniedError } from "../../../../app/store-denied-error.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import { RepairDeniedError } from "../../../inventory/domain/repair-denied-error.ts";
import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import type { HeroSheetReadModel } from "../../application/hero-sheet-read-model.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import { storeRepairMutation } from "../../application/store-repair-mutation.ts";
import { bagDiffChanged, bagDiffRemoved } from "../../application/user-bag-diff.ts";
import type { EsrvOutbox } from "../../application/esrv-outbox.ts";
import type { OaCommand, OaCommandContext, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export class StoreRepairCommand implements OaCommand {
  static readonly key = "store|repair";
  readonly key = StoreRepairCommand.key;

  constructor(
    private readonly bootstrap: BootstrapReadModel,
    private readonly sheet: HeroSheetReadModel,
    private readonly characters: CharacterService,
    private readonly repair: StoreRepair,
    private readonly outbox: EsrvOutbox,
    private readonly wake: Readonly<{ wake(accountId: number): void }>,
  ) {}

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    try {
      return this.encode(await this.handle({ accountId }, envelope));
    } catch (error) {
      if (error instanceof StoreDeniedError) {
        return { kind: "nested", value: { status: 2, error: error.message } };
      }
      if (error instanceof RepairDeniedError) throw new ProtocolError(203, error.message);
      throw error;
    }
  }

  private async handle(context: OaCommandContext, envelope: ObjectActionEnvelope): Promise<object> {
    const hero = await this.characters.getByAccountId(context.accountId);
    if (!hero) throw new Error(`Hero for account ${context.accountId} is missing`);
    const itemId = repairItemIdFrom(envelope);
    await this.repair.repair({
      characterId: hero.id,
      itemId,
    });
    const bag = await this.bootstrap.bag(context.accountId);
    const repaired = bag.bag[String(itemId)];
    if (repaired) {
      this.outbox.enqueue(context.accountId, bagDiffRemoved(itemId));
      this.outbox.enqueue(context.accountId, bagDiffChanged(repaired));
      this.wake.wake(context.accountId);
    }
    return storeRepairMutation(
      bag,
      await this.bootstrap.view(context.accountId),
      this.sheet.magic(),
      await this.bootstrap.state(context.accountId),
    );
  }

  private encode(response: object): OaEncodedResponse {
    return { kind: "flat", blocks: response };
  }
}

function repairItemIdFrom(envelope: ObjectActionEnvelope): number {
  const form = envelope.form;
  if (!form) throw new RepairDeniedError();
  const raw = form["id"];
  if (typeof raw !== "number" && typeof raw !== "string") throw new RepairDeniedError();
  const itemId = Number(raw);
  if (!Number.isInteger(itemId) || itemId < 1) throw new RepairDeniedError();
  return itemId;
}
