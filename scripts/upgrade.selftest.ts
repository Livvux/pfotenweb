import assert from "node:assert/strict";
import { randomBytes, scryptSync } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { verifyPassword } from "../src/lib/password";
async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, "55439");
  const name = `qa_upgrade_${randomBytes(8).toString("hex")}`;
  const admin = postgres(url.href, { max: 1, onnotice: () => {} });
  await admin.unsafe(`CREATE DATABASE ${name}`);
  url.pathname = `/${name}`;
  const client = postgres(url.href, { max: 1, onnotice: () => {} });
  const stage = await mkdtemp(path.join(tmpdir(), "upgrade-selftest-"));
  try {
    await mkdir(path.join(stage, "meta"));
    const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
    journal.entries = journal.entries.slice(0, 1);
    await writeFile(path.join(stage, "meta/_journal.json"), JSON.stringify(journal));
    await copyFile("drizzle/0000_slow_omega_flight.sql", path.join(stage, "0000_slow_omega_flight.sql"));
    await migrate(drizzle(client), { migrationsFolder: stage });
    await client`insert into association(id) values(1)`;
    const salt = randomBytes(16).toString("hex");
    const password = "QA existing owner password";
    const hash = `scrypt:${salt}:${scryptSync(password.normalize("NFKC"), Buffer.from(salt, "hex"), 64).toString("hex")}`;
    const [owner] = await client`insert into users(tenant_id,username,password_hash,role) values(1,'ExistingOwner',${hash},'owner') returning id`;
    const [editor] = await client`insert into users(tenant_id,username,password_hash,role) values(1,'existingowner',${hash},'editor') returning id`;
    await migrate(drizzle(client), { migrationsFolder: "drizzle" });
    const rows = await client`select u.id,u.username,u.role,u.permissions,u.email,u.password_hash,a.password from users u join auth_accounts a on a.user_id=u.id order by u.id`;
    assert.equal(rows.length, 2);
    assert.equal(rows[0].id, owner.id); assert.equal(rows[1].id, editor.id);
    assert.equal(rows[0].username, "ExistingOwner"); assert.equal(rows[1].username, "existingowner");
    assert.equal(rows[0].role, "owner"); assert.equal(rows[1].role, "editor");
    assert.deepEqual(rows[1].permissions.sort(), ["animals", "inquiries", "posts"]);
    assert.notEqual(rows[0].email, rows[1].email);
    for (const row of rows) { assert.equal(row.password_hash, ""); assert.equal(await verifyPassword(password, row.password), true); }
    const [sessions] = await client`select count(*)::int as n from auth_sessions`;
    assert.equal(sessions.n, 0, "Upgrade never creates authenticated sessions");
    console.log("Published schema → all migrations preserves IDs, case-sensitive usernames, credentials and existing editor rights: OK");
  } finally { await client.end(); await admin.unsafe(`DROP DATABASE ${name}`); await admin.end(); await rm(stage, { recursive: true, force: true }); }
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
