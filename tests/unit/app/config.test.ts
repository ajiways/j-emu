import { describe, expect, it } from "vitest";
import { loadConfig } from "../../../src/app/config.ts";

const complete = {
  HOST: "127.0.0.1",
  PORT: "8080",
  HTTP_ONLY: "1",
  DATABASE_URL: "postgres://jemu:jemu@127.0.0.1:5432/jemu",
  PUB1_DIR: "../Pub1",
  CERTS_DIR: "./certs",
  ESRV_POLL_MS: "2500",
  FPROXY_POLL_MS: "2500",
  LOG_LEVEL: "info",
  GAME_POLICY_FILE: "./config/development.json",
  FIGHT_PROXY_HOST: "s1.jugger.ru",
  FIGHT_PROXY_PATH: "/fproxy/",
  FIGHT_PROXY_PORT: "33120",
};

describe("loadConfig", () => {
  it("fails when any required setting is absent", () => {
    expect(() => loadConfig({})).toThrow();
  });

  it("does not invent a database URL", () => {
    expect(() => loadConfig({ ...complete, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  });
});
