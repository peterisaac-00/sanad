#!/usr/bin/env node
import "dotenv/config";
import argon2 from "argon2";
import pg from "pg";

const email = (process.env.ADMIN_RESET_EMAIL || process.env.ADMIN_BOOTSTRAP_EMAIL || "").trim().toLowerCase();
const password = process.env.ADMIN_RESET_PASSWORD || process.env.ADMIN_BOOTSTRAP_PASSWORD || "";
const databaseUrl = process.env.DATABASE_URL || "";

if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("ADMIN_RESET_EMAIL or ADMIN_BOOTSTRAP_EMAIL must be a valid email");
if (password.trim().length < 12) throw new Error("ADMIN_RESET_PASSWORD or ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters");
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const passwordHash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
});
const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query("BEGIN");
  const updated = await client.query(
    `UPDATE platform_admins
        SET password_hash = $1,
            password_salt = NULL,
            password_algo = 'argon2id',
            status = 'active',
            updated_at = NOW()
      WHERE email = $2
      RETURNING id, email`,
    [passwordHash, email]
  );
  if (updated.rowCount !== 1) {
    await client.query("ROLLBACK");
    throw new Error(`No platform administrator exists for ${email}. Set ADMIN_BOOTSTRAP_* and restart the app first.`);
  }
  await client.query("DELETE FROM admin_sessions WHERE admin_id = $1", [updated.rows[0].id]);
  await client.query("COMMIT");
  console.log(JSON.stringify({ ok: true, email: updated.rows[0].email, sessionsRevoked: true }));
} catch (error) {
  try { await client.query("ROLLBACK"); } catch {}
  throw error;
} finally {
  await client.end();
}
