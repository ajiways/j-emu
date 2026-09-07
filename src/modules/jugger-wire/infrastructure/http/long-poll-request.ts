import type { FastifyRequest } from "fastify";
import type { LongPollCoordinator } from "../../application/long-poll-coordinator.ts";

export async function waitForLongPoll(
  request: FastifyRequest,
  longPoll: LongPollCoordinator,
  milliseconds: number,
): Promise<void> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.raw.once("aborted", abort);
  try {
    await longPoll.wait(milliseconds, controller.signal);
  } finally {
    request.raw.off("aborted", abort);
  }
}
