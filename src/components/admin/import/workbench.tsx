"use client";
import Image from "next/image";
import { useState } from "react";
import type { ImportView } from "@/lib/content-import/service";
import { columnNames, stateLabels, textFields, draftSchema, mappingSchema, textFieldSchema, type Draft, type Mapping } from "@/lib/content-import/types";
import { useAnrede } from "@/components/anrede-provider";
import { an } from "@/lib/anrede";

export type WorkbenchView = Pick<ImportView, "id" | "revision" | "state" | "error" | "format" | "sourceName" | "namespace" | "mapping" | "animalCount" | "public" | "settings" | "candidates">;
type Result = Promise<{ error?: string }>;
export type ImportControls = {
  save: (id: number, draft: Draft, selected: boolean, textConfirmed: boolean) => Result;
  map: (mapping: Mapping) => Result;
  omit: (id: number, omitted: boolean) => Result;
  upload: (candidate: number, image: number | null, file: File) => Result;
  approve: (confirmed: boolean) => Result;
  abort: () => Result;
};
export const field = "mt-1 block w-full min-w-0 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-ink";
export const button = "admin-button admin-primary disabled:opacity-50";
const secondary = "admin-button disabled:opacity-50";
const kinds = { animal: "Tier", post: "Neuigkeit", text: "Vereinstext", skip: "Auslassen" };
const labels = { id: "Quellen-ID", title: "Name / Titel", body: "Beschreibung / Text", species: "Tierart", sex: "Geschlecht", status: "Vermittlungsstatus", breed: "Rasse", birthYear: "Geburtsjahr", size: "Größe", images: "Bilder (mit | getrennt)" };
const steps = ["Quelle hochladen", "Inhalte zuordnen", "Bilder prüfen", "Vorschau", "Übernahme bestätigen"];
export function ImportSteps({ step }: { step: number }) {
  return <ol aria-label="Importschritte" className="my-6 flex flex-wrap gap-2 text-sm">{steps.map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined} className={`rounded-full px-3 py-2 ${step === index ? "bg-brand-800 text-white" : "bg-stone-100 text-stone-600"}`}>{index + 1}. {label}</li>)}</ol>;
}
export function ImportWorkbench({ view, controls }: { view: WorkbenchView; controls: ImportControls }) {
  const anrede = useAnrede();
  const [step, setStep] = useState(1);
  const [page, setPage] = useState(0);
  const [mappingEdit, setMapping] = useState<Mapping | null>(null);
  const mapping = mappingEdit ?? view.mapping;
  const [edits, setEdits] = useState<Record<number, { draft: Draft; selected: boolean; textConfirmed: boolean }>>({});
  const [message, setMessage] = useState("");
  const [working, setBusy] = useState(false);
  const [waitingRevision, setWaitingRevision] = useState<string | null>(null);
  const busy = working || waitingRevision === view.revision;
  const [confirmed, setConfirmed] = useState(false);
  const [confirmationRevision, setConfirmationRevision] = useState("");
  const approvedPreview = confirmed && confirmationRevision === view.revision;
  const [omissions, setOmissions] = useState<Record<number, boolean>>({});
  const editable = ["review", "failed"].includes(view.state);
  const current = (c: WorkbenchView["candidates"][number]) => edits[c.id] ?? { draft: c.draft, selected: c.selected, textConfirmed: c.textConfirmed };
  const change = (c: WorkbenchView["candidates"][number], patch: Partial<ReturnType<typeof current>>) => setEdits(old => ({ ...old, [c.id]: { ...(old[c.id] ?? { draft: c.draft, selected: c.selected, textConfirmed: c.textConfirmed }), ...patch } }));
  async function perform(action: () => Result, waitForRevision = false) {
    if (waitForRevision) setWaitingRevision(view.revision);
    setBusy(true); setMessage("");
    try { const result = await action(); if (result.error) { setMessage(result.error); setWaitingRevision(null); } return !result.error; }
    catch { setWaitingRevision(null); setMessage("Anfrage fehlgeschlagen. Bitte erneut versuchen."); return false; }
    finally { setBusy(false); }
  }
  async function saveEdits() {
    for (const [id, edit] of Object.entries(edits)) { const result = await controls.save(Number(id), edit.draft, edit.selected, edit.textConfirmed); if (result.error) return result; }
    setEdits({}); return {};
  }
  const selected = view.candidates.filter(c => current(c).selected && c.state !== "imported");
  const visible = (step === 1 ? view.candidates : view.candidates.filter(c => current(c).selected)).slice(page * 20, page * 20 + 20);
  const count = (step === 1 ? view.candidates : view.candidates.filter(c => current(c).selected)).length;
  const headers = [...new Set(view.candidates.flatMap(c => Object.keys(c.raw.fields)))];
  return <div className="space-y-5">
    <ImportSteps step={editable ? step : 4} />
    <p className="text-sm text-stone-600 break-words">{view.sourceName} · Quelle: {view.namespace} · {view.candidates.length} {view.candidates.length === 1 ? "Eintrag" : "Einträge"}</p>
    <p role="status" className="rounded-xl bg-stone-100 p-4">{stateLabels[view.state] ?? view.state}{["preparing", "approved", "processing"].includes(view.state) && " – " + an(anrede, "Die Verarbeitung läuft, solange diese Seite geöffnet ist. Beim erneuten Öffnen wird sie fortgesetzt.", "Die Verarbeitung läuft, solange diese Seite geöffnet ist. Beim erneuten Öffnen wird sie fortgesetzt.")}{view.state === "completed" && `: ${view.candidates.filter(c => c.state === "imported").length} übernommen, ${view.candidates.filter(c => c.state !== "imported").length} ausgelassen.`}</p>
    {(message || view.error) && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{message || view.error}</p>}
    {editable && <>
      {step === 1 && mapping && <details className="rounded-2xl border border-stone-200 bg-white p-5">
        <summary className="cursor-pointer font-semibold">Spalten und WordPress-Metafelder zuordnen</summary>
        <p className="my-3 text-sm">Die Zuordnung wird auf alle Einträge angewendet. Bereits vorgenommene Korrekturen und Bildersatz werden dabei zurückgesetzt.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {view.format === "csv" && <label>CSV-Inhaltstyp<select className={field} value={mapping.kind} onChange={e => { const kind = mappingSchema.shape.kind.options.find(value => value === e.target.value); if (kind) setMapping({ ...mapping, kind }); }}>{Object.entries(kinds).filter(([k]) => k !== "skip").map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>}
          {columnNames.map(k => <label key={k}>{labels[k]}<select className={field} value={mapping.columns[k]} onChange={e => setMapping({ ...mapping, columns: { ...mapping.columns, [k]: e.target.value } })}><option value="">Nicht zugeordnet</option>{headers.map(h => <option key={h}>{h}</option>)}</select></label>)}
        </div>
        <button className={`${secondary} mt-4`} disabled={busy || view.candidates.some(c => c.state === "imported")} onClick={() => void perform(async () => { const r = await controls.map(mapping); if (!r.error) { setEdits({}); setOmissions({}); setPage(0); } return r; }, true)}>Zuordnung anwenden</button>
      </details>}
      <p className="text-sm">{selected.length} ausgewählt · Tiere: {view.animalCount} vorhanden, {selected.filter(c => current(c).draft.kind === "animal").length} ausgewählt. Neuigkeiten enthalten nur Text.</p>
      {visible.map(c => {
        const edit = current(c), d = edit.draft;
        const update = (patch: Partial<Draft>) => setEdits(old => { const previous = old[c.id] ?? { draft: c.draft, selected: c.selected, textConfirmed: c.textConfirmed }; return { ...old, [c.id]: { ...previous, draft: { ...previous.draft, ...patch }, textConfirmed: false } }; });
        return <article key={c.id} className="min-w-0 rounded-2xl border border-stone-200 bg-white p-5" aria-label={`Importeintrag ${c.draft.title || c.sourceKey}`}>
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-xl font-semibold break-words">{d.title || "Ohne Titel"}</h2><span className="text-sm text-stone-500">{kinds[d.kind]} · {c.state === "imported" ? "Übernommen" : c.state === "skipped" ? "Ausgelassen" : c.sourceKey}</span></div>
          {c.duplicate && <p className="mt-2 text-sm text-amber-800">Mögliche Dublette – standardmäßig ausgelassen. Bereits vorhandene Inhalte werden nicht überschrieben.</p>}
          {c.error && <p className="mt-2 text-red-800">{c.error}</p>}
          {c.warnings.map(w => <p key={w} className="mt-2 text-sm text-amber-800">{w}</p>)}
          {step === 1 && c.state !== "imported" && <fieldset disabled={busy} className="mt-4 space-y-4">
            <label className="flex gap-2"><input type="checkbox" checked={edit.selected} onChange={e => change(c, { selected: e.target.checked })} />Diesen Eintrag übernehmen</label>
            {c.raw.fields.post_type && <p className="text-sm">WordPress-Inhaltstyp: {c.raw.fields.post_type}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <label>Übernehmen als<select className={field} value={d.kind} onChange={e => { const kind = draftSchema.shape.kind.options.find(value => value === e.target.value); if (kind) update({ kind }); }}>{Object.entries(kinds).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label>Name / Titel<input className={field} value={d.title} onChange={e => update({ title: e.target.value })} /></label>
              {d.kind === "animal" && <>
                <label>Tierart<select className={field} value={d.species} onChange={e => update({ species: e.target.value })}><option value="">Bitte wählen</option>{[["hund","Hund"],["katze","Katze"],["kleintier","Kleintier"],["vogel","Vogel"],["sonstiges","Sonstiges"]].map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                <label>Geschlecht<select className={field} value={d.sex} onChange={e => update({ sex: e.target.value })}>{[["u","Unbekannt"],["m","Männlich"],["w","Weiblich"]].map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                <label>Status<select className={field} value={d.status} onChange={e => update({ status: e.target.value })}>{["vermittelbar","reserviert","vermittelt"].map(s => <option key={s}>{s}</option>)}</select></label>
                <label>Rasse<input className={field} value={d.breed} onChange={e => update({ breed: e.target.value })} /></label>
                <label>Geburtsjahr<input className={field} inputMode="numeric" value={d.birthYear} onChange={e => update({ birthYear: e.target.value })} /></label>
                <label>Größe<input className={field} value={d.size} onChange={e => update({ size: e.target.value })} /></label>
              </>}
              {d.kind === "text" && <label>Zieltext<select className={field} value={d.textField} onChange={e => { const textField = textFieldSchema.options.find(value => value === e.target.value); if (textField) update({ textField }); }}>{Object.entries(textFields).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>}
            </div>
            <label className="block">Beschreibung / Text<textarea className={field} rows={6} value={d.body} onChange={e => update({ body: e.target.value })} /></label>
            {d.kind === "post" && <label className="flex gap-2"><input type="checkbox" checked={d.published} onChange={e => update({ published: e.target.checked })} />Neuigkeit veröffentlichen (sonst als Entwurf speichern)</label>}
            {d.kind === "text" && <><p className="text-sm font-semibold">Bisher: {textFields[d.textField].label}</p><p className="whitespace-pre-wrap rounded-xl bg-stone-50 p-3">{String(view.settings[d.textField] || "Noch kein Text")}</p><label className="flex gap-2"><input type="checkbox" checked={edit.textConfirmed} onChange={e => change(c, { textConfirmed: e.target.checked })} />Diesen Vereinstext durch den Text oben ersetzen</label></>}
            {c.errors.length > 0 && <ul className="list-inside list-disc text-sm text-red-800">{c.errors.map(e => <li key={e}>{e}</li>)}</ul>}
          </fieldset>}
          {step === 2 && <div className="mt-4 space-y-4">
            {c.images.length === 0 && <p className="text-sm text-stone-600">Keine Bilder zugeordnet.</p>}
            {c.images.map(i => <div key={i.id} className="flex flex-wrap gap-4 rounded-xl bg-stone-50 p-3">
              {["ready", "attached"].includes(i.state) && !i.omitted && <Image src={`/api/import/image/${i.id}`} alt={`Importvorschau für ${d.title}`} width={120} height={90} unoptimized className="h-24 w-32 rounded-lg object-cover" />}
              <div className="min-w-0 flex-1 space-y-2"><p className="break-all text-sm">{i.sourceUrl}</p><p className="text-sm">{i.omitted ? "Ausgelassen" : i.state === "pending" ? "Wird geprüft …" : i.error || (i.state === "ready" ? "Bild geprüft" : i.state)}</p>
              <label className="flex gap-2 text-sm"><input type="checkbox" checked={omissions[i.id] ?? i.omitted} disabled={busy || c.state === "imported"} onChange={e => {
                const omitted = e.target.checked;
                setOmissions(old => ({ ...old, [i.id]: omitted }));
                void perform(() => controls.omit(i.id, omitted)).then(ok => { if (!ok) setOmissions(old => ({ ...old, [i.id]: i.omitted })); });
              }} />Dieses Bild ausdrücklich auslassen</label>
              {c.state !== "imported" && (<label className="block text-sm">Bild ersetzen<input className={`${field} text-sm`} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) void perform(() => controls.upload(c.id, i.id, f)); e.target.value = ""; }} /></label>)}
              </div></div>)}
            {c.state !== "imported" && c.images.length < 8 && <label className="block text-sm">Bilddatei hinzufügen (JPEG, PNG, WebP; bis 5 MB)<input className={field} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) void perform(() => controls.upload(c.id, null, f)); e.target.value = ""; }} /></label>}
            {d.kind === "text" && <p className="text-sm">Vereinstextfelder enthalten nur Text. Bilder hier bitte abwählen.</p>}
          </div>}
          {step >= 3 && <div className="mt-4 space-y-3">
            {d.kind === "text" && <div className="rounded-xl bg-stone-50 p-3"><p className="text-sm font-semibold">Bisher: {textFields[d.textField].label}</p><p className="whitespace-pre-wrap">{String(view.settings[d.textField] || "Noch kein Text")}</p></div>}
            {d.kind === "animal" && <dl className="grid grid-cols-2 gap-2 text-sm">{[["Tierart",d.species],["Status",d.status],["Geschlecht",d.sex === "m" ? "Männlich" : d.sex === "w" ? "Weiblich" : "Unbekannt"],["Geburtsjahr",d.birthYear],["Rasse",d.breed],["Größe",d.size]].filter(([,v])=>v).map(([label,value])=><div key={label}><dt className="text-stone-500">{label}</dt><dd>{value}</dd></div>)}</dl>}
            <p className="whitespace-pre-wrap">{d.body}</p>
            <div className="flex flex-wrap gap-3">{c.images.filter(i=>!i.omitted && ["ready","attached"].includes(i.state)).map(i=><Image key={i.id} src={`/api/import/image/${i.id}`} alt={`Übernahmevorschau für ${d.title}`} width={160} height={120} unoptimized className="h-28 w-36 rounded-xl object-cover" />)}</div><p className="text-sm font-semibold">{d.kind === "animal" ? "Tierprofil wird auf der Vereinswebsite sichtbar." : d.kind === "post" ? d.published ? "Neuigkeit wird veröffentlicht." : "Neuigkeit wird als Entwurf gespeichert." : `${textFields[d.textField].label} wird ersetzt.`}</p><p className="text-sm">{c.images.filter(i => !i.omitted).length} {c.images.filter(i => !i.omitted).length === 1 ? "Bild wird" : "Bilder werden"} übernommen.</p>{c.errors.map(e => <p key={e} className="text-red-800">{e}</p>)}</div>}
        </article>;
      })}
      {count > 20 && <div className="flex items-center gap-3"><button className={secondary} disabled={page === 0} onClick={() => setPage(p => p-1)}>Vorige Einträge</button><span>{page + 1} / {Math.ceil(count / 20)}</span><button className={secondary} disabled={(page+1)*20 >= count} onClick={() => setPage(p => p+1)}>Weitere Einträge</button></div>}
      {step === 4 && <div className="space-y-4 rounded-2xl bg-amber-50 p-5"><p>{view.public ? an(anrede, "Ihre Vereinswebsite ist öffentlich. Ausgewählte Tierprofile, veröffentlichte Neuigkeiten und bestätigte Vereinstexte werden nach der Übernahme dort sichtbar.", "Deine Vereinswebsite ist öffentlich. Ausgewählte Tierprofile, veröffentlichte Neuigkeiten und bestätigte Vereinstexte werden nach der Übernahme dort sichtbar.") : an(anrede, "Ihre Vereinswebsite ist noch nicht öffentlich. Inhalte sind zunächst nur in Ihrer Vereinsvorschau sichtbar.", "Deine Vereinswebsite ist noch nicht öffentlich. Inhalte sind zunächst nur in deiner Vereinsvorschau sichtbar.")}</p><label className="flex gap-3"><input type="checkbox" checked={approvedPreview} onChange={e => { setConfirmed(e.target.checked); setConfirmationRevision(view.revision); }} />Ich habe Inhalte, Bilder und Sichtbarkeit geprüft und möchte die ausgewählten Inhalte übernehmen.</label><button className={button} disabled={busy || !approvedPreview || !selected.length} onClick={() => void perform(async () => { const r = await saveEdits(); return r.error ? r : controls.approve(approvedPreview); })}>Verbindlich übernehmen</button></div>}
      <div className="flex flex-wrap gap-3">{step > 1 && <button className={secondary} disabled={busy} onClick={() => { setStep(s => s-1); setPage(0); }}>Zurück</button>}{step < 4 && <button className={button} disabled={busy} onClick={async () => { if (await perform(saveEdits)) { setStep(s => s+1); setPage(0); } }}>{step === 1 ? "Speichern und Bilder prüfen" : step === 2 ? "Zur Vorschau" : "Zur Bestätigung"}</button>}</div>
    </>}
    {!editable && view.candidates.length > 0 && <ul className="space-y-2">{view.candidates.map(c => <li key={c.id}>{c.draft.title}: {c.state === "imported" ? "Übernommen" : c.state === "skipped" ? "Dublette ausgelassen" : !c.selected ? "Nicht ausgewählt" : c.error || "Wartet"}</li>)}</ul>}
    {!["completed", "cancelled"].includes(view.state) && <details className="text-sm"><summary className="cursor-pointer">Import abbrechen</summary><p className="my-2">Die Vorbereitung wird entfernt. Bereits übernommene Inhalte bleiben erhalten.</p><button className={secondary} disabled={busy} onClick={() => void perform(controls.abort)}>Abbruch bestätigen</button></details>}
  </div>;
}
