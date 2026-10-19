"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { abortImport, confirmImport, editImportCandidate, mapImport, toggleImportImage } from "@/lib/actions/content-import";
import { ImportSteps, ImportWorkbench, button, field, type WorkbenchView } from "./workbench";

export function ImportAssistant({ view }: { view: WorkbenchView | null }) {
  const router = useRouter();
  const [fresh, setFresh] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const active = view && !["completed", "cancelled"].includes(view.state);
  useEffect(() => {
    if (!active) return;
    let running = false;
    const advance = async () => {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      try { await fetch("/api/import/process", { method: "POST" }); router.refresh(); }
      finally { running = false; }
    };
    const interval = setInterval(() => { void advance().catch(() => {}); }, 4000);
    void advance().catch(() => {});
    return () => clearInterval(interval);
  }, [active, router]);
  async function upload(candidate: number, image: number | null, file: File) {
    const res = await fetch(`/api/import?kind=image&candidate=${candidate}${image ? `&image=${image}` : ""}`, { method: "POST", body: file });
    if (res.redirected) return { error: "Sitzung abgelaufen. Bitte erneut anmelden." };
    const result: { error?: string } = await res.json(); router.refresh(); return result;
  }
  if (view && (!fresh || active)) return <>
    <ImportWorkbench key={view.id} view={view} controls={{ save: editImportCandidate, map: mapping => mapImport(view.id, mapping), omit: toggleImportImage, upload, approve: checked => confirmImport(view.id, checked, view.revision), abort: () => abortImport(view.id) }} />
    {!active && <button className={`${button} mt-6`} onClick={() => setFresh(true)}>Neuen Import starten</button>}
  </>;
  return <div>
    <ImportSteps step={0} />
    <form className="max-w-2xl space-y-5 rounded-2xl border border-stone-200 bg-white p-6" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError("");
      const data = new FormData(e.currentTarget), file = data.get("source");
      try {
        if (!(file instanceof File) || !file.size) throw new Error("Bitte eine Datei auswählen.");
        if (file.size > 10 * 1024 * 1024) throw new Error("Datei ist größer als 10 MB.");
        const res = await fetch("/api/import", { method: "POST", body: file, headers: { "x-import-format": String(data.get("format")), "x-import-name": encodeURIComponent(file.name), "x-import-source": encodeURIComponent(String(data.get("namespace"))) } });
        if (res.redirected) throw new Error("Sitzung abgelaufen. Bitte erneut anmelden.");
        const result: { error?: string } = await res.json(); if (result.error) throw new Error(result.error);
        setFresh(false); router.refresh();
      } catch (err) { setError(err instanceof Error ? err.message : "Upload fehlgeschlagen."); }
      finally { setBusy(false); }
    }}>
      <label className="block">Bisherige Website / Quellenkennung<input className={field} name="namespace" required maxLength={200} placeholder="z. B. tierhilfe-beispiel.de" /><span className="text-sm text-stone-600">Bei späteren Importen dieselbe Kennung verwenden, damit bereits übernommene Einträge erkannt werden.</span></label>
      <label className="block">Dateiformat<select className={field} name="format"><option value="csv">CSV-Tabelle</option><option value="wordpress">WordPress-Export (XML / WXR)</option></select></label>
      <label className="block">Quelldatei<input className={field} type="file" name="source" accept=".csv,.xml,text/csv,text/xml,application/xml" required /></label>
      <p className="text-sm text-stone-600">Bis 10 MB und 1.000 Inhalte. WordPress: Werkzeuge → Daten exportieren. Tiere aus Plugins werden anschließend manuell zugeordnet. Keine Zugangsdaten erforderlich.</p>
      <p className="text-sm">CSV-Vorlagen: <a className="underline" href="/import-vorlage-tiere.csv" download>Tiere</a> · <a className="underline" href="/import-vorlage-neuigkeiten.csv" download>Neuigkeiten</a></p>
      {error && <p role="alert" className="text-red-800">{error}</p>}
      <button className={button} disabled={busy}>{busy ? "Wird hochgeladen …" : "Quelle hochladen"}</button>
    </form>
  </div>;
}
