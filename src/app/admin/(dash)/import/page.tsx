import { requireOwner } from "@/lib/auth";
import { getImport } from "@/lib/content-import/service";
import { ImportAssistant } from "@/components/admin/import/assistant";
export default async function ImportPage() {
  const user = await requireOwner();
  return <><h1 className="text-3xl font-serif">Inhalte übernehmen</h1><p className="mt-3 max-w-3xl text-stone-600">Tiere, Neuigkeiten und Vereinstexte aus CSV oder einem WordPress-Export prüfen und einzeln übernehmen. Bestehende Inhalte bleiben unverändert. Die Verarbeitung läuft in kleinen, wiederaufnehmbaren Schritten, solange diese Seite geöffnet ist.</p><ImportAssistant view={await getImport(user.scope)}/></>;
}
