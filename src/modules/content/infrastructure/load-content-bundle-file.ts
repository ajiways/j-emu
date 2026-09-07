import fs from "node:fs";
import { parseContentBundle } from "../domain/parse-content-bundle.ts";
import type { ContentBundle } from "../domain/content-document.ts";

export function loadContentBundleFile(filePath: string): ContentBundle {
  if (!fs.existsSync(filePath)) throw new Error(`Content bundle file does not exist: ${filePath}`);
  let decoded: unknown;
  try {
    decoded = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Content bundle is not valid JSON: ${filePath}`, { cause: error });
  }
  return parseContentBundle(decoded);
}
