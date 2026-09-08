import type { Application } from "../../../src/app/application.ts";
import {
  decodeAmf3,
  encodeAmf3,
  type AmfValue,
} from "../../../src/modules/jugger-wire/amf/amf3.ts";
import { decodeFrames } from "../../../src/modules/jugger-wire/amf/framing.ts";
import { uniqueDevelopmentSlot } from "./unique-development-slot.ts";

export async function createIsolatedHero(
  application: Application,
  slot = uniqueDevelopmentSlot(),
): Promise<AuthenticatedClient> {
  return AuthenticatedClient.login(application, slot);
}

export class AuthenticatedClient {
  constructor(
    private readonly application: Application,
    readonly cookie: string,
  ) {}

  get accountId(): number {
    const match = /(?:^|;\s*)cid=(\d+)/.exec(this.cookie);
    if (!match) throw new Error("cid cookie is missing");
    const accountId = Number(match[1]);
    if (!Number.isInteger(accountId) || accountId < 1) {
      throw new Error("cid cookie is not a wire identity");
    }
    return accountId;
  }

  static async login(
    application: Application,
    slot = uniqueDevelopmentSlot(),
  ): Promise<AuthenticatedClient> {
    const auth = await application.http.inject({
      method: "GET",
      url: `/soc_auth.php?slot=${slot}`,
    });
    if (auth.statusCode !== 302) {
      throw new Error(`soc_auth.php returned ${auth.statusCode}`);
    }
    const location = auth.headers.location;
    if (typeof location !== "string") throw new Error("soc_auth.php did not redirect");
    const game = await application.http.inject({ method: "GET", url: location });
    if (game.statusCode !== 200) {
      throw new Error(`game.php returned ${game.statusCode}`);
    }
    const setCookie = game.headers["set-cookie"];
    if (!setCookie) throw new Error("game.php did not set cookies");
    const values = Array.isArray(setCookie) ? setCookie : [setCookie];
    return new AuthenticatedClient(
      application,
      values.map((value) => value.split(";")[0]).join("; "),
    );
  }

  async objectAction(payload: Record<string, AmfValue>): Promise<Record<string, AmfValue>> {
    const response = await this.application.http.inject({
      method: "POST",
      url: "/entry_point.php",
      headers: { cookie: this.cookie, "content-type": "application/octet-stream" },
      payload: encodeAmf3(payload),
    });
    if (response.statusCode !== 200) {
      throw new Error(`entry_point.php returned ${response.statusCode}`);
    }
    const decoded = decodeAmf3(response.rawPayload);
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
      throw new Error("Object-action response is not an object");
    }
    return decoded;
  }

  async fight(command: Record<string, AmfValue>): Promise<AmfValue[]> {
    return this.postFramed("/fproxy/", encodeAmf3(command));
  }

  async pollFight(): Promise<AmfValue[]> {
    return this.postFramed("/fproxy/", Buffer.alloc(0));
  }

  async pollEsrv(): Promise<AmfValue[]> {
    return this.postFramed("/esrv/poll", Buffer.alloc(0));
  }

  async esrvAuth(): Promise<{ statusCode: number; payload: Buffer }> {
    const response = await this.application.http.inject({
      method: "POST",
      url: "/esrv/auth",
      headers: { cookie: this.cookie, "content-type": "application/octet-stream" },
      payload: encodeAmf3({ rc: "auth", eid: 1 }),
    });
    return { statusCode: response.statusCode, payload: response.rawPayload };
  }

  async logout(): Promise<void> {
    const response = await this.application.http.inject({
      method: "GET",
      url: "/logout",
      headers: { cookie: this.cookie },
    });
    if (response.statusCode !== 302) {
      throw new Error(`/logout returned ${response.statusCode}`);
    }
  }

  private async postFramed(url: string, payload: Buffer): Promise<AmfValue[]> {
    const response = await this.application.http.inject({
      method: "POST",
      url,
      headers: { cookie: this.cookie, "content-type": "application/octet-stream" },
      payload,
    });
    if (response.statusCode !== 200) {
      throw new Error(`${url} returned ${response.statusCode}`);
    }
    return decodeFrames(response.rawPayload);
  }
}
