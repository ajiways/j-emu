import fs from "node:fs";
import path from "node:path";

export const CLIENT_STATIC_PATHS = [
  "js/jquery.js",
  "js/ac_runactivecontent.js",
  "js/common.js",
  "js/swfobject.js",
  "js/unity.js",
  "images/swf/main.swf",
] as const;

export function writeClientStaticStubs(root: string): void {
  for (const relative of CLIENT_STATIC_PATHS) {
    const filePath = path.join(root, relative);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, stubBody(relative));
  }
}

function stubBody(relative: string): string {
  if (relative.endsWith(".swf")) return "FWS";
  return `/* ${relative} */\n`;
}
