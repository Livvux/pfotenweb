import { formatDate } from "@/lib/posts";
import { deleteInquiry, toggleInquiryResolved } from "@/lib/actions/inquiries";
import { getInquiries } from "@/lib/inquiries";
import { requireAdmin } from "@/lib/auth";
import { ConfirmButton } from "@/components/admin/confirm-button";

export default async function AdminAnfragenPage() {
  const { scope } = await requireAdmin();
  const rows = await getInquiries(scope);

  const open = rows.filter((r) => !r.inquiry.resolvedAt);
  const done = rows.filter((r) => r.inquiry.resolvedAt);

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
        Anfragen
      </h1>
      <p className="mt-2 text-sm text-ink/50">
        {open.length} offen · {done.length} erledigt
      </p>

      {[open, done].map((list, listIndex) =>
        list.length === 0 && listIndex === 0 ? (
          <p key="empty" className="mt-8 text-sm text-ink/50">
            Keine offenen Anfragen.
          </p>
        ) : list.length === 0 ? null : (
          <section key={listIndex} className="mt-6">
            {listIndex === 1 ? (
              <h2 className="mb-3 mt-10 text-sm font-semibold text-ink/60">
                Erledigt
              </h2>
            ) : null}
            <ul
              className={`divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200 ${
                listIndex === 1 ? "opacity-70" : ""
              }`}
            >
              {list.map(({ inquiry: inq, animalName }) => (
                <li key={inq.id} className="space-y-2 p-5">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className="font-medium text-ink">{inq.name}</p>
                    <a
                      href={`mailto:${inq.email}`}
                      className="text-sm text-brand-700 hover:text-brand-900"
                    >
                      {inq.email}
                    </a>
                    <span className="text-xs text-ink/40">
                      {formatDate(inq.createdAt)}
                    </span>
                    {animalName ? (
                      <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800">
                        zu {animalName}
                      </span>
                    ) : null}
                  </div>
                  {inq.subject ? (
                    <p className="text-sm font-medium text-stone-700">
                      {inq.subject}
                    </p>
                  ) : null}
                  <p className="whitespace-pre-line leading-relaxed text-ink/70">
                    {inq.message}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <form action={toggleInquiryResolved}>
                      <input type="hidden" name="id" value={inq.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
                      >
                        {inq.resolvedAt ? "Wieder öffnen" : "Als erledigt markieren"}
                      </button>
                    </form>
                    <form action={deleteInquiry}>
                      <input type="hidden" name="id" value={inq.id} />
                      <ConfirmButton
                        question={`Die Anfrage von ${inq.name} wird gelöscht.`}
                      />
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
    </div>
  );
}
