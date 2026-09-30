import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseFightScenario, type FightScenario } from "./fight-scenario.ts";

const SCENARIO_NAME = /^[a-z0-9][a-z0-9-]*$/;

/** Scripted fight scenarios for manual testing, read once at startup from one JSON file each. */
export class FightScenarioCatalog {
  private constructor(private readonly byName: ReadonlyMap<string, FightScenario>) {}

  static load(directory: string): FightScenarioCatalog {
    const scenarios = new Map<string, FightScenario>();
    for (const file of readdirSync(directory).sort()) {
      if (!file.endsWith(".json")) continue;
      const name = file.slice(0, -".json".length);
      if (!SCENARIO_NAME.test(name)) {
        throw new Error(`Fight scenario file ${file} must be named in lowercase kebab-case`);
      }
      const text = readFileSync(path.join(directory, file), "utf8");
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Fight scenario ${file} is not valid JSON: ${reason}`);
      }
      scenarios.set(name, parseFightScenario(name, raw));
    }
    return new FightScenarioCatalog(scenarios);
  }

  names(): readonly string[] {
    return [...this.byName.keys()];
  }

  find(name: string): FightScenario | null {
    return this.byName.get(name) ?? null;
  }

  describe(): readonly Readonly<{ name: string; description: string }>[] {
    return [...this.byName.values()].map((scenario) => ({
      name: scenario.name,
      description: scenario.description,
    }));
  }
}
