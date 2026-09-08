import type { FastifyRequest } from "fastify";
import type { LongPollCoordinator } from "../../application/long-poll-coordinator.ts";

export async function waitForLongPoll(
  request: FastifyRequest,
  longPoll: LongPollCoordinator,
  milliseconds: number,
  accountId?: number,
): Promise<void> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.raw.once("aborted", abort);
  try {
    await longPoll.wait(milliseconds, controller.signal, accountId);
  } finally {
    request.raw.off("aborted", abort);
  }
}
