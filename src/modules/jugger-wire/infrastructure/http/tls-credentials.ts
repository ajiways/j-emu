import fs from "node:fs";
import path from "node:path";

export class TlsCredentials {
  static load(certsDir: string): { cert: Buffer; key: Buffer } {
    const certPath = path.join(certsDir, "cert.pem");
    const keyPath = path.join(certsDir, "key.pem");
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      throw new Error(`TLS certificate or key is missing in ${certsDir}`);
    }
    return { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) };
  }
}
