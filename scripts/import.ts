import { importData } from "../src/lib/data-import";
const file = process.argv[2];
if (!file) throw new Error("Aufruf: pnpm data:import /pfad/pfotenweb-export.tar.gz (App vorher stoppen)");
importData(file, 1).then(() => { console.log("Import abgeschlossen."); process.exit(0); }).catch((e: unknown) => { console.error(e instanceof Error ? e.message : "Import fehlgeschlagen"); process.exit(1); });
