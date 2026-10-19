import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { tenants, users } from "../src/db/schema";
import { assertCurrentAccess } from "../src/lib/access";
import { scopeOf } from "../src/lib/tenant";

async function main() {
  assert.match(process.env.DATABASE_URL ?? "", /^postgres(?:ql)?:\/\/[^/]+@127\.0\.0\.1:55439\//);
  assert.equal(await db.$count(tenants), 0, "Fresh disposable database required");
  await db.insert(tenants).values({ id: 1 });
  try {
    const [user] = await db.insert(users).values({ tenantId: 1, username: "qa-editor", passwordHash: "not-a-real-password", role: "editor", permissions: ["animals"] }).returning();
    const actor = { id: user.id, scope: scopeOf(1) };
    const check = (area: "animals" | "posts" | "owner") => db.transaction(async tx => {
      await tx.select().from(tenants).where(eq(tenants.id, 1)).for("update");
      await assertCurrentAccess(tx, actor, area);
    });
    await check("animals");
    await assert.rejects(check("posts"));
    await assert.rejects(check("owner"));
    // Keep the stale actor from the original form while changing live rights.
    await db.update(users).set({ permissions: [] }).where(eq(users.id, user.id));
    await assert.rejects(check("animals"));
    await db.update(users).set({ role: "owner", active: false }).where(eq(users.id, user.id));
    await assert.rejects(check("owner"));
    await db.update(users).set({ active: true }).where(eq(users.id, user.id));
    await check("owner");
    await check("posts");
    console.log("Fresh activation, owner and area checks reject stale actors: OK");
  } finally {
    await db.delete(tenants).where(eq(tenants.id, 1));
  }
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
