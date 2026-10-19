export const mailTemplates = ["klassisch", "farbkopf", "brief"] as const;
export type MailTemplate = typeof mailTemplates[number];
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
/** Plain text stays authoritative; HTML contains no remote assets or user HTML. */
export function renderMail(text: string, orgName: string, template: MailTemplate = "klassisch", color = "#1e4334") {
  const primary = /^#[0-9a-f]{6}$/i.test(color) ? color : "#1e4334";
  const header = template === "farbkopf" ? `border-top:8px solid ${primary};` : template === "brief" ? "border-top:1px solid #d6d3d1;" : "";
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f5f5f4;color:#292524;font-family:Arial,sans-serif"><table role="presentation" style="width:100%;border-collapse:collapse"><tr><td style="padding:24px"><table role="presentation" style="width:100%;max-width:600px;margin:auto;background:white;${header}"><tr><td style="padding:28px"><p style="font-size:18px;font-weight:bold">${escape(orgName)}</p>${text.split(/\n\s*\n/).map(p => `<p style="line-height:1.6">${escape(p).replace(/\n/g, "<br>")}</p>`).join("")}</td></tr></table></td></tr></table></body></html>`;
}
