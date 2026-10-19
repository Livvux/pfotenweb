import { renderMail, type MailTemplate } from "./mail-render";
import nodemailer, { type Transporter } from "nodemailer";

type ContactNotification = {
  name: string;
  email: string;
  subject?: string;
  message: string;
  animalId?: number;
  /** Name des Vereins, erscheint als Absendername. */
  orgName?: string;
  /** Zieladresse dieses Vereins. Ohne sie greift die globale ENV. */
  notifyEmail?: string;
  template?: MailTemplate;
  color?: string;
};

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    connectionTimeout: 15000,
    socketTimeout: 30000,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

// Ohne SMTP_HOST/CONTACT_NOTIFY_EMAIL wird stillschweigend nichts verschickt:
// die Anfrage steht bereits in der DB und ist unter /admin/anfragen einsehbar.
export async function sendContactNotification(
  data: ContactNotification,
): Promise<void> {
  const host = process.env.SMTP_HOST;
  // Der Verein bestimmt den Empfaenger, die Plattform nur den Versandweg.
  const to = data.notifyEmail ?? process.env.CONTACT_NOTIFY_EMAIL;
  if (!host || !to) return;

  const subject = data.subject
    ? `Neue Anfrage: ${data.subject}`
    : "Neue Anfrage über das Kontaktformular";

  // Absenderdomain bleibt die der Plattform: eine fremde Domain ohne deren
  // DKIM in From zu setzen laesst die Mails zuverlaessig im Spam landen.
  const fromAddress = process.env.SMTP_FROM ?? to;
  const text = [
    `Von: ${data.name} <${data.email}>`,
    data.animalId ? `Bezug: Tier #${data.animalId}` : null,
    "",
    data.message,
  ].filter(Boolean).join("\n");
  await sendMessage({ to, replyTo: data.email, subject, text, orgName: data.orgName ?? "Verein", template: data.template, color: data.color, fromAddress });

}

export async function sendMessage(data: { to: string; replyTo?: string; subject: string; text: string; orgName: string; template?: MailTemplate; color?: string; fromAddress?: string }) {
  if (!process.env.SMTP_HOST || !(data.fromAddress ?? process.env.SMTP_FROM)) throw new Error("Mailversand ist nicht eingerichtet.");
  const result = await getTransporter().sendMail({
    from: { name: data.orgName, address: data.fromAddress ?? process.env.SMTP_FROM! },
    to: data.to, replyTo: data.replyTo, subject: data.subject, text: data.text,
    html: renderMail(data.text, data.orgName, data.template, data.color),
  });
  if (result.rejected?.length || !result.accepted?.length) throw new Error("Mailserver hat die Nachricht nicht angenommen.");
}
