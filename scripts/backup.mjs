#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL;
const storageDir = process.env.STORAGE_DIR || "data/uploads";
const backupDir = process.env.BACKUP_DIR || "backups";
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = path.resolve(backupDir, `sanad-${stamp}`);
mkdirSync(target, { recursive: true, mode: 0o700 });
const dump = path.join(target, "database.dump");
const media = path.join(target, "uploads.tar.gz");
execFileSync("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--file", dump, databaseUrl], { stdio: "inherit" });
if (existsSync(storageDir)) {
  execFileSync("tar", ["-czf", media, "-C", path.dirname(path.resolve(storageDir)), path.basename(storageDir)], { stdio: "inherit" });
} else {
  writeFileSync(media, "");
}
const manifest = {
  createdAt: new Date().toISOString(),
  databaseDump: path.basename(dump),
  mediaArchive: path.basename(media),
  databaseBytes: statSync(dump).size,
  mediaBytes: statSync(media).size,
  storageDir,
};
if (!manifest.databaseBytes) throw new Error("database dump is empty");
writeFileSync(path.join(target, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 });
console.log(JSON.stringify({ ok: true, directory: target, ...manifest }));
