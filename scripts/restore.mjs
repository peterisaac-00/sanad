#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import path from "node:path";

const backupDir = process.argv[2];
const databaseUrl = process.env.RESTORE_DATABASE_URL;
if (!backupDir || !databaseUrl) {
  throw new Error("Usage: RESTORE_DATABASE_URL=postgresql://... node scripts/restore.mjs <backup-directory>");
}
if (process.env.CONFIRM_RESTORE !== "yes") {
  throw new Error("Set CONFIRM_RESTORE=yes to replace data in the target database");
}
const target = new URL(databaseUrl);
if (target.protocol !== "postgres:" && target.protocol !== "postgresql:") {
  throw new Error("RESTORE_DATABASE_URL must be a PostgreSQL URL.");
}
if (target.pathname === "/postgres" || target.pathname === "/postgres/") {
  throw new Error("Refusing to restore into the PostgreSQL maintenance database.");
}
if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_RESTORE !== "yes") {
  throw new Error("Set ALLOW_PRODUCTION_RESTORE=yes to restore while NODE_ENV=production.");
}
if (databaseUrl === process.env.DATABASE_URL && process.env.ALLOW_SAME_DATABASE_RESTORE !== "yes") {
  throw new Error("RESTORE_DATABASE_URL must be explicit. Set ALLOW_SAME_DATABASE_RESTORE=yes to restore the live database.");
}
const root = path.resolve(backupDir);
const insideBackup = (name) => {
  if (!name || typeof name !== "string") throw new Error("Backup manifest is missing a required file name");
  const resolved = path.resolve(root, name);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("Backup manifest contains an unsafe path");
  }
  return resolved;
};
const manifestPath = path.join(root, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const dump = insideBackup(manifest.databaseDump);
const media = insideBackup(manifest.mediaArchive);
if (!existsSync(dump) || !existsSync(media) || !manifest.databaseBytes) throw new Error("Backup is incomplete or invalid");
execFileSync("pg_restore", ["--clean", "--if-exists", "--exit-on-error", "--no-owner", "--no-acl", "--dbname", databaseUrl, dump], { stdio: "inherit" });
const storageDir = process.env.STORAGE_DIR || "data/uploads";
if (statSync(media).size > 0) {
  mkdirSync(path.dirname(path.resolve(storageDir)), { recursive: true });
  execFileSync("tar", ["-xzf", media, "-C", path.dirname(path.resolve(storageDir))], { stdio: "inherit" });
}
console.log(JSON.stringify({ ok: true, restoredDatabase: true, restoredMedia: statSync(media).size > 0, storageDir }));
