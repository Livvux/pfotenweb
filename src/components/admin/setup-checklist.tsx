import Link from "next/link";
import type { ChecklistItem } from "@/lib/settings-status";
export function ChecklistListe({ liste }: { liste: ChecklistItem[] }) {
  return (
    <ul className="space-y-3">
      {liste.map((punkt) => (
        <li key={punkt.key} className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              punkt.done
                ? "bg-brand-800 text-white"
                : punkt.required
                  ? "border-2 border-red-200 bg-red-50 text-red-700"
                  : "border-2 border-stone-300"
            }`}
          >
            {punkt.done ? "✓" : ""}
          </span>
          <span className="min-w-0 flex-1">
            <Link
              href={punkt.href}
              className={
                punkt.done
                  ? "text-ink/50 line-through"
                  : "font-medium text-ink underline decoration-stone-300 underline-offset-4 hover:decoration-brand-700"
              }
            >
              {punkt.label}
            </Link>
            {!punkt.required ? (
              <span className="ml-2 text-sm text-ink/40">freiwillig</span>
            ) : null}
            {punkt.why && !punkt.done ? (
              <span className="block text-sm text-ink/50">{punkt.why}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SetupChecklist({ liste }: { liste: ChecklistItem[] }) {
 return <section className="rounded-2xl bg-white p-6"><h2 className="mb-4 text-xl">Ihre Seite einrichten</h2><ChecklistListe liste={liste} /></section>;
}
