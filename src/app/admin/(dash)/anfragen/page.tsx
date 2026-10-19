import Link from "next/link";
import { randomUUID } from "node:crypto";
import { formatDate } from "@/lib/posts";
import { deleteInquiry, toggleInquiryResolved } from "@/lib/actions/inquiries";
import { getInquiries, getInquiryCounts } from "@/lib/inquiries";
import { getInquiryReplies } from "@/lib/inquiry-replies";
import { requireArea } from "@/lib/auth";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { InquiryReplyForm } from "@/components/admin/inquiry-reply-form";
const deliveryLabels = { sending: "Übergabe begonnen · Ergebnis noch nicht bestätigt", sent: "An Mailserver übergeben · keine Zustellbestätigung", failed: "Übergabe fehlgeschlagen", uncertain: "Übergabe unklar · keine automatische Wiederholung", imported: "Importierter Verlauf · wird nicht versendet" };
export default async function AdminAnfragenPage({ searchParams }: PageProps<"/admin/anfragen">) {
  const { scope } = await requireArea("inquiries");
  const params = await searchParams;
  const filter = params.status === "done" ? "done" : params.status === "all" ? "all" : "open";
  const counts = await getInquiryCounts(scope);
  const total = filter === "open" ? counts.open : filter === "done" ? counts.done : counts.open + counts.done;
  const pages = Math.max(1, Math.ceil(total / 24));
  const current = Math.min(pages, Math.max(1, Number.parseInt(typeof params.seite === "string" ? params.seite : "1", 10) || 1));
  const rows = await getInquiries(scope, filter, (current - 1) * 24);
  const replies = new Map(await Promise.all(rows.map(async row => [row.inquiry.id, await getInquiryReplies(scope, row.inquiry.id)] as const)));
  return <div><h1 className="font-display text-3xl font-semibold">Anfragen</h1><p className="mt-2 text-sm">{counts.open} offen · {counts.done} erledigt</p>
    <nav aria-label="Anfragestatus" className="mt-5 flex flex-wrap gap-3">{([["open", "Offen"], ["done", "Erledigt"], ["all", "Alle"]] as const).map(([value, label]) => <Link key={value} href={`/admin/anfragen?status=${value}`} aria-current={filter === value ? "page" : undefined} className={`admin-button ${filter === value ? "admin-primary" : ""}`}>{label}</Link>)}</nav>
    {!rows.length && <p className="mt-8">Keine Anfragen in dieser Auswahl.</p>}
    <ul className="mt-6 space-y-3">{rows.map(({ inquiry, animalName }) => <li key={inquiry.id} className="rounded-2xl border border-stone-200 bg-white p-5"><details>
      <summary className="cursor-pointer"><span className="font-semibold">{inquiry.name}</span><span className="ml-3 text-sm">{formatDate(inquiry.createdAt)}</span>{animalName && <span className="ml-3 text-sm">zu {animalName}</span>}<span className="mt-1 block text-sm">{inquiry.subject ?? inquiry.message.slice(0, 100)}</span></summary>
      <div className="mt-4 space-y-4"><a className="break-all underline" href={`mailto:${inquiry.email}`}>{inquiry.email}</a><p className="whitespace-pre-line">{inquiry.message}</p>
        <section aria-label="Antwortverlauf" className="space-y-3">{replies.get(inquiry.id)?.map(reply => <article key={reply.id} className="rounded-xl bg-stone-50 p-4"><p className="text-xs">{reply.authorName} · {formatDate(reply.createdAt)} · {deliveryLabels[reply.deliveryStatus]}</p><p className="mt-2 whitespace-pre-line">{reply.body}</p></article>)}</section>
        <InquiryReplyForm inquiryId={inquiry.id} requestId={randomUUID()} email={inquiry.email}/>
        <div className="flex flex-wrap gap-3"><form action={toggleInquiryResolved}><input type="hidden" name="id" value={inquiry.id}/><button className="admin-button">{inquiry.resolvedAt ? "Wieder öffnen" : "Als erledigt markieren"}</button></form><form action={deleteInquiry}><input type="hidden" name="id" value={inquiry.id}/><ConfirmButton question="Anfrage und zugehörigen Antwortverlauf löschen?"/></form></div>
      </div></details></li>)}</ul>
    {pages > 1 && <nav aria-label="Anfrageseiten" className="mt-6 flex items-center gap-4">{current > 1 && <Link className="admin-button" href={`/admin/anfragen?status=${filter}&seite=${current - 1}`}>Zurück</Link>}<span>Seite {current} von {pages}</span>{current < pages && <Link className="admin-button" href={`/admin/anfragen?status=${filter}&seite=${current + 1}`}>Weiter</Link>}</nav>}
  </div>;
}
