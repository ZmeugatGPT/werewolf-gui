#!/usr/bin/env node
/**
 * Rewrite repository and version information in the manifest.
 *
 * Usage:
 *   node tools/configure.mjs --owner <github-user> --repo <repository> --version 1.1.0
 *
 * Any omitted argument keeps the value that is already present in module.json,
 * so running the script without arguments is a no-op.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "module.json");

/** @param {string[]} argv */
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

/** @param {string|undefined} url */
function repoParts(url) {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return { owner: parts[0] ?? null, repo: parts[1] ?? null };
  } catch {
    return { owner: null, repo: null };
  }
}

const args = parseArgs(process.argv.slice(2));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const current = repoParts(manifest.url);
const oldBase = `https://github.com/${current.owner ?? "OWNER"}/${current.repo ?? "REPO"}`;

const owner = args.owner ?? current.owner ?? "OWNER";
const repo = args.repo ?? current.repo ?? "REPO";
const version = args.version ?? manifest.version;

const base = `https://github.com/${owner}/${repo}`;

manifest.url = base;
manifest.manifest = `${base}/releases/latest/download/module.json`;
manifest.download = `${base}/releases/latest/download/werewolf-gui.zip`;
manifest.changelog = `${base}/blob/main/CHANGELOG.md`;
manifest.bugs = `${base}/issues`;
manifest.readme = `${base}/blob/main/README.md`;
manifest.version = version;

if (args.author && Array.isArray(manifest.authors) && manifest.authors[0]) {
  manifest.authors[0].name = String(args.author);
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

// Keep repository links inside the documentation in step with the manifest.
if (oldBase !== base) {
  for (const file of ["README.md", "README.ru.md", "CHANGELOG.md"]) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    if (!text.includes(oldBase)) continue;
    writeFileSync(path, text.split(oldBase).join(base), "utf8");
    console.log(`[configure] updated links in ${file}`);
  }
}

console.log(`[configure] ${manifest.id} v${manifest.version} -> ${base}`);
