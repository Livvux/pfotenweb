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
};

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
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
  await getTransporter().sendMail({
    from: data.orgName ? `"${data.orgName}" <${fromAddress}>` : fromAddress,
    to,
    replyTo: data.email,
    subject,
    text: [
      `Von: ${data.name} <${data.email}>`,
      data.animalId ? `Bezug: Tier #${data.animalId}` : null,
      "",
      data.message,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}
