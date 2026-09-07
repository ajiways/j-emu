import { constants as cryptoConstants } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { SecureVersion } from "node:tls";

export class TlsCredentials {
  static load(certsDir: string): {
    cert: Buffer;
    key: Buffer;
    minVersion: SecureVersion;
    ciphers: string;
    honorCipherOrder: boolean;
    secureOptions: number;
  } {
    const certPath = path.join(certsDir, "cert.pem");
    const keyPath = path.join(certsDir, "key.pem");
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      throw new Error(`TLS certificate or key is missing in ${certsDir}`);
    }
    return {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
      minVersion: "TLSv1",
      ciphers: "ALL:@SECLEVEL=0",
      honorCipherOrder: true,
      secureOptions: cryptoConstants.SSL_OP_LEGACY_SERVER_CONNECT,
    };
  }
}
