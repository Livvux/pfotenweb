import { randomBytes } from "node:crypto";
import { mkdir, rm, unlink, writeFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

/**
 * Oeffentliche Uploads, nach Verein getrennt.
 *
 * Der Praefix ist nicht nur Ordnung: deleteFile prueft daran, ob die Datei
 * ueberhaupt dem anfragenden Verein gehoert, bevor sie geloescht wird.
 */
export function publicRoot(): string {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), "public", "uploads");
}

function tenantPrefix(tenantId: number): string {
  return `t${tenantId}`;
}

export async function saveFile(
  tenantId: number,
  buffer: Buffer,
  ext: string,
): Promise<string> {
  if (tenantId !== 1 || ![".jpg", ".png", ".webp"].includes(ext)) throw new Error("Ungültiges Bild.");
  const dir = path.join(publicRoot(), tenantPrefix(tenantId));
  const name = `${randomBytes(12).toString("hex")}${ext}`;
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buffer, { flag: "wx" });
  return `/uploads/t${tenantId}/${name}`;
}

/**
 * Loescht eine hochgeladene Datei von der Platte.
 *
 * Frueher fehlte das ganz: jedes geloeschte Tier hinterliess sein Foto.
 * Die Praefix-Pruefung verhindert zugleich, dass ein Verein per manipuliertem
 * Formular die Datei eines anderen loescht.
 */
export async function deleteFile(
  tenantId: number,
  url: string,
): Promise<boolean> {
  const prefix = `/uploads/${tenantPrefix(tenantId)}/`;
  if (!url.startsWith(prefix)) return false;
  const name = url.slice(prefix.length);
  if (!name || name.includes("/") || name.includes("..")) return false;
  try {
    await unlink(path.join(publicRoot(), tenantPrefix(tenantId), name));
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Hochgeladene Bilder                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Erlaubte Bildformate und ihre Endung.
 *
 * Steht hier und nicht in einer einzelnen Action, weil Tierfotos, Logo und
 * Startbild dieselbe Pruefung brauchen. HEIC fehlt bewusst: der Browser wandelt
 * es vor dem Absenden in WebP um (siehe shrink-image.ts), auf dem Server soll
 * nur ankommen, was next/image auch ausliefern kann.
 */
export const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type UploadResult = { url?: string; error?: string };

/**
 * Prueft eine hochgeladene Datei und legt sie ab.
 *
 * Leere Auswahl ist kein Fehler, sondern der Normalfall bei einem Formular, in
 * dem nur Text geaendert wurde: dann kommt ein leeres Ergebnis zurueck.
 *
 * Die Meldungen nennen den Dateinamen. Ein Verein, der acht Fotos anhaengt,
 * soll nicht raten muessen, welches davon zu gross war.
 *
 * Pruefung und Schreiben sind getrennt (checkImage), damit ein Mehrfach-Upload
 * erst alles pruefen und dann alles schreiben kann. Sonst haette ein Fehler in
 * Datei fuenf schon vier verwaiste Dateien auf der Platte hinterlassen.
 */
export function checkImage(file: File): string | null {
  const name = file.name || "Die Datei";
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `„${name}“ ist mit ${mb} MB zu groß (erlaubt sind 5 MB).`;
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return `„${name}“ ist kein JPEG-, PNG- oder WebP-Bild. Bitte das Foto in der Fotos-App öffnen, „Teilen“ und „Kopie sichern“ wählen und die Kopie hochladen.`;
  }
  return null;
}

export async function saveImage(
  tenantId: number,
  file: File | null,
): Promise<UploadResult> {
  if (!file || file.size === 0) return {};
  const fehler = checkImage(file);
  if (fehler) return { error: fehler };
  try {
    const url = await saveFile(tenantId, Buffer.from(await file.arrayBuffer()), ALLOWED_IMAGE_TYPES.get(file.type)!);
    return { url };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Bild konnte nicht gespeichert werden." };
  }
}

/**
 * Loescht den gesamten Upload-Ordner eines Vereins.
 *
 * Gehoert zum Loeschen eines Vereins: die Datenbankzeilen raeumt ON DELETE
 * CASCADE weg, die Dateien auf der Platte nicht. Entsteht ausdruecklich schon
 * hier und nicht spaeter, weil dieser Weg zugleich der Aufraeumpfad des
 * Registrierungstests ist.
 */
export async function deleteTenantFiles(tenantId: number): Promise<void> {
  const dir = path.join(publicRoot(), tenantPrefix(tenantId));
  try {
    await rm(dir, { recursive: true, force: true });
  } catch (err) {
    console.error("Upload-Ordner konnte nicht geloescht werden", err);
  }
}

export async function storageUsed(tenantId: number): Promise<number> {
  const dir = path.join(publicRoot(), tenantPrefix(tenantId));
  let files;
  try { files = await readdir(dir, { withFileTypes: true }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0; throw error; }
  let bytes = 0;
  for (const file of files) {
    if (file.isFile()) {
      try { bytes += (await stat(path.join(dir, file.name))).size; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
  }
  return bytes;
}
