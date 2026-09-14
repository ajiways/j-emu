import path from "node:path";
import { parseContentBundle } from "../domain/parse-content-bundle.ts";
import type { ContentBundle } from "../domain/content-document.ts";
import { mergeGeneratedBundleFiles, readJsonObject } from "./merge-generated-bundle-files.ts";

export function loadContentBundleFile(filePath: string): ContentBundle {
  const directory = path.dirname(filePath);
  const decoded = readJsonObject(filePath);
  return parseContentBundle(
    mergeGeneratedBundleFiles(mergeCommonConf(decoded, directory), directory),
  );
}

function mergeCommonConf(
  decoded: Readonly<Record<string, unknown>>,
  directory: string,
): Record<string, unknown> {
  if ("commonConf" in decoded) return { ...decoded };
  const relative = decoded.commonConfFile;
  if (typeof relative !== "string" || !relative) {
    throw new Error("Content bundle commonConf or commonConfFile is required");
  }
  const rest: Record<string, unknown> = { ...decoded };
  delete rest.commonConfFile;
  return { ...rest, commonConf: readJsonObject(path.resolve(directory, relative)) };
}
