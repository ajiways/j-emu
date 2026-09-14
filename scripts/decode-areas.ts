import fs from "node:fs";
import path from "node:path";
import { decodeAreas, outputDigests } from "./content-decode/decode-areas.ts";

const root = process.cwd();
const radveiAreasFile = path.resolve(
  root,
  process.env.RADVEI_AREAS_FILE ?? "content/radvei-areas.json",
);
const bgAreasFile = path.resolve(
  root,
  process.env.BG_RASKOP_AREAS_FILE ?? "content/bg-raskop-areas.json",
);
const overlayFile = path.resolve(
  root,
  process.env.AREAS_OVERLAY_FILE ?? "content/areas-overlay.json",
);
const huntSpawnsFile = path.resolve(
  root,
  process.env.HUNT_SPAWNS_FILE ?? "content/hunt-spawns.json",
);
const eventArtikulsFile = path.resolve(
  root,
  process.env.HUNT_EVENT_ARTIKULS_FILE ?? "content/hunt-event-artikuls.json",
);
const areasFile = path.resolve(root, process.env.AREAS_OUTPUT ?? "content/areas.generated.json");
const linksFile = path.resolve(
  root,
  process.env.AREA_LINKS_OUTPUT ?? "content/area-links.generated.json",
);
const huntsFile = path.resolve(
  root,
  process.env.HUNT_SPAWNS_OUTPUT ?? "content/hunt-spawns.generated.json",
);
const areasManifestFile = path.resolve(
  root,
  process.env.AREAS_MANIFEST ?? "content/areas.generated.manifest.json",
);
const linksManifestFile = path.resolve(
  root,
  process.env.AREA_LINKS_MANIFEST ?? "content/area-links.generated.manifest.json",
);
const huntsManifestFile = path.resolve(
  root,
  process.env.HUNT_SPAWNS_MANIFEST ?? "content/hunt-spawns.generated.manifest.json",
);

const result = decodeAreas({
  radveiAreasFile,
  bgAreasFile,
  overlayFile,
  huntSpawnsFile,
  eventArtikulsFile,
});

if (
  fs.existsSync(areasManifestFile) &&
  fs.existsSync(linksManifestFile) &&
  fs.existsSync(huntsManifestFile)
) {
  const previousAreas = JSON.parse(fs.readFileSync(areasManifestFile, "utf8")) as {
    corpusDigest?: string;
  };
  const previousLinks = JSON.parse(fs.readFileSync(linksManifestFile, "utf8")) as {
    corpusDigest?: string;
  };
  const previousHunts = JSON.parse(fs.readFileSync(huntsManifestFile, "utf8")) as {
    corpusDigest?: string;
  };
  if (
    previousAreas.corpusDigest === result.areasManifest.corpusDigest &&
    previousLinks.corpusDigest === result.areaLinksManifest.corpusDigest &&
    previousHunts.corpusDigest === result.huntSpawnsManifest.corpusDigest
  ) {
    process.stdout.write(
      `Unchanged corpus digest ${result.areasManifest.corpusDigest}; left generated area files\n`,
    );
    process.exit(0);
  }
}

fs.writeFileSync(areasFile, `${JSON.stringify(result.areas)}\n`);
fs.writeFileSync(linksFile, `${JSON.stringify(result.areaLinks)}\n`);
fs.writeFileSync(huntsFile, `${JSON.stringify(result.huntSpawns)}\n`);
fs.writeFileSync(areasManifestFile, `${JSON.stringify(result.areasManifest, null, 2)}\n`);
fs.writeFileSync(linksManifestFile, `${JSON.stringify(result.areaLinksManifest, null, 2)}\n`);
fs.writeFileSync(huntsManifestFile, `${JSON.stringify(result.huntSpawnsManifest, null, 2)}\n`);
const digests = outputDigests(result);
process.stdout.write(
  `Wrote ${result.areas.length} areas digest ${digests.areas}; ${result.areaLinks.length} links; ${result.huntSpawns.length} hunt spawns\n`,
);
