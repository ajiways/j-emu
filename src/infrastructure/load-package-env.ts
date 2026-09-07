import fs from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

export function loadPackageEnv(fromModuleUrl: string): string {
  const root = packageRootFromModule(fromModuleUrl);
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) {
    throw new Error(`.env is missing at ${envPath}`);
  }
  loadEnvFile(envPath);
  return root;
}

export function packageRootFromModule(fromModuleUrl: string): string {
  let directory = path.dirname(fileURLToPath(fromModuleUrl));
  for (;;) {
    if (fs.existsSync(path.join(directory, "package.json"))) return directory;
    const parent = path.dirname(directory);
    if (parent === directory) {
      throw new Error(`package.json not found from ${fromModuleUrl}`);
    }
    directory = parent;
  }
}
