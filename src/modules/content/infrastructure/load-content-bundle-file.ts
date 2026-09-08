import fs from "node:fs";
import path from "node:path";
import { parseContentBundle } from "../domain/parse-content-bundle.ts";
import type { ContentBundle } from "../domain/content-document.ts";

export function loadContentBundleFile(filePath: string): ContentBundle {
  return parseContentBundle(mergeCommonConf(readJsonObject(filePath), path.dirname(filePath)));
}

function mergeCommonConf(decoded: Readonly<Record<string, unknown>>, directory: string): unknown {
  if ("commonConf" in decoded) return decoded;
  const relative = decoded.commonConfFile;
  if (typeof relative !== "string" || !relative) {
    throw new Error("Content bundle commonConf or commonConfFile is required");
  }
  const rest: Record<string, unknown> = { ...decoded };
  delete rest.commonConfFile;
  return { ...rest, commonConf: readJsonObject(path.resolve(directory, relative)) };
}

function readJsonObject(filePath: string): Record<string, unknown> {
  if (!filePath) throw new Error("JSON file path is required");
  if (!fs.existsSync(filePath)) throw new Error(`JSON file does not exist: ${filePath}`);
  let decoded: unknown;
  try {
    decoded = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`File is not valid JSON: ${filePath}`, { cause: error });
  }
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
    throw new Error(`JSON root must be an object: ${filePath}`);
  }
  return decoded as Record<string, unknown>;
}
