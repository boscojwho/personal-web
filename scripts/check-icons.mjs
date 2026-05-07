#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const appJsPath = path.join(repoRoot, "app.js");

const source = fs.readFileSync(appJsPath, "utf8");
const iconMatches = [...source.matchAll(/icon:\s*"([^"]*)"/g)];
const iconPaths = iconMatches.map(match => match[1]).filter(Boolean);

if (iconPaths.length === 0) {
  console.error("No non-empty icon paths found in app.js DATA.apps.");
  process.exit(1);
}

const missing = iconPaths.filter(iconPath => !fs.existsSync(path.join(repoRoot, iconPath)));

if (missing.length > 0) {
  console.error("Missing icon files:");
  missing.forEach(iconPath => console.error(`- ${iconPath}`));
  process.exit(1);
}

console.log(`Icon check passed (${iconPaths.length} icon paths).`);
