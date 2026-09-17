import net from "node:net";
import type { CombatPort } from "../../../combat/ports/combat-port.ts";
import { encodePlainFrames } from "../../amf/framing.ts";
import type { FightWireMapper } from "../../application/fight-wire-mapper.ts";
import type { LongPollCoordinator } from "../../application/long-poll-coordinator.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import type { FproxyCommandRegistry } from "../../registry/fproxy-command-registry.ts";
import { FightTcpConnection } from "./fight-tcp-connection.ts";

const POLICY_REQUEST = Buffer.from("<policy-file-request/>");
const POLICY_RESPONSE = Buffer.from(
  '<?xml version="1.0"?>' +
    '<!DOCTYPE cross-domain-policy SYSTEM "http://www.adobe.com/xml/dtds/cross-domain-policy.dtd">' +
    "<cross-domain-policy>" +
    '<allow-access-from domain="*" to-ports="*" />' +
    "</cross-domain-policy>\0",
  "utf8",
);

export class FightTcpServer {
  private readonly server: net.Server;

  constructor(
    private readonly combat: CombatPort,
    private readonly commands: FproxyCommandRegistry,
    private readonly wire: FightWireMapper,
    private readonly longPoll: LongPollCoordinator,
    private readonly log: {
      info(obj: object, msg: string): void;
      error(obj: object, msg: string): void;
    },
  ) {
    this.server = net.createServer((socket) => this.accept(socket));
  }

  listen(host: string, port: number): Promise<void> {
    if (!host) throw new Error("Fight TCP host is required");
    if (!Number.isInteger(port) || port < 0) {
      throw new Error("Fight TCP port must be a non-negative integer");
    }
    return new Promise((resolve, reject) => {
      const onError = (error: Error) => reject(error);
      this.server.once("error", onError);
      this.server.listen(port, host, () => {
        this.server.off("error", onError);
        const address = this.server.address();
        if (!address || typeof address === "string") {
          reject(new Error("Fight TCP server has no listen address"));
          return;
        }
        this.log.info({ host, port: address.port }, "fight_tcp_listen");
        resolve();
      });
    });
  }

  listeningPort(): number {
    const address = this.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Fight TCP server is not listening");
    }
    return address.port;
  }

  async close(): Promise<void> {
    if (!this.server.listening) return;
    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  private accept(socket: net.Socket): void {
    const remote = `${socket.remoteAddress}:${socket.remotePort}`;
    this.log.info({ remote }, "fight_tcp_connect");
    const connection = new FightTcpConnection(this.combat, this.commands, this.wire, this.log);
    let buf: Buffer = Buffer.alloc(0);
    let policyDone = false;
    let queue = Promise.resolve();
    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (!policyDone && buf.includes(POLICY_REQUEST)) {
        socket.write(POLICY_RESPONSE);
        policyDone = true;
        const idx = buf.indexOf(POLICY_REQUEST);
        buf = buf.subarray(idx + POLICY_REQUEST.length);
        if (buf[0] === 0) buf = buf.subarray(1);
        this.log.info({ remote }, "fight_tcp_policy");
      }
      const { frames, rest } = splitLengthPrefixed(buf);
      buf = rest;
      queue = queue
        .then(() => this.handleFrames(socket, connection, frames, remote))
        .catch((error) => {
          const message = error instanceof Error ? error.message : "Unknown non-Error failure";
          this.log.error({ remote, err: message }, "fight_tcp_queue");
        });
    });
    socket.on("error", (error) => {
      this.log.error({ remote, err: error.message }, "fight_tcp_socket_error");
    });
    socket.on("close", () => {
      this.log.info({ remote }, "fight_tcp_close");
    });
  }

  private async handleFrames(
    socket: net.Socket,
    connection: FightTcpConnection,
    frames: readonly Buffer[],
    remote: string,
  ): Promise<void> {
    for (const frame of frames) {
      try {
        const out = await this.dispatch(connection, frame);
        const accountId = connection.authenticatedAccountId;
        if (accountId !== null) this.longPoll.wake(accountId);
        if (out.length) socket.write(out);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown non-Error failure";
        this.log.error({ remote, err: message }, "fight_tcp_frame");
        if (error instanceof ProtocolError) {
          socket.write(encodePlainFrames([{ rs: false, error: message }]));
        }
      }
    }
  }

  private async dispatch(connection: FightTcpConnection, frame: Buffer): Promise<Buffer> {
    if (frame.length <= 1) return connection.poll();
    return connection.receive(frame);
  }
}

function splitLengthPrefixed(buf: Buffer): { frames: Buffer[]; rest: Buffer } {
  const frames: Buffer[] = [];
  let offset = 0;
  while (offset + 4 <= buf.length) {
    const len = buf.readUInt32BE(offset);
    if (len > 4 * 1024 * 1024) break;
    if (offset + 4 + len > buf.length) break;
    frames.push(buf.subarray(offset + 4, offset + 4 + len));
    offset += 4 + len;
  }
  return { frames, rest: Buffer.from(buf.subarray(offset)) };
}
