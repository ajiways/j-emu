import fastifyCookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";
import { AuthRouteRegistrar } from "./auth-route-registrar.ts";
import { EsrvRouteRegistrar } from "./esrv-route-registrar.ts";
import { FproxyRouteRegistrar } from "./fproxy-route-registrar.ts";
import type { JuggerHttpDependencies } from "./jugger-http-dependencies.ts";
import { ObjectActionRouteRegistrar } from "./object-action-route-registrar.ts";
import { OperatorAuthPolicy } from "../../../content/application/operator-auth-policy.ts";
import { OperatorContentRouteRegistrar } from "./operator-content-route-registrar.ts";
import { OperatorHeroRouteRegistrar } from "./operator-hero-route-registrar.ts";
import { OperatorCatalogRouteRegistrar } from "./operator-catalog-route-registrar.ts";
import { HeroOperator } from "../../application/hero-operator.ts";
import { CatalogOperator } from "../../application/catalog-operator.ts";
import { FightInfoRouteRegistrar } from "./fight-info-route-registrar.ts";
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
    // Flash URLRequest POST defaults to application/x-www-form-urlencoded and
    // may omit Content-Type. AMF routes must read a raw Buffer regardless.
    // Fastify's default JSON/text parsers would steal application/json from
    // the catch-all, so operator /operator/content and /operator/hero would see an object.
    app.removeContentTypeParser(["application/json", "text/plain"]);
    app.addContentTypeParser("*", { parseAs: "buffer" }, (_request, body, done) =>
      done(null, body),
    );
    try {
      await new AuthRouteRegistrar(this.dependencies).register(app);
      await new ObjectActionRouteRegistrar(this.dependencies).register(app);
      const operatorAuth = new OperatorAuthPolicy(this.dependencies.config.contentOperatorToken);
      await new OperatorContentRouteRegistrar(
        this.dependencies.contentEditor,
        operatorAuth,
      ).register(app);
      await new OperatorHeroRouteRegistrar(
        new HeroOperator(
          this.dependencies.unitOfWork,
          this.dependencies.characters,
          this.dependencies.inventory,
        ),
        operatorAuth,
      ).register(app);
      await new OperatorCatalogRouteRegistrar(
        new CatalogOperator(this.dependencies.catalog),
        operatorAuth,
      ).register(app);
      await new EsrvRouteRegistrar(this.dependencies).register(app);
      await new FproxyRouteRegistrar(this.dependencies).register(app);
      await new FightInfoRouteRegistrar(this.dependencies.combat).register(app);
      await new StaticAssetRegistrar(config.pub1Dir).register(app);
      return app;
    } catch (error) {
      await app.close();
      throw error;
    }
  }
}
