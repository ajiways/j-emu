import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: [
    "./src/modules/identity/infrastructure/schema.ts",
    "./src/modules/content/infrastructure/schema.ts",
    "./src/modules/catalog/infrastructure/schema.ts",
    "./src/modules/catalog/infrastructure/schema-bot-spell-book.ts",
    "./src/modules/catalog/infrastructure/schema-dungeons.ts",
    "./src/modules/catalog/infrastructure/schema-battlegrounds.ts",
    "./src/modules/catalog/infrastructure/schema-professions.ts",
    "./src/modules/world/infrastructure/schema.ts",
    "./src/modules/battleground/infrastructure/schema.ts",
    "./src/modules/character/infrastructure/schema.ts",
    "./src/modules/inventory/infrastructure/schema.ts",
    "./src/modules/combat/infrastructure/schema.ts",
    "./src/modules/mail/infrastructure/schema.ts",
    "./src/modules/auction/infrastructure/schema.ts",
    "./src/modules/party/infrastructure/schema.ts",
    "./src/modules/instance/infrastructure/schema.ts",
  ],
  out: "./drizzle",
});
