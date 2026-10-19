import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { animals, inquiries, inquiryReplies, tenants, tenantSettings, users } from "../src/db/schema";
import { scopeOf } from "../src/lib/tenant";
import { replyToInquiry } from "../src/lib/inquiry-replies";
import { mailTemplates } from "../src/lib/mail-render";
async function main() {
  assert.match(process.env.DATABASE_URL ?? "", /^postgres(?:ql)?:\/\/[^/]+@127\.0\.0\.1:55439\//);
  assert.equal(process.env.SMTP_HOST, "127.0.0.1");
  assert.equal(process.env.SMTP_PORT, "55440");
  assert.equal(await db.$count(tenants), 0, "Fresh disposable database required");
  await db.insert(tenants).values({ id: 1 });
  await db.insert(tenantSettings).values({ tenantId: 1, orgName: "QA Verein", shortName: "QA", heroHeadline: "QA", publicEmail: "verein@example.test" });
  try {
    const [user] = await db.insert(users).values({ tenantId: 1, username: "qa-owner", passwordHash: "not-a-real-password", role: "owner" }).returning();
    const actor = { id: user.id, username: user.username, scope: scopeOf(1) };
    const [animal] = await db.insert(animals).values({ tenantId: 1, name: "QA Tier", slug: "qa-tier", species: "hund", description: "Ein fiktives Tier für den Selbsttest." }).returning();
    const [inquiry] = await db.insert(inquiries).values({ tenantId: 1, animalId: animal.id, name: "QA Person", email: "person@example.test", message: "Eine fiktive Frage aus dem Selbsttest." }).returning();
    for (const template of mailTemplates) {
      await db.update(tenantSettings).set({ mailTemplate: template }).where(eq(tenantSettings.tenantId, 1));
      const input = { inquiryId: inquiry.id, requestId: randomUUID(), body: `QA Antwort ${template}: <b>Dieser Text bleibt Text.</b>` };
      assert.equal((await replyToInquiry(actor, input)).success, true);
      assert.ok((await replyToInquiry(actor, input)).error, "Same request cannot send twice");
      const response = await fetch("http://127.0.0.1:55441/api/v1/message/latest/raw");
      assert.equal(response.status, 200);
      const raw = await response.text();
      assert.match(raw, /multipart\/alternative/);
      assert.match(raw, /text\/plain/);
      assert.match(raw, /text\/html/);
      assert.match(raw, /person@example.test/);
    }
    assert.equal(await db.$count(inquiryReplies), 3);
    await db.update(users).set({ active: false }).where(eq(users.id, user.id));
    await assert.rejects(replyToInquiry(actor, { inquiryId: inquiry.id, requestId: randomUUID(), body: "Dieser entzogene Zugang darf keine Antwort versenden." }));
    await db.delete(animals).where(eq(animals.id, animal.id));
    const [remaining] = await db.select().from(inquiries).where(eq(inquiries.id, inquiry.id));
    assert.equal(remaining.tenantId, 1);
    assert.equal(remaining.animalId, null, "Animal deletion retains inquiry history");
    await db.delete(inquiries).where(eq(inquiries.id, inquiry.id));
    assert.equal(await db.$count(inquiryReplies), 0);
    console.log("Mailpit multipart replies, deduplication, revoked access and deletion histories: OK");
  } finally { await db.delete(tenants).where(eq(tenants.id, 1)); }
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
