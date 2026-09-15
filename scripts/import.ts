import { importData } from "../src/lib/data-import";
const file = process.argv[2];
if (!file) throw new Error("Aufruf: pnpm data:import /pfad/pfotenweb-export.tar.gz (App vorher stoppen)");
importData(file, 1).then((result) => { console.log("Import abgeschlossen."); if (result.additional.length) { console.log("Zusatzdaten sind im vollständigen privaten Quellarchiv erhalten, werden hier aber nicht dargestellt:", JSON.stringify(result.additional)); console.log("Quellarchiv:", result.sourceArchive); } process.exit(0); }).catch((e: unknown) => { console.error(e instanceof Error ? e.message : "Import fehlgeschlagen"); process.exit(1); });
