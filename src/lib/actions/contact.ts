"use server";

import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { inquiries } from "@/db/schema";
import { sendContactNotification } from "@/lib/email";
import { getSettings, requireActiveTenant } from "@/lib/tenant";
import { zodErrorState, type FormState } from "@/lib/form";

export type ContactState = FormState;

const contactSchema = z.object({
  name: z.string().trim().min(2, "Bitte geben Sie Ihren Namen an.").max(80),
  email: z
    .string()
    .trim()
    .email("Bitte geben Sie eine gültige E-Mail-Adresse an.")
    .max(160),
  subject: z.string().trim().max(180).optional(),
  message: z
    .string()
    .trim()
    .min(10, "Ihre Nachricht sollte mindestens 10 Zeichen enthalten.")
    .max(5000),
  animalId: z.coerce.number().int().positive().optional(),
});

export async function contactAction(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const tenant = await requireActiveTenant();
  // Honeypot: Bots füllen das versteckte Feld; wir tun Erfolg vor
  if (String(formData.get("website") ?? "") !== "") {
    return { success: true };
  }

  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject") || undefined,
    message: formData.get("message"),
    animalId: formData.get("animalId") || undefined,
  });

  if (!parsed.success) {
    return zodErrorState(parsed.error);
  }

  const { name, email, subject, message, animalId } = parsed.data;

  // Oeffentliches Formular: der Verein kommt aus dem Host, nie aus dem Formular.
  await db.insert(inquiries).values({
    tenantId: tenant.id,
    name,
    email,
    subject,
    message,
    animalId,
  });

  // Anfrage steht bereits in der DB (/admin/anfragen) – Mail-Versand blockiert die
  // Antwort daher nicht und ein Fehler darf sie nicht scheitern lassen.
  const settings = await getSettings(tenant.id);
  after(() => sendContactNotification({
    name,
    email,
    subject,
    message,
    animalId,
    orgName: settings?.orgName,
    notifyEmail: settings?.contactNotifyEmail ?? settings?.publicEmail ?? undefined,
  }).catch(
    (err) => console.error("Kontaktformular: Mail-Versand fehlgeschlagen", err),
  ));

  return { success: true };
}
