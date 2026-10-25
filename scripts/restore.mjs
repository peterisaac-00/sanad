#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import path from "node:path";

const backupDir = process.argv[2];
const databaseUrl = process.env.RESTORE_DATABASE_URL || process.env.DATABASE_URL;
if (!backupDir || !databaseUrl) {
  throw new Error("Usage: RESTORE_DATABASE_URL=postgresql://... node scripts/restore.mjs <backup-directory>");
}
if (process.env.CONFIRM_RESTORE !== "yes") {
  throw new Error("Set CONFIRM_RESTORE=yes to replace data in the target database");
}
const root = path.resolve(backupDir);
const manifestPath = path.join(root, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const dump = path.join(root, manifest.databaseDump);
const media = path.join(root, manifest.mediaArchive);
if (!existsSync(dump) || !existsSync(media) || !manifest.databaseBytes) throw new Error("Backup is incomplete or invalid");
execFileSync("pg_restore", ["--clean", "--if-exists", "--exit-on-error", "--no-owner", "--no-acl", "--dbname", databaseUrl, dump], { stdio: "inherit" });
const storageDir = process.env.STORAGE_DIR || "data/uploads";
if (statSync(media).size > 0) {
  mkdirSync(path.dirname(path.resolve(storageDir)), { recursive: true });
  execFileSync("tar", ["-xzf", media, "-C", path.dirname(path.resolve(storageDir))], { stdio: "inherit" });
}
console.log(JSON.stringify({ ok: true, restoredDatabase: true, restoredMedia: statSync(media).size > 0, storageDir }));
