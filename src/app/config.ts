import path from "node:path";
import { z } from "zod";

const schema = z.object({
  HOST: z.string().min(1),
  PORT: z.coerce.number().int().positive(),
  HTTP_ONLY: z.enum(["0", "1"]),
  DATABASE_URL: z.string().min(1),
  PUB1_DIR: z.string().min(1),
  CERTS_DIR: z.string().min(1),
  ESRV_POLL_MS: z.coerce.number().int().positive(),
  FPROXY_POLL_MS: z.coerce.number().int().positive(),
  LOG_LEVEL: z.string().min(1),
  GAME_POLICY_FILE: z.string().min(1),
  FIGHT_PROXY_HOST: z.string().min(1),
  FIGHT_PROXY_PATH: z.string().min(1),
  FIGHT_PROXY_PORT: z.coerce.number().int().positive(),
  CONTENT_OPERATOR_TOKEN: z.string().min(1),
});

export type AppConfig = {
  host: string;
  port: number;
  httpOnly: boolean;
  databaseUrl: string;
  pub1Dir: string;
  certsDir: string;
  esrvPollMs: number;
  fproxyPollMs: number;
  logLevel: string;
  gamePolicyFile: string;
  fightProxyHost: string;
  fightProxyPath: string;
  fightProxyPort: number;
  contentOperatorToken: string;
};

export function loadConfig(
  environment: Record<string, string | undefined> = process.env,
  root = process.cwd(),
): AppConfig {
  const value = schema.parse(environment);
  return {
    host: value.HOST,
    port: value.PORT,
    httpOnly: value.HTTP_ONLY === "1",
    databaseUrl: value.DATABASE_URL,
    pub1Dir: path.resolve(root, value.PUB1_DIR),
    certsDir: path.resolve(root, value.CERTS_DIR),
    esrvPollMs: value.ESRV_POLL_MS,
    fproxyPollMs: value.FPROXY_POLL_MS,
    logLevel: value.LOG_LEVEL,
    gamePolicyFile: path.resolve(root, value.GAME_POLICY_FILE),
    fightProxyHost: value.FIGHT_PROXY_HOST,
    fightProxyPath: value.FIGHT_PROXY_PATH,
    fightProxyPort: value.FIGHT_PROXY_PORT,
    contentOperatorToken: value.CONTENT_OPERATOR_TOKEN,
  };
}
