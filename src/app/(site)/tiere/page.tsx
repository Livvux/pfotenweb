import { an, parseAnrede } from "@/lib/anrede";
import type { Metadata } from "next";
import Link from "next/link";
import { AnimalMatching } from "@/components/animal-matching";
import { AnimalCard } from "@/components/animal-card";
import { SPECIES_LABELS, STATUS_LABELS, getAnimals, countAnimals, type AnimalFilters, type Animal } from "@/lib/animals";
import { requireTenantWithSettings } from "@/lib/tenant";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await requireTenantWithSettings();
  return { title: "Tiere vermitteln", description: `Tiere, die bei ${settings.orgName} ein neues Zuhause suchen.` };
}
export default async function TierePage({ searchParams }: PageProps<"/tiere">) {
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const art = Object.hasOwn(SPECIES_LABELS, value("art")) ? value("art") : !Array.isArray(params.art) ? value("species") : "";
  const status = value("status");
  const q = value("q").trim().slice(0, 120);
  const sex = ["m", "w", "u"].includes(value("geschlecht")) ? value("geschlecht") : "";
  const filters: AnimalFilters = {
    ...(Object.hasOwn(SPECIES_LABELS, art) ? { species: art as Animal["species"] } : {}),
    ...(Object.hasOwn(STATUS_LABELS, status) ? { status: status as Animal["status"] } : status === "alle" ? {} : { status: "vermittelbar" }),
    ...(sex ? { sex } : {}), q,
  };
  const { scope, settings } = await requireTenantWithSettings();
  const total = await countAnimals(scope, filters);
  const pages = Math.max(1, Math.ceil(total / 24));
  const page = Math.min(pages, Math.max(1, Number.parseInt(value("seite"), 10) || 1));
  const list = await getAnimals(scope, { ...filters, limit: 24, offset: (page - 1) * 24, coverOnly: true });
  function href(changes: Record<string, string>) {
    const next = { art: filters.species ?? "", status: status === "alle" ? "alle" : filters.status === "vermittelbar" ? "" : filters.status ?? "", q, geschlecht: sex, ...changes };
    const query = new URLSearchParams(Object.entries(next).filter(([, value]) => value));
    return `/tiere${query.size ? `?${query}` : ""}`;
  }
  const pill = (url: string, label: string, active: boolean) => <Link key={label} href={url} aria-current={active ? "true" : undefined} className={`inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm ring-1 ring-brand-200 motion-reduce:transition-none ${active ? "bg-brand-800 text-white" : "bg-white text-brand-900"}`}>{label}</Link>;
  return <main className="mx-auto max-w-6xl px-4 py-16">
    <h1 className="font-display text-4xl font-semibold text-brand-900">Sie suchen ein Zuhause</h1>
    <p className="mt-3">{total} {total === 1 ? "Tier" : "Tiere"} in dieser Auswahl. Ein Kennenlerngespräch ist immer der erste Schritt.</p>
    <AnimalMatching animals={list.map(({id,name,slug,status,profile}) => ({id,name,slug,status,profile}))}/>
    <form action="/tiere" method="get" className="mt-8 flex flex-wrap items-end gap-3" role="search" aria-label="Tiere suchen">
      {filters.species && <input type="hidden" name="art" value={filters.species}/>}
      <input type="hidden" name="status" value={status === "alle" ? "alle" : filters.status ?? "vermittelbar"}/>
      <label className="grid gap-1">Tiere suchen<input name="q" type="search" maxLength={120} defaultValue={q} className="min-h-11 rounded-lg border p-2"/></label>
      <label className="grid gap-1">Geschlecht<select name="geschlecht" defaultValue={sex} className="min-h-11 rounded-lg border p-2"><option value="">Alle</option><option value="m">Männlich</option><option value="w">Weiblich</option><option value="u">Unbekannt</option></select></label>
      <button className="min-h-11 rounded-full bg-brand-800 px-5 text-white">Suchen</button>
      <Link href="/tiere" className="inline-flex min-h-11 items-center underline">Zurücksetzen</Link>
    </form>
    <div role="navigation" aria-label="Tierfilter">
    {pill("/tiere", "Alle", !filters.species && filters.status === "vermittelbar" && !q && !sex)}
    <nav aria-label="Tierart" className="mt-5 flex flex-wrap gap-2">
      {pill(href({ art: "" }), "Alle Arten", !filters.species)}
      {Object.entries(SPECIES_LABELS).map(([key, label]) => pill(href({ art: key }), label, filters.species === key))}
    </nav>
    <nav aria-label="Vermittlungsstatus" className="mt-3 flex flex-wrap gap-2">
      {Object.entries(STATUS_LABELS).map(([key, label]) => pill(href({ status: key }), label, filters.status === key))}
      {pill(href({ status: "alle" }), "Alle Tiere", status === "alle")}
    </nav></div>
    {!list.length ? <p className="mt-10 rounded-2xl bg-white p-8">{an(parseAnrede(settings.visitorAddress), "Aktuell keine Tiere in dieser Auswahl. Ändern Sie die Filter oder schauen Sie später wieder vorbei.", "Aktuell keine Tiere in dieser Auswahl. Ändere die Filter oder schau später wieder vorbei.")}</p> : <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{list.map(animal => <AnimalCard key={animal.id} animal={animal}/>)}</div>}
    {pages > 1 && <nav aria-label="Seiten" className="mt-8 flex items-center gap-4">{page > 1 && <Link href={href({ seite: String(page - 1) })}>Zurück</Link>}<span>Seite {page} von {pages}</span>{page < pages && <Link href={href({ seite: String(page + 1) })}>Weiter</Link>}</nav>}
  </main>;
}
