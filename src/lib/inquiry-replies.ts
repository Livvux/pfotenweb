import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { inquiries, inquiryReplies, tenants, tenantSettings } from "@/db/schema";
import { assertCurrentAccess } from "./access";
import { sendMessage } from "./email";
import type { TenantScope } from "./tenant";
export async function getInquiryReplies(scope: TenantScope, inquiryId: number) {
  return db.select().from(inquiryReplies).where(and(eq(inquiryReplies.tenantId, scope.tenantId), eq(inquiryReplies.inquiryId, inquiryId))).orderBy(asc(inquiryReplies.createdAt), asc(inquiryReplies.id));
}
export async function replyToInquiry(actor: { id: number; username: string; scope: TenantScope }, input: { inquiryId: number; requestId: string; body: string }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) return { error: "Mailversand ist nicht eingerichtet. Die Antwort wurde nicht versendet." };
  const id = await db.transaction(async tx => {
    await tx.select().from(tenants).where(eq(tenants.id, actor.scope.tenantId)).for("update");
    await assertCurrentAccess(tx, actor, "inquiries");
    const [inquiry] = await tx.select().from(inquiries).where(and(eq(inquiries.id, input.inquiryId), eq(inquiries.tenantId, actor.scope.tenantId))).for("update");
    if (!inquiry) return null;
    const [reply] = await tx.insert(inquiryReplies).values({ ...input, tenantId: actor.scope.tenantId, authorName: actor.username, deliveryStatus: "sending" }).onConflictDoNothing().returning({ id: inquiryReplies.id });
    return reply?.id ?? null;
  });
  if (!id) return { error: "Anfrage fehlt oder diese Antwort wurde bereits angestoßen. Bitte den Verlauf prüfen; sie wird nicht erneut versendet." };
  try {
    await db.transaction(async tx => {
      await tx.select().from(tenants).where(eq(tenants.id, actor.scope.tenantId)).for("update");
      await assertCurrentAccess(tx, actor, "inquiries");
      const [reply] = await tx.select().from(inquiryReplies).where(and(eq(inquiryReplies.id, id), eq(inquiryReplies.tenantId, actor.scope.tenantId))).for("update");
      const [inquiry] = await tx.select().from(inquiries).where(and(eq(inquiries.id, input.inquiryId), eq(inquiries.tenantId, actor.scope.tenantId))).for("update");
      const [settings] = await tx.select().from(tenantSettings).where(eq(tenantSettings.tenantId, actor.scope.tenantId));
      if (!reply || !inquiry || !settings) throw new Error("Anfrage fehlt.");
      await sendMessage({ to: inquiry.email, replyTo: settings.publicEmail ?? undefined, subject: inquiry.subject ? `Antwort: ${inquiry.subject}` : `Antwort von ${settings.orgName}`, text: reply.body, orgName: settings.orgName, template: settings.mailTemplate, color: settings.colorPrimary });
      await tx.update(inquiryReplies).set({ deliveryStatus: "sent", sentAt: new Date() }).where(eq(inquiryReplies.id, id));
    });
    return { success: true };
  } catch {
    // The server may have accepted the mail before a connection/commit failure.
    // Preserve the history and never retry this request automatically.
    await db.update(inquiryReplies).set({ deliveryStatus: "uncertain" }).where(and(eq(inquiryReplies.id, id), eq(inquiryReplies.tenantId, actor.scope.tenantId)));
    return { error: "Die Übergabe konnte nicht bestätigt werden. Bitte den Verlauf und gegebenenfalls das eigene Postfach prüfen. Keine automatische Wiederholung." };
  }
}
