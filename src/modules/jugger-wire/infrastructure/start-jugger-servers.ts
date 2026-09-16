import type { FastifyInstance } from "fastify";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { QuestCatalog } from "../../quests/ports/quest-catalog.ts";
import type { WorldService } from "../../world/domain/world-service.ts";
import type { Clock } from "../../../shared/kernel/clock.ts";
import type { InstanceHuntWorld } from "../../instance/ports/instance-hunt.ts";
import type { BootstrapReadModel } from "../application/bootstrap-read-model.ts";
import { EsrvPollAssembler } from "../application/esrv-poll-assembler.ts";
import type { EsrvOutbox } from "../application/esrv-outbox.ts";
import { HeroHudPush } from "../application/hero-hud-push.ts";
import type { FightWireMapper } from "../application/fight-wire-mapper.ts";
import type { FproxyCommandRegistry } from "../registry/fproxy-command-registry.ts";
import { JuggerHttpServer } from "./http/jugger-http-server.ts";
import type { JuggerHttpDependencies } from "./http/jugger-http-dependencies.ts";
import { FightTcpServer } from "./tcp/fight-tcp-server.ts";

export async function startJuggerServers(
  input: Omit<JuggerHttpDependencies, "esrvPoll" | "heroHud"> & {
    catalog: Catalog;
    world: WorldService;
    clock: Clock;
    outbox: EsrvOutbox;
    instanceHunt: InstanceHuntWorld;
    questCatalog: QuestCatalog;
    fproxy: FproxyCommandRegistry;
    fightWire: FightWireMapper;
    bootstrap: BootstrapReadModel;
  },
): Promise<{ http: FastifyInstance; fightTcp: FightTcpServer }> {
  const heroHud = new HeroHudPush(
    input.unitOfWork,
    input.characters,
    input.catalog,
    input.bootstrap,
    input.outbox,
    input.longPoll,
  );
  const esrvPoll = new EsrvPollAssembler(
    input.characters,
    input.world,
    input.catalog,
    input.combat,
    input.fightWire,
    input.outbox,
    input.clock,
    input.instanceHunt,
    input.questCatalog,
    heroHud,
  );
  const http = await new JuggerHttpServer({ ...input, esrvPoll, heroHud }).build();
  const fightTcp = new FightTcpServer(
    input.combat,
    input.fproxy,
    input.fightWire,
    input.longPoll,
    http.log,
  );
  try {
    await fightTcp.listen(input.config.host, input.config.fightProxyPort);
  } catch (error) {
    await http.close();
    throw error;
  }
  return { http, fightTcp };
}
