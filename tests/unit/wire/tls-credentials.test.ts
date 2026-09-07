import { constants as cryptoConstants } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TlsCredentials } from "../../../src/modules/jugger-wire/infrastructure/http/tls-credentials.ts";

const fixtureDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../support/tls");

describe("TlsCredentials", () => {
  it("fails when cert.pem or key.pem is missing", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "j-emu-certs-"));
    expect(() => TlsCredentials.load(directory)).toThrow(/TLS certificate or key is missing/);
    fs.writeFileSync(path.join(directory, "cert.pem"), "not-a-cert");
    expect(() => TlsCredentials.load(directory)).toThrow(/TLS certificate or key is missing/);
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("loads legacy CEF TLS options", () => {
    const options = TlsCredentials.load(fixtureDir);
    expect(options.minVersion).toBe("TLSv1");
    expect(options.ciphers).toBe("ALL:@SECLEVEL=0");
    expect(options.honorCipherOrder).toBe(true);
    expect(options.secureOptions).toBe(cryptoConstants.SSL_OP_LEGACY_SERVER_CONNECT);
    expect(Buffer.isBuffer(options.cert)).toBe(true);
    expect(Buffer.isBuffer(options.key)).toBe(true);
  });
});
