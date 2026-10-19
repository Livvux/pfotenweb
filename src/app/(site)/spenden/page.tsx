import Link from "next/link";
import { requireTenantWithSettings } from "@/lib/tenant";
import { getDonations } from "@/lib/donations";
export const metadata = { title: "Spenden" };
export default async function DonationsPage() {
  const { scope } = await requireTenantWithSettings();
  const data = await getDonations(scope);
  return <main className="mx-auto max-w-3xl px-4 py-16"><h1 className="font-display text-4xl">{data.heading}</h1><p className="mt-6 whitespace-pre-line">{data.introduction}</p>
    {data.accountHolder && data.iban ? <section className="mt-8 rounded-2xl bg-white p-6 ring-1 ring-stone-200"><h2 className="text-xl font-semibold">Bankverbindung</h2><dl className="mt-4 space-y-3">{([["Kontoinhaber", data.accountHolder], ["IBAN", data.iban.replace(/(.{4})/g, "$1 ").trim()], ["BIC", data.bic], ["Bank", data.bankName], ["Verwendungszweck", data.purpose]] as const).filter(([, value]) => value).map(([label, value]) => <div key={label}><dt className="text-sm text-ink/60">{label}</dt><dd className="break-words font-medium">{value}</dd></div>)}</dl></section> : <p className="mt-8">Für Unterstützungsmöglichkeiten <Link className="underline" href="/kontakt">Kontakt aufnehmen</Link>.</p>}
    {data.receiptNote ? <p className="mt-6 whitespace-pre-line">{data.receiptNote}</p> : null}
  </main>;
}
