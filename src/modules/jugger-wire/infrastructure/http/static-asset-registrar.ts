import fs from "node:fs";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

export class StaticAssetRegistrar {
  constructor(private readonly pub1Dir: string) {}

  async register(app: FastifyInstance): Promise<void> {
    if (!fs.existsSync(this.pub1Dir)) {
      throw new Error(`Pub1 directory does not exist: ${this.pub1Dir}`);
    }
    await app.register(fastifyStatic, {
      root: this.pub1Dir,
      prefix: "/",
      decorateReply: false,
      index: false,
    });
  }
}
