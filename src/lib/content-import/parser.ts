import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { Parser } from "htmlparser2";
import { SaxesParser } from "saxes";
import { columnNames, defaultDraft, MAX_CANDIDATES, MAX_IMAGES, MAX_SOURCE_BYTES, type Draft, type Mapping, type SourceRow } from "./types";

export function fingerprint(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function plainText(html: string): { text: string; images: string[]; warnings: string[] } {
  const parts: string[] = [], images: string[] = [], warnings = new Set<string>();
  let hidden = 0;
  const blocked = new Set(["script", "style", "iframe", "object", "embed", "video", "audio", "template"]);
  const blocks = new Set(["p", "div", "br", "li", "h1", "h2", "h3", "h4", "blockquote", "tr"]);
  const parser = new Parser({
    onopentag(name, attrs) {
      if (blocked.has(name)) { hidden++; warnings.add("Skripte oder Einbettungen wurden entfernt."); }
      if (!hidden && name === "img" && attrs.src) images.push(attrs.src);
      if (!hidden && blocks.has(name)) parts.push("\n\n");
    },
    onclosetag(name) { if (blocked.has(name)) hidden = Math.max(0, hidden - 1); if (!hidden && blocks.has(name)) parts.push("\n\n"); },
    ontext(value) { if (!hidden) parts.push(value); },
  }, { decodeEntities: true });
  parser.end(html);
  let text = parts.join("");
  if (/\[\/?[a-zA-Z][^\]\n]*\]/.test(text)) { warnings.add("WordPress-Shortcodes wurden entfernt; Inhalt bitte prüfen."); text = text.replace(/\[\/?[a-zA-Z][^\]\n]*\]/g, ""); }
  return { text: text.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim(), images: [...new Set(images)], warnings: [...warnings] };
}
function csvRows(text: string): SourceRow[] {
  let quoted = false, commas = 0, semicolons = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') { if (quoted && text[i + 1] === '"') i++; else quoted = !quoted; }
    if (!quoted && (char === "\n" || char === "\r")) break;
    if (!quoted && char === ",") commas++;
    if (!quoted && char === ";") semicolons++;
  }
  let rows: string[][];
  try {
    const result: unknown = parse(text, { bom: true, delimiter: semicolons > commas ? ";" : ",", skip_empty_lines: true, max_record_size: MAX_SOURCE_BYTES });
    if (!Array.isArray(result) || !result.every(r => Array.isArray(r) && r.every(v => typeof v === "string"))) throw new Error();
    rows = result as string[][]; // The parser returns untyped records; every cell is validated above.
  } catch { throw new Error("Ungültige CSV: Spaltenzahl und Anführungszeichen bitte prüfen."); }
  if (!rows || rows.length < 2) throw new Error("CSV benötigt eine Kopfzeile und mindestens einen gültigen Datensatz.");
  const headers = rows.shift()!.map(x => x.trim());
  if (headers.length > 100 || headers.some(x => !x || x.length > 200) || new Set(headers).size !== headers.length) throw new Error("CSV-Spalten müssen eindeutige, nicht leere Namen haben (maximal 100 Spalten).");
  return rows.map((cells, index) => {
    if (cells.length !== headers.length) throw new Error(`CSV-Zeile ${index + 2} hat eine abweichende Spaltenzahl.`);
    const fields = Object.fromEntries(headers.map((h, i) => [h, cells[i]]));
    return { key: fingerprint(JSON.stringify(Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)))), fields, images: [], warnings: [] };
  });
}
const WP = /^https?:\/\/wordpress\.org\/export\/\d+\.\d+\/$/;
const CONTENT = "http://purl.org/rss/1.0/modules/content/";
function wordpressRows(text: string): { rows: SourceRow[]; site: string } {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("XML mit DTD oder Entitäten wird nicht akzeptiert.");
  const parser = new SaxesParser({ xmlns: true });
  const stack: { local: string; uri: string; text: string }[] = [];
  const items: SourceRow[] = [];
  let current: Record<string, string> | null = null, metaKey = "", metaValue = "", site = "", isWxr = false;
  parser.on("opentag", tag => { stack.push({ local: tag.local, uri: tag.uri, text: "" }); if (stack.length > 64) throw new Error("XML ist zu tief verschachtelt."); if (tag.local === "item" && stack.length === 3) current = Object.create(null) as Record<string, string>; });
  parser.on("text", value => { if (stack.length) stack[stack.length - 1].text += value; });
  parser.on("cdata", value => { if (stack.length) stack[stack.length - 1].text += value; });
  parser.on("closetag", () => {
    const tag = stack.pop()!;
    if (WP.test(tag.uri) && tag.local === "wxr_version") isWxr = true;
    if (!current && tag.local === "link" && stack.at(-1)?.local === "channel") site = tag.text;
    if (current) {
      if (WP.test(tag.uri)) {
        if (tag.local === "meta_key") metaKey = tag.text;
        else if (tag.local === "meta_value") metaValue = tag.text;
        else if (tag.local === "postmeta") { current[`meta:${metaKey}`] = metaValue; metaKey = ""; metaValue = ""; }
        else if (["post_id", "post_type", "post_parent", "status", "attachment_url"].includes(tag.local)) current[tag.local] = tag.text;
      } else if (tag.uri === CONTENT && tag.local === "encoded") current.body = tag.text;
      else if (stack.at(-1)?.local === "item" && ["title", "link", "guid"].includes(tag.local)) current[tag.local] = tag.text;
      if (tag.local === "item" && stack.length === 2) {
        items.push({ key: current.post_id || current.guid || fingerprint(JSON.stringify(current)), fields: current, images: [], warnings: [] });
        current = null;
        if (items.length > 10_000) throw new Error("WordPress-Export enthält zu viele Einträge und Anhänge.");
      }
    }
  });
  try { parser.write(text).close(); } catch (error) { if (error instanceof Error && /zu viele|tief/.test(error.message)) throw error; throw new Error("Ungültiges WordPress-XML. Bitte einen vollständigen Export hochladen."); }
  if (!isWxr) throw new Error("Die XML-Datei ist kein WordPress-Export (WXR).");
  const attachments = items.filter(i => i.fields.post_type === "attachment");
  const rows = items.filter(i => !["attachment", "revision", "nav_menu_item"].includes(i.fields.post_type));
  for (const row of rows) {
    row.images = attachments.filter(a => a.key === row.fields["meta:_thumbnail_id"] || a.fields.post_parent === row.key).map(a => a.fields.attachment_url).filter(Boolean);
  }
  return { rows, site };
}
export function parseSource(text: string, format: "csv" | "wordpress") {
  if (Buffer.byteLength(text) > MAX_SOURCE_BYTES) throw new Error("Datei ist größer als 10 MB.");
  const result = format === "csv" ? { rows: csvRows(text), site: "" } : wordpressRows(text);
  if (!result.rows.length || result.rows.length > MAX_CANDIDATES) throw new Error("Ein Import muss 1 bis 1.000 Inhalte enthalten.");
  if (new Set(result.rows.map(r => r.key)).size !== result.rows.length) throw new Error("Doppelte Quellenkennungen im Export.");
  return result;
}
const aliases: Record<string, string[]> = { id: ["id", "post_id"], title: ["title", "name", "titel"], body: ["body", "description", "beschreibung", "text", "inhalt"], species: ["species", "tierart"], sex: ["sex", "geschlecht"], status: ["status"], breed: ["breed", "rasse"], birthYear: ["birthYear", "geburtsjahr"], size: ["size", "größe"], images: ["images", "bilder", "bild", "image"] };
export function suggestMapping(headers: string[], kind: Mapping["kind"] = "animal"): Mapping {
  return { kind, columns: Object.fromEntries(columnNames.map(k => [k, headers.find(h => aliases[k].some(a => a.toLowerCase() === h.toLowerCase())) ?? ""])) as Mapping["columns"] };
}
export function mapRow(row: SourceRow, mapping: Mapping, format: string): { draft: Draft; images: string[]; warnings: string[]; key: string } {
  const value = (key: typeof columnNames[number]) => Object.hasOwn(row.fields, mapping.columns[key]) ? row.fields[mapping.columns[key]] : "";
  const content = plainText(value("body"));
  const kind = format === "wordpress" ? row.fields.post_type === "post" ? "post" : row.fields.post_type === "page" ? "text" : "skip" : mapping.kind;
  const images = [...new Set([...row.images, ...content.images, ...value("images").split(/[|\n]/).map(x => x.trim()).filter(Boolean)])];
  if (images.length > MAX_IMAGES) throw new Error(`„${value("title") || row.key}“ enthält mehr als ${MAX_IMAGES} Bilder. Bitte den Export aufteilen oder Bilder vorher auswählen.`);
  return { draft: { ...defaultDraft, kind, title: plainText(value("title")).text, body: content.text, species: value("species"), sex: value("sex") || "u", status: ["vermittelbar", "reserviert", "vermittelt"].includes(value("status")) ? value("status") : "vermittelbar", breed: value("breed"), birthYear: value("birthYear"), size: value("size"), published: false }, images, warnings: [...row.warnings, ...content.warnings, ...(kind === "skip" ? ["Unbekannten WordPress-Inhaltstyp bitte zuordnen."] : [])], key: value("id") || row.key };
}
