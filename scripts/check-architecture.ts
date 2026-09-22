import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const maxLines = 400;
const multiExportAllowlist: readonly string[] = [];
const amfValueAllowPrefix = "src/modules/jugger-wire/amf/";

const files = collectTsFiles(srcRoot);
const failures: string[] = [];

for (const file of files) {
  const relative = path.relative(path.resolve(srcRoot, ".."), file).split(path.sep).join("/");
  const source = fs.readFileSync(file, "utf8");
  const lineCount = source.split(/\r?\n/).length;
  if (lineCount > maxLines) {
    failures.push(`${relative}: ${lineCount} lines exceeds the 400-line handwritten limit`);
  }

  const exportCount = countPrimaryExports(source);
  if (exportCount > 1 && !multiExportAllowlist.includes(relative)) {
    failures.push(`${relative}: ${exportCount} primary exported classes/interfaces`);
  }

  if (/\bAmfValue\b/.test(source) && !relative.startsWith(amfValueAllowPrefix)) {
    failures.push(`${relative}: AmfValue is only allowed in jugger-wire/amf`);
  }

  if (/\bimport\s*\(/.test(source)) {
    failures.push(`${relative}: dynamic import() is forbidden in production`);
  }

  if (/\bexport class Memory/.test(source) || /\bclass Memory/.test(source)) {
    failures.push(`${relative}: production Memory* implementations are forbidden`);
  }

  const inDomainOrApplication = /\/(domain|application)\//.test(relative);
  if (inDomainOrApplication) {
    if (/\bfrom ["']fastify["']/.test(source) || /from ["']@fastify\//.test(source)) {
      failures.push(`${relative}: Fastify imports are forbidden in domain/application`);
    }
    if (/\bfrom ["']drizzle-orm/.test(source)) {
      failures.push(`${relative}: Drizzle imports are forbidden in domain/application`);
    }
    if (/jugger-wire\/amf\//.test(source)) {
      failures.push(`${relative}: AMF imports are forbidden in domain/application`);
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}

function collectTsFiles(directory: string): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".ts")) files.push(fullPath);
  }
  return files;
}

function countPrimaryExports(source: string): number {
  const classes = source.match(/^export class /gm)?.length ?? 0;
  const interfaces = source.match(/^export interface /gm)?.length ?? 0;
  return classes + interfaces;
}
