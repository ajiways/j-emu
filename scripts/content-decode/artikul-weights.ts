import fs from "node:fs";
import { isRecord } from "./amf-fields.ts";

export type ArtikulWeightsOverlay = Readonly<{
  digestSource: string;
  weights: ReadonlyMap<number, number>;
}>;

export function loadArtikulWeights(filePath: string): ArtikulWeightsOverlay {
  if (!filePath) throw new Error("Artikul weights path is required");
  if (!fs.existsSync(filePath)) throw new Error(`Artikul weights file does not exist: ${filePath}`);
  let decoded: unknown;
  try {
    decoded = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Artikul weights is not valid JSON: ${filePath}`, { cause: error });
  }
  if (!isRecord(decoded)) throw new Error(`Artikul weights root must be an object: ${filePath}`);
  const allowed = new Set(["note", "slot_weight_max", "weights"]);
  for (const key of Object.keys(decoded)) {
    if (!allowed.has(key)) throw new Error(`Artikul weights has unknown key ${key}`);
  }
  if (!isRecord(decoded.weights)) throw new Error("Artikul weights.weights must be an object");
  const weights = new Map<number, number>();
  for (const [key, value] of Object.entries(decoded.weights)) {
    if (!/^\d+$/.test(key)) throw new Error(`Artikul weights key ${key} is not an artikul id`);
    const id = Number(key);
    if (!Number.isInteger(id) || id < 1) throw new Error(`Artikul weights key ${key} is invalid`);
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      throw new Error(`Artikul weights ${id} is invalid`);
    }
    if (weights.has(id)) throw new Error(`Artikul weights duplicate id ${id}`);
    weights.set(id, value);
  }
  return { digestSource: filePath, weights };
}
