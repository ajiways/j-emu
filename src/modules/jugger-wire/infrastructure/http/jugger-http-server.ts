import fastifyCookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";
import { AuthRouteRegistrar } from "./auth-route-registrar.ts";
import { EsrvRouteRegistrar } from "./esrv-route-registrar.ts";
import { FproxyRouteRegistrar } from "./fproxy-route-registrar.ts";
import type { JuggerHttpDependencies } from "./jugger-http-dependencies.ts";
import { ObjectActionRouteRegistrar } from "./object-action-route-registrar.ts";
import { StaticAssetRegistrar } from "./static-asset-registrar.ts";
import { TlsCredentials } from "./tls-credentials.ts";

export class JuggerHttpServer {
  constructor(private readonly dependencies: JuggerHttpDependencies) {}

  async build(): Promise<FastifyInstance> {
    const { config } = this.dependencies;
    const https = config.httpOnly ? undefined : TlsCredentials.load(config.certsDir);
    const app = Fastify({
      logger: { level: config.logLevel },
      bodyLimit: 4 * 1024 * 1024,
      ...(https ? { https } : {}),
    });
    await app.register(fastifyCookie);
    app.addContentTypeParser(
      "application/octet-stream",
      { parseAs: "buffer" },
      (_request, body, done) => done(null, body),
    );
    try {
      await new AuthRouteRegistrar(this.dependencies).register(app);
      await new ObjectActionRouteRegistrar(this.dependencies).register(app);
      await new EsrvRouteRegistrar(this.dependencies).register(app);
      await new FproxyRouteRegistrar(this.dependencies).register(app);
      await new StaticAssetRegistrar(config.pub1Dir).register(app);
      return app;
    } catch (error) {
      await app.close();
      throw error;
    }
  }
}
