import type { UnitOfWork } from "../../../../shared/kernel/unit-of-work.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import type { PresenceFanout } from "../../application/presence-fanout.ts";
import type { ComeInTravel } from "../../../../app/come-in-travel.ts";
import type { InstanceDesk } from "../../../../app/instance-desk.ts";
import type { OaCommand, OaCommandContext, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";
import { InstanceDeniedError } from "../../../instance/domain/instance-denied-error.ts";
import { PartyDeniedError } from "../../../party/domain/party-denied-error.ts";
import { MissingLinkError } from "../../../world/domain/missing-link-error.ts";

type ComeInRequest = Readonly<{ areaId: string }>;

export class ComeInCommand implements OaCommand {
  static readonly key = "common|object:COME_IN";
  readonly key = ComeInCommand.key;

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly bootstrap: BootstrapReadModel,
    private readonly characters: CharacterService,
    private readonly travel: ComeInTravel,
    private readonly presence: PresenceFanout,
    private readonly instances: InstanceDesk,
  ) {}

  decode(envelope: ObjectActionEnvelope): ComeInRequest {
    const form = envelope.form;
    if (!form) throw new ProtocolError(203, "некуда идти");
    const raw = form["area_id"];
    if (typeof raw !== "number" && typeof raw !== "string") {
      throw new ProtocolError(203, "некуда идти");
    }
    const areaId = String(raw);
    if (!areaId) throw new ProtocolError(203, "некуда идти");
    return { areaId };
  }

  async handle(context: OaCommandContext, request: ComeInRequest): Promise<object> {
    try {
      const moved = await this.unitOfWork.run(async () => {
        const locked = await this.characters.lockByAccountId(context.accountId);
        const travel = await this.travel.move(context.accountId, locked, request.areaId);
        const blocks = await this.bootstrap.travelMutation(context.accountId, "COME_IN");
        return {
          fromAreaId: travel.fromAreaId,
          toAreaId: travel.toAreaId,
          fromCopyId: travel.fromCopyId,
          blocks: await this.instances.decorateComeIn(
            blocks,
            travel.plan,
            context.accountId,
            locked.id,
          ),
        };
      });
      await this.presence.afterMove(
        context.accountId,
        moved.fromAreaId,
        moved.toAreaId,
        moved.fromCopyId,
      );
      return moved.blocks;
    } catch (error) {
      throw this.asProtocol(error);
    }
  }

  encode(response: object): OaEncodedResponse {
    return { kind: "flat", blocks: response };
  }

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    try {
      return this.encode(await this.handle({ accountId }, this.decode(envelope)));
    } catch (error) {
      throw this.asProtocol(error);
    }
  }

  private asProtocol(error: unknown): never {
    if (error instanceof MissingLinkError) throw new ProtocolError(203, error.message);
    if (error instanceof InstanceDeniedError) throw new ProtocolError(error.status, error.message);
    if (error instanceof PartyDeniedError) throw new ProtocolError(2, error.message);
    throw error;
  }
}
