import fs from "node:fs";
import path from "node:path";
import { decodeProfessions, outputDigests } from "./content-decode/decode-professions.ts";

const root = process.cwd();
const pub1Dir = process.env.PUB1_DIR;
if (!pub1Dir) throw new Error("PUB1_DIR is required");
const areaFarmsFile = path.resolve(root, process.env.AREA_FARMS_FILE ?? "content/area-farms.json");
const assistantOut = path.resolve(
  root,
  process.env.ASSISTANT_TYPES_OUTPUT ?? "content/assistant-types.generated.json",
);
const farmOut = path.resolve(
  root,
  process.env.FARM_RESOURCES_OUTPUT ?? "content/farm-resources.generated.json",
);
const areaOut = path.resolve(
  root,
  process.env.AREA_FARMS_OUTPUT ?? "content/area-farms.generated.json",
);
const recipeOut = path.resolve(
  root,
  process.env.CRAFT_RECIPES_OUTPUT ?? "content/craft-recipes.generated.json",
);
const assistantManifestFile = path.resolve(
  root,
  process.env.ASSISTANT_TYPES_MANIFEST ?? "content/assistant-types.generated.manifest.json",
);
const farmManifestFile = path.resolve(
  root,
  process.env.FARM_RESOURCES_MANIFEST ?? "content/farm-resources.generated.manifest.json",
);
const areaManifestFile = path.resolve(
  root,
  process.env.AREA_FARMS_MANIFEST ?? "content/area-farms.generated.manifest.json",
);
const recipeManifestFile = path.resolve(
  root,
  process.env.CRAFT_RECIPES_MANIFEST ?? "content/craft-recipes.generated.manifest.json",
);

const result = decodeProfessions({
  pub1Dir: path.resolve(root, pub1Dir),
  areaFarmsFile,
});

if (
  fs.existsSync(assistantManifestFile) &&
  fs.existsSync(farmManifestFile) &&
  fs.existsSync(areaManifestFile) &&
  fs.existsSync(recipeManifestFile)
) {
  const previous = [
    assistantManifestFile,
    farmManifestFile,
    areaManifestFile,
    recipeManifestFile,
  ].map((file) => JSON.parse(fs.readFileSync(file, "utf8")) as { corpusDigest?: string });
  const current = [
    result.assistantTypesManifest.corpusDigest,
    result.farmResourcesManifest.corpusDigest,
    result.areaFarmsManifest.corpusDigest,
    result.craftRecipesManifest.corpusDigest,
  ];
  if (previous.every((manifest, index) => manifest.corpusDigest === current[index])) {
    process.stdout.write(
      `Unchanged corpus digest ${result.assistantTypesManifest.corpusDigest}; left generated profession files\n`,
    );
    process.exit(0);
  }
}

fs.writeFileSync(assistantOut, `${JSON.stringify(result.assistantTypes)}\n`);
fs.writeFileSync(farmOut, `${JSON.stringify(result.farmResources)}\n`);
fs.writeFileSync(areaOut, `${JSON.stringify(result.areaFarms)}\n`);
fs.writeFileSync(recipeOut, `${JSON.stringify(result.craftRecipes)}\n`);
fs.writeFileSync(
  assistantManifestFile,
  `${JSON.stringify(result.assistantTypesManifest, null, 2)}\n`,
);
fs.writeFileSync(farmManifestFile, `${JSON.stringify(result.farmResourcesManifest, null, 2)}\n`);
fs.writeFileSync(areaManifestFile, `${JSON.stringify(result.areaFarmsManifest, null, 2)}\n`);
fs.writeFileSync(recipeManifestFile, `${JSON.stringify(result.craftRecipesManifest, null, 2)}\n`);
const digests = outputDigests(result);
process.stdout.write(
  `Wrote ${result.assistantTypes.length} assistants, ${result.farmResources.length} farms, ${result.areaFarms.length} area farms, ${result.craftRecipes.length} recipes digest ${digests.recipes}\n`,
);
