#!/usr/bin/env node
/**
 * Build the distributable package:
 *
 *   dist/module.json        - manifest to attach to the GitHub release
 *   dist/werewolf-gui.zip   - the module itself, with files at the archive root
 *
 * Usage: node tools/build.mjs
 */

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const NAME = "werewolf-gui";
const zipPath = join(dist, `${NAME}.zip`);

/** Everything that ships inside the archive. */
const ENTRIES = [
  "module.json",
  "README.md",
  "README.ru.md",
  "CHANGELOG.md",
  "LICENSE",
  "scripts",
  "styles",
  "templates",
  "lang"
];

const log = (...args) => console.log("[build]", ...args);

/* ------------------------------------------------------------------ */
/*  Clean and copy                                                     */
/* ------------------------------------------------------------------ */

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const copied = [];
for (const entry of ENTRIES) {
  const source = join(root, entry);
  if (!existsSync(source)) {
    log(`skip (missing): ${entry}`);
    continue;
  }
  cpSync(source, join(dist, entry), { recursive: true });
  copied.push(entry);
}

/* ------------------------------------------------------------------ */
/*  Zip                                                                */
/* ------------------------------------------------------------------ */

let zipped = false;
try {
  execFileSync("zip", ["-r", "-q", "-9", `${NAME}.zip`, ...copied], { cwd: dist, stdio: "inherit" });
  zipped = existsSync(zipPath);
  if (zipped) log("created the archive with the `zip` CLI");
} catch (error) {
  if (process.platform !== "win32") throw error;
  log("`zip` is not available, falling back to PowerShell Compress-Archive");
  const list = copied.map(entry => `'${join(dist, entry)}'`).join(",");
  execFileSync("powershell", [
    "-NoProfile",
    "-Command",
    `Compress-Archive -Force -Path ${list} -DestinationPath '${zipPath}'`
  ], { stdio: "inherit" });
  zipped = existsSync(zipPath);
}

if (!zipped) {
  console.error("[build] failed to create the archive");
  process.exit(1);
}

console.log(`\n[build] done\n  manifest: ${join(dist, "module.json")}\n  package:  ${zipPath}`);
