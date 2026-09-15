import { randomInt } from "node:crypto";
import { loadPackageEnv } from "../src/infrastructure/load-package-env.ts";
import { decodeAmf3, encodeAmf3 } from "../src/modules/jugger-wire/amf/amf3.ts";

loadPackageEnv(import.meta.url);

const port = process.env.PORT;
if (!port) throw new Error("PORT is required");
const baseUrl = `http://127.0.0.1:${port}`;
const slot = randomInt(1, 2_147_483_647);

const auth = await fetch(`${baseUrl}/soc_auth.php?slot=${slot}`, { redirect: "manual" });
if (auth.status !== 302) {
  throw new Error(`soc_auth.php returned ${auth.status}: ${await auth.text()}`);
}
const location = auth.headers.get("location");
if (!location) throw new Error("soc_auth.php did not redirect");
const gameUrl = new URL(location, baseUrl);

const game = await fetch(gameUrl, { redirect: "manual" });
if (game.status !== 200) {
  throw new Error(`game.php returned ${game.status}: ${await game.text()}`);
}
const cookie = game.headers
  .getSetCookie()
  .map((value) => {
    const pair = value.split(";")[0];
    if (!pair) throw new Error("game.php Set-Cookie is missing a name=value pair");
    return pair;
  })
  .join("; ");
if (!cookie) throw new Error("game.php did not set cookies");

const initResponse = await fetch(`${baseUrl}/entry_point.php`, {
  method: "POST",
  headers: { cookie, "content-type": "application/octet-stream" },
  body: new Uint8Array(encodeAmf3({ object: "common", action: "init", sq: 1 })),
});
if (initResponse.status !== 200) {
  throw new Error(`entry_point.php returned ${initResponse.status}`);
}
const decoded = decodeAmf3(Buffer.from(await initResponse.arrayBuffer()));
if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
  throw new Error("init response is not an object");
}
const conf = decoded["user|conf"];
if (!conf || typeof conf !== "object" || Array.isArray(conf)) {
  throw new Error("user|conf is missing");
}
if (typeof conf.id !== "number" || !Number.isInteger(conf.id) || conf.id < 1) {
  throw new Error("user|conf.id is not a wire identity");
}

process.stdout.write(`${conf.id}\n`);
