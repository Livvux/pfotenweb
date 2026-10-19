import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/db";
import { mediaDeletions } from "@/db/schema";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
import { privateMediaStorage, publicRoot } from "../storage";
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export function imageExtension(body: Buffer): string {
  if (body.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return ".jpg";
  if (body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return ".png";
  if (body.toString("ascii", 0, 4) === "RIFF" && body.toString("ascii", 8, 12) === "WEBP") return ".webp";
  throw new Error("Datei ist kein JPEG-, PNG- oder WebP-Bild.");
}
function mediaPath(key: string) {
  if (!/^t1\/(?:import_)?[a-f0-9]{24}\.(jpg|png|webp)$/.test(key)) throw new Error("Ungültiger Importbildpfad.");
  return path.join(publicRoot(), key);
}
export async function putMedia(key: string, body: Buffer, _type: string) {
  if (!await privateMediaStorage()) throw new Error("Inhaltsübernahme benötigt privaten UPLOAD_DIR außerhalb von public.");
  const file = mediaPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body, { mode: 0o600 });
}
export async function readMedia(key: string) {
  const file = mediaPath(key); const info = await lstat(file);
  if (!info.isFile() || info.size > MAX_UPLOAD_BYTES) throw new Error("Importbild fehlt oder ist zu groß.");
  return readFile(file);
}
export async function removeMedia(key: string, tx: Tx | typeof db = db) { mediaPath(key); await tx.insert(mediaDeletions).values({ url: `/uploads/${key}` }).onConflictDoNothing(); }
