import { websiteText, importWebsiteText } from "../website/legacy";
import { randomBytes } from "node:crypto";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { animalImages, animals, contentImportCandidates as candidates, contentImportImages as images, contentImportRuns as runs, contentImportSources as sources, posts, tenants, tenantSettings, users } from "@/db/schema";
import type { TenantScope } from "../tenant";
import { readMedia, putMedia, removeMedia } from "./storage";
import { MAX_UPLOAD_BYTES } from "./storage";
import { privateMediaStorage } from "../storage";
import { normalizeUploadImage } from "../upload-image";
import { imageExtension } from "./storage";
import { slugify } from "../slug";
import { animalSchema, postSchema } from "../content-schemas";
import { animalValues, draftSchema, mappingSchema, MAX_IMAGES, MAX_SOURCE_BYTES, postValues, validateDraft, type Draft, type Mapping } from "./types";
import { fingerprint, mapRow, parseSource, suggestMapping } from "./parser";
import { downloadImage } from "./download";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Candidate = typeof candidates.$inferSelect;
type ImportImage = typeof images.$inferSelect;
const ownRun = (tenantId: number, runId: number) => and(eq(runs.tenantId, tenantId), eq(runs.id, runId));
const ownCandidate = (tenantId: number, id: number) => and(eq(candidates.tenantId, tenantId), eq(candidates.id, id));
const ownImage = (tenantId: number, id: number) => and(eq(images.tenantId, tenantId), eq(images.id, id));
const sourceHash = (namespace: string, key: string) => fingerprint(`${namespace}\n${key}`);
const normalize = (v: string) => v.toLocaleLowerCase("de-DE").replace(/\s+/g, " ").trim();
export function importError(error: unknown): string {
  return error instanceof Error && !("query" in error) && !("code" in error) && !("cause" in error) ? error.message.slice(0, 300) : "Import konnte nicht gespeichert werden. Bitte erneut versuchen.";
}
async function lock(tx: Tx, tenantId: number) { await tx.select().from(tenants).where(eq(tenants.id, tenantId)).for("update"); }
async function allowed(tx: Tx, tenantId: number, userId?: number) {
  const [tenant] = await tx.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant || tenant.id !== 1) throw new Error("Dieser Verein darf keine Inhalte importieren.");
  if (userId !== undefined) {
    const [user] = await tx.select().from(users).where(and(eq(users.tenantId, tenantId), eq(users.id, userId)));
    if (!user?.active || user.role !== "owner") throw new Error("Nur Verantwortliche dürfen importieren.");
  }
  return tenant;
}
async function editable(tx: Tx, tenantId: number, runId: number) {
  const [run] = await tx.select().from(runs).where(ownRun(tenantId, runId));
  if (!run || !["review", "failed"].includes(run.state) || !run.source) throw new Error("Dieser Import ist nicht mehr bearbeitbar.");
  return run;
}
async function touch(tx: Tx, tenantId: number, runId: number) { await tx.update(runs).set({ updatedAt: new Date(), error: null }).where(ownRun(tenantId, runId)); }
async function cleanImage(image: ImportImage, tx: Tx) {
  if (image.stageKey) await removeMedia(image.stageKey, tx);
  if (image.targetKey && image.state !== "attached") await removeMedia(image.targetKey, tx);
}
export async function createImport(scope: TenantScope, userId: number, source: string, format: "csv" | "wordpress", sourceName: string, namespace: string) {
  if (!await privateMediaStorage()) throw new Error("Inhaltsübernahme benötigt UPLOAD_DIR außerhalb von public.");
  if (!source || Buffer.byteLength(source) > MAX_SOURCE_BYTES) throw new Error("Bitte eine Datei bis 10 MB auswählen.");
  if (!namespace.trim() || namespace.length > 200) throw new Error("Bitte die bisherige Website als Quellenkennung angeben (maximal 200 Zeichen).");
  return db.transaction(async tx => {
    await lock(tx, scope.tenantId); await allowed(tx, scope.tenantId, userId);
    const [existing] = await tx.select({ id: runs.id }).from(runs).where(and(eq(runs.tenantId, scope.tenantId), inArray(runs.state, ["preparing", "review", "approved", "processing", "failed"])));
    if (existing) throw new Error("Bitte den bestehenden Import zuerst abschließen oder abbrechen.");
    const [run] = await tx.insert(runs).values({ tenantId: scope.tenantId, source, sourceName: sourceName.slice(0, 200), namespace: namespace.trim().toLowerCase().replace(/\/$/, ""), format }).returning();
    return run.id;
  });
}
async function duplicate(tx: Tx, tenantId: number, namespace: string, key: string, draft: Draft) {
  const [known] = await tx.select({ id: sources.id }).from(sources).where(and(eq(sources.tenantId, tenantId), eq(sources.sourceHash, sourceHash(namespace, key))));
  if (known) return true;
  if (draft.kind === "animal") {
    const rows = await tx.select({ title: animals.name, body: animals.description }).from(animals).where(eq(animals.tenantId, tenantId));
    return rows.some(r => normalize(r.title) === normalize(draft.title) || normalize(r.body) === normalize(draft.body));
  }
  if (draft.kind === "post") {
    const rows = await tx.select({ title: posts.title, body: posts.body }).from(posts).where(eq(posts.tenantId, tenantId));
    return rows.some(r => normalize(r.title) === normalize(draft.title) || normalize(r.body) === normalize(draft.body));
  }
  return false;
}
async function mapCandidates(tx: Tx, run: typeof runs.$inferSelect, mapping: Mapping) {
  const [already] = await tx.select({ id: candidates.id }).from(candidates).where(and(eq(candidates.tenantId, run.tenantId), eq(candidates.runId, run.id), eq(candidates.state, "imported")));
  if (already) throw new Error("Nach einer Teilübernahme bitte nur einzelne Einträge korrigieren.");
  const parsed = parseSource(run.source!, run.format);
  const mapped = parsed.rows.map(raw => ({ raw, ...mapRow(raw, mapping, run.format) }));
  if (new Set(mapped.map(m => m.key)).size !== mapped.length) throw new Error("Die gewählte ID-Spalte enthält doppelte Kennungen.");
  const previous = await tx.select({ image: images }).from(images).innerJoin(candidates, and(eq(images.tenantId, candidates.tenantId), eq(images.candidateId, candidates.id))).where(and(eq(candidates.tenantId, run.tenantId), eq(candidates.runId, run.id)));
  for (const { image } of previous) await cleanImage(image, tx);
  await tx.delete(candidates).where(and(eq(candidates.tenantId, run.tenantId), eq(candidates.runId, run.id)));
  const seen = new Set<string>();
  for (const item of mapped) {
    const signature = `${item.draft.kind}:${normalize(item.draft.title)}`;
    const dup = seen.has(signature) || await duplicate(tx, run.tenantId, run.namespace, item.key, item.draft);
    seen.add(signature);
    const [candidate] = await tx.insert(candidates).values({ tenantId: run.tenantId, runId: run.id, raw: item.raw, sourceKey: item.key, draft: item.draft, warnings: item.warnings, duplicate: dup, selected: !dup && ["animal", "post"].includes(item.draft.kind) }).returning();
    if (item.images.length) await tx.insert(images).values(item.images.map(sourceUrl => ({ tenantId: run.tenantId, candidateId: candidate.id, sourceUrl })));
  }
  await tx.update(runs).set({ mapping, state: "review", error: null, updatedAt: new Date() }).where(ownRun(run.tenantId, run.id));
}
export async function setMapping(scope: TenantScope, userId: number, runId: number, input: Mapping) {
  const mapping = mappingSchema.parse(input);
  await db.transaction(async tx => { await lock(tx, scope.tenantId); await allowed(tx, scope.tenantId, userId); const run = await editable(tx, scope.tenantId, runId); await mapCandidates(tx, run, mapping); });
}
export async function saveCandidate(scope: TenantScope, userId: number, id: number, input: Draft, selected: boolean, textConfirmed: boolean) {
  if (typeof selected !== "boolean" || typeof textConfirmed !== "boolean") throw new Error("Ungültige Auswahl.");
  const draft = draftSchema.parse(input);
  await db.transaction(async tx => {
    await lock(tx, scope.tenantId); await allowed(tx, scope.tenantId, userId);
    const [candidate] = await tx.select().from(candidates).where(ownCandidate(scope.tenantId, id));
    if (!candidate || candidate.state === "imported") throw new Error("Eintrag nicht bearbeitbar.");
    const run = await editable(tx, scope.tenantId, candidate.runId);
    const [settings] = await tx.select().from(tenantSettings).where(eq(tenantSettings.tenantId, scope.tenantId));
    await tx.update(candidates).set({ draft, selected: draft.kind !== "skip" && selected, textConfirmed: draft.kind === "text" && textConfirmed, previousText: websiteText(settings, draft.textField), duplicate: await duplicate(tx, scope.tenantId, run.namespace, candidate.sourceKey, draft), state: "pending", error: null }).where(ownCandidate(scope.tenantId, id));
    await tx.update(runs).set({ state: "review", error: null, updatedAt: new Date() }).where(ownRun(scope.tenantId, run.id));
  });
}
async function stageImage(tx: Tx, tenantId: number, image: ImportImage, body: Buffer, ext: string) {
  if (body.length > MAX_UPLOAD_BYTES || !body.length || imageExtension(body) !== ext) throw new Error("Ungültiges Bild oder größer als 5 MB.");
  await tx.execute(sql`select pg_advisory_xact_lock(72, ${tenantId})`);
  await allowed(tx, tenantId);
  body = await normalizeUploadImage(body, ext);
  const type = ext === ".jpg" ? "image/jpeg" : `image/${ext.slice(1)}`;
  // Stable keys are persisted before any bytes are written, making crash cleanup possible.
  const stageKey = image.stageKey!;
  await putMedia(stageKey, body, type);
  await tx.update(images).set({ state: "ready", bytes: body.length, error: null, omitted: false }).where(ownImage(tenantId, image.id));
}
async function allocateImage(tx: Tx, image: ImportImage, ext: string) {
  if (image.stageKey) await cleanImage(image, tx);
  const name = randomBytes(12).toString("hex");
  const [allocated] = await tx.update(images).set({ stageKey: `t${image.tenantId}/import_${name}${ext}`, targetKey: `t${image.tenantId}/${name}${ext}`, bytes: 0, state: "pending" }).where(ownImage(image.tenantId, image.id)).returning();
  return allocated;
}
export async function uploadImportImage(scope: TenantScope, userId: number, candidateId: number, imageId: number | null, body: Buffer) {
  const ext = imageExtension(body);
  // Allocate in a committed transaction; the second transaction may fail or be interrupted.
  const allocated = await db.transaction(async tx => {
    await lock(tx, scope.tenantId); await allowed(tx, scope.tenantId, userId);
    const [candidate] = await tx.select().from(candidates).where(ownCandidate(scope.tenantId, candidateId));
    if (!candidate || candidate.state === "imported") throw new Error("Eintrag nicht bearbeitbar.");
    await editable(tx, scope.tenantId, candidate.runId);
    let image: ImportImage;
    if (imageId) {
      const [existing] = await tx.select().from(images).where(and(ownImage(scope.tenantId, imageId), eq(images.candidateId, candidateId)));
      if (!existing) throw new Error("Bild nicht gefunden."); image = existing;
    } else {
      const [{ n }] = await tx.select({ n: count() }).from(images).where(and(eq(images.tenantId, scope.tenantId), eq(images.candidateId, candidateId)));
      if (n >= MAX_IMAGES) throw new Error("Höchstens acht Bilder je Eintrag.");
      [image] = await tx.insert(images).values({ tenantId: scope.tenantId, candidateId, sourceUrl: "Datei-Upload" }).returning();
    }
    await touch(tx, scope.tenantId, candidate.runId);
    return allocateImage(tx, image, ext);
  });
  await db.transaction(async tx => {
    await lock(tx, scope.tenantId); await allowed(tx, scope.tenantId, userId);
    const [current] = await tx.select().from(images).where(ownImage(scope.tenantId, allocated.id));
    const [candidate] = await tx.select().from(candidates).where(ownCandidate(scope.tenantId, candidateId));
    if (!current || current.stageKey !== allocated.stageKey || !candidate) throw new Error("Bild wurde inzwischen geändert.");
    await editable(tx, scope.tenantId, candidate.runId);
    await stageImage(tx, scope.tenantId, current, body, ext);
  });
}
export async function omitImage(scope: TenantScope, userId: number, imageId: number, omitted: boolean) {
  if (typeof omitted !== "boolean") throw new Error("Ungültige Bildauswahl.");
  await db.transaction(async tx => {
    await lock(tx, scope.tenantId); await allowed(tx, scope.tenantId, userId);
    const [row] = await tx.select({ image: images, candidate: candidates }).from(images).innerJoin(candidates, and(eq(candidates.id, images.candidateId), eq(candidates.tenantId, images.tenantId))).where(ownImage(scope.tenantId, imageId));
    if (!row || row.candidate.state === "imported") throw new Error("Bild nicht bearbeitbar.");
    await editable(tx, scope.tenantId, row.candidate.runId);
    await tx.update(images).set({ omitted }).where(ownImage(scope.tenantId, imageId));
    await touch(tx, scope.tenantId, row.candidate.runId);
  });
}
export async function getImport(scope: TenantScope, runId?: number) {
  const [run] = await db.select().from(runs).where(runId ? ownRun(scope.tenantId, runId) : eq(runs.tenantId, scope.tenantId)).orderBy(sql`${runs.id} desc`).limit(1);
  if (!run) return null;
  const rows = await db.select().from(candidates).where(and(eq(candidates.tenantId, scope.tenantId), eq(candidates.runId, run.id))).orderBy(candidates.id);
  const photos = await db.select({ image: images }).from(images).innerJoin(candidates, and(eq(candidates.id, images.candidateId), eq(candidates.tenantId, images.tenantId))).where(and(eq(candidates.tenantId, scope.tenantId), eq(candidates.runId, run.id))).orderBy(images.id);
  const [settings] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, scope.tenantId));
  const [{ n }] = await db.select({ n: count() }).from(animals).where(eq(animals.tenantId, scope.tenantId));
  // Never serialize the original export or storage object keys to the client.
  return { id: run.id, revision: run.updatedAt.toISOString(), state: run.state, error: run.error, format: run.format, sourceName: run.sourceName, namespace: run.namespace, mapping: run.mapping, animalCount: n, public: true, settings: Object.fromEntries(["heroHeadline", "heroSubline", "tagline", "aboutIntro", "aboutWork", "aboutSupport"].map(k => [k, websiteText(settings, k) ?? ""])),
    candidates: rows.map(c => ({ ...c, images: photos.filter(p => p.image.candidateId === c.id).map(({ image: i }) => ({ id: i.id, sourceUrl: i.sourceUrl, state: i.state, omitted: i.omitted, bytes: i.bytes, error: i.error })), errors: validateDraft(c.draft) })),
  };
}
export type ImportView = NonNullable<Awaited<ReturnType<typeof getImport>>>;
export async function importImageBytes(scope: TenantScope, id: number) {
  const [image] = await db.select().from(images).where(ownImage(scope.tenantId, id));
  const key = image?.state === "attached" ? image.targetKey : image?.stageKey;
  if (!image || !key || !["ready", "attached"].includes(image.state)) return null;
  return { body: await readMedia(key), type: key.endsWith(".jpg") ? "image/jpeg" : key.endsWith(".png") ? "image/png" : "image/webp" };
}
async function validateSelection(tx: Tx, tenantId: number, runId: number) {
  await allowed(tx, tenantId);
  const rows = await tx.select().from(candidates).where(and(eq(candidates.tenantId, tenantId), eq(candidates.runId, runId), eq(candidates.selected, true)));
  const pending = rows.filter(c => c.state !== "imported");
  if (!pending.length) throw new Error("Bitte mindestens einen noch nicht übernommenen Eintrag auswählen.");
  const fields = new Set<string>();
  for (const c of pending) {
    const errors = validateDraft(c.draft);
    if (errors.length || c.draft.kind === "skip") throw new Error(`„${c.draft.title}“: Bitte die markierten Felder korrigieren.`);
    if (c.draft.kind === "text") {
      if (!c.textConfirmed || fields.has(c.draft.textField)) throw new Error("Vereinstexte einzeln bestätigen und jedes Zielfeld nur einmal auswählen.");
      fields.add(c.draft.textField);
    }
    const imgs = await tx.select().from(images).where(and(eq(images.tenantId, tenantId), eq(images.candidateId, c.id), eq(images.omitted, false)));
    if (imgs.some(i => i.state !== "ready")) throw new Error(`„${c.draft.title}“: Fehlende Bilder ersetzen oder ausdrücklich abwählen.`);
    if (c.draft.kind === "text" && imgs.length) throw new Error("Vereinstextfelder enthalten nur Text. Bilder bitte ausdrücklich abwählen.");
    if (c.draft.kind === "post" && imgs.length) throw new Error("Neuigkeiten enthalten hier nur Text. Bilder bitte ausdrücklich abwählen.");
  }
}
export async function approveImport(scope: TenantScope, userId: number, runId: number, confirmed: boolean, revision: string) {
  if (confirmed !== true) throw new Error("Bitte die Vorschau und die öffentliche Sichtbarkeit bestätigen.");
  await db.transaction(async tx => {
    await lock(tx, scope.tenantId); await allowed(tx, scope.tenantId, userId); const run = await editable(tx, scope.tenantId, runId);
    if (typeof revision !== "string" || run.updatedAt.toISOString() !== revision) throw new Error("Die Vorbereitung wurde inzwischen geändert. Bitte die aktuelle Vorschau erneut prüfen.");
    await validateSelection(tx, scope.tenantId, runId);
    await tx.update(candidates).set({ state: "pending", error: null }).where(and(eq(candidates.tenantId, scope.tenantId), eq(candidates.runId, runId), eq(candidates.state, "failed")));
    await tx.update(runs).set({ state: "approved", approvedBy: userId, error: null, updatedAt: new Date() }).where(ownRun(scope.tenantId, runId));
  });
}
export async function cancelImport(scope: TenantScope, userId: number, runId: number) {
  await db.transaction(async tx => {
    await lock(tx, scope.tenantId); await allowed(tx, scope.tenantId, userId);
    const [run] = await tx.select().from(runs).where(ownRun(scope.tenantId, runId));
    if (!run || ["completed", "cancelled"].includes(run.state)) return;
    await cleanupRun(tx, run, "cancelled");
  });
}
async function cleanupRun(tx: Tx, run: typeof runs.$inferSelect, state: string) {
  const imgs = await tx.select({ image: images }).from(images).innerJoin(candidates, and(eq(candidates.id, images.candidateId), eq(candidates.tenantId, images.tenantId))).where(and(eq(candidates.tenantId, run.tenantId), eq(candidates.runId, run.id)));
  for (const { image } of imgs) {
    await cleanImage(image, tx);
    await tx.update(images).set({ stageKey: null, ...(image.state !== "attached" ? { targetKey: null, state: "omitted" } : {}) }).where(ownImage(run.tenantId, image.id));
  }
  await tx.update(runs).set({ state, source: null, updatedAt: new Date() }).where(ownRun(run.tenantId, run.id));
}
async function uniqueSlug(tx: Tx, tenantId: number, title: string, kind: "animal" | "post") {
  const table = kind === "animal" ? animals : posts;
  const base = slugify(title).slice(0, 125) || "import";
  for (let i = 1; ; i++) { const slug = i === 1 ? base : `${base}-${i}`; const [row] = await tx.select({ id: table.id }).from(table).where(and(eq(table.tenantId, tenantId), eq(table.slug, slug))); if (!row) return slug; }
}
async function commitCandidate(tx: Tx, run: typeof runs.$inferSelect, c: Candidate) {
  // Use the same lock order as normal animal/post creation, then recheck live entitlements.
  await tx.execute(sql`select pg_advisory_xact_lock(79, ${run.tenantId})`);
  await tx.select().from(tenants).where(eq(tenants.id, run.tenantId)).for("update");
  await allowed(tx, run.tenantId, run.approvedBy ?? -1);
  if (validateDraft(c.draft).length) throw new Error("Inhalt ist ungültig. Bitte erneut prüfen.");
  const hash = sourceHash(run.namespace, c.sourceKey);
  if (await duplicate(tx, run.tenantId, run.namespace, c.sourceKey, c.draft)) {
    await tx.update(candidates).set({ state: "skipped", error: "Bereits vorhanden; unverändert ausgelassen." }).where(ownCandidate(run.tenantId, c.id)); return;
  }
  const imgs = await tx.select().from(images).where(and(eq(images.tenantId, run.tenantId), eq(images.candidateId, c.id), eq(images.omitted, false))).orderBy(images.id);
  if (imgs.some(i => i.state !== "ready" || !i.stageKey || !i.targetKey)) throw new Error("Bilder sind noch nicht vollständig geprüft.");
  if (c.draft.kind === "text" && imgs.length) throw new Error("Vereinstext erlaubt keine Bilder.");
  if (c.draft.kind === "post" && imgs.length) throw new Error("Neuigkeiten enthalten hier nur Text. Bilder bitte ausdrücklich abwählen.");
  for (const image of imgs) {
    const body = await readMedia(image.stageKey!);
    if (body.length !== image.bytes || body.length > MAX_UPLOAD_BYTES) throw new Error("Bild wurde verändert. Bitte erneut hochladen.");
    const ext = imageExtension(body);
    await putMedia(image.targetKey!, body, ext === ".jpg" ? "image/jpeg" : `image/${ext.slice(1)}`);
  }
  let targetId: number | null = null;
  if (c.draft.kind === "animal") {
    const [row] = await tx.insert(animals).values({ ...animalSchema.parse(animalValues(c.draft)), tenantId: run.tenantId, slug: await uniqueSlug(tx, run.tenantId, c.draft.title, "animal") }).returning(); targetId = row.id;
    if (imgs.length) await tx.insert(animalImages).values(imgs.map((i, sortOrder) => ({ tenantId: run.tenantId, animalId: row.id, url: `/uploads/${i.targetKey}`, sortOrder })));
  } else if (c.draft.kind === "post") {
    const [row] = await tx.insert(posts).values({ ...postSchema.parse(postValues(c.draft)), tenantId: run.tenantId, slug: await uniqueSlug(tx, run.tenantId, c.draft.title, "post") }).returning(); targetId = row.id;
  } else if (c.draft.kind === "text") {
    const [settings] = await tx.select().from(tenantSettings).where(eq(tenantSettings.tenantId, run.tenantId)).for("update");
    if (!settings || !c.textConfirmed || websiteText(settings, c.draft.textField) !== c.previousText) throw new Error("Vereinstext wurde inzwischen geändert. Vergleich bitte erneut bestätigen.");
    await tx.update(tenantSettings).set({ [c.draft.textField]: c.draft.body, website: importWebsiteText(settings.website, c.draft.textField, c.previousText, c.draft.body), websiteRevision: settings.websiteRevision + 1, updatedAt: new Date() }).where(eq(tenantSettings.tenantId, run.tenantId));
  } else throw new Error("Inhaltstyp fehlt.");
  await tx.insert(sources).values({ tenantId: run.tenantId, sourceHash: hash, kind: c.draft.kind, targetId });
  for (const image of imgs) await tx.update(images).set({ state: "attached" }).where(ownImage(run.tenantId, image.id));
  await tx.update(candidates).set({ state: "imported", targetId, error: null }).where(ownCandidate(run.tenantId, c.id));
}
async function recoverMedia(tenantId: number, runId: number) {
  await db.transaction(async tx => {
    await lock(tx, tenantId);
    const imgs = await tx.select({ image: images }).from(images).innerJoin(candidates, and(eq(candidates.id, images.candidateId), eq(candidates.tenantId, images.tenantId))).where(and(eq(candidates.tenantId, tenantId), eq(candidates.runId, runId)));
    for (const { image } of imgs) {
      if (image.state === "attached" && image.stageKey) {
        await removeMedia(image.stageKey, tx);
        await tx.update(images).set({ stageKey: null }).where(ownImage(tenantId, image.id));
      } else if (image.state !== "attached" && image.targetKey) await removeMedia(image.targetKey, tx);
    }
  });
}
/** One bounded turn per tenant. Repeated or interrupted calls resume from committed candidates. */
export async function runImports() {
  const deadline = Date.now() + 20_000;
  const pendingRuns = await db.select({ id: runs.id, tenantId: runs.tenantId }).from(runs).where(sql`${runs.state} in ('preparing', 'approved', 'processing') or (${runs.state} in ('review', 'failed') and (${runs.updatedAt} < now() - interval '24 hours' or exists(select 1 from ${images} join ${candidates} on ${candidates.id} = ${images.candidateId} and ${candidates.tenantId} = ${images.tenantId} where ${candidates.runId} = ${runs.id} and ${candidates.tenantId} = ${runs.tenantId} and ${images.state} = 'pending' and ${images.omitted} = false)))`).orderBy(runs.updatedAt).limit(20);
  let failures = false;
  for (const ref of pendingRuns) {
    if (Date.now() >= deadline) break;
    try {
      // A separate transaction holds the worker lock across committed staging transactions.
      await db.transaction(async outer => {
        const [held] = await outer.execute(sql`select pg_try_advisory_xact_lock(87, ${ref.tenantId}) as acquired`);
        if (!held.acquired) return;
        let run = (await db.select().from(runs).where(ownRun(ref.tenantId, ref.id)))[0];
        if (!run) return;
        await recoverMedia(run.tenantId, run.id);
        if (["preparing", "review", "failed"].includes(run.state) && Date.now() - run.updatedAt.getTime() > 86400_000) {
          await db.transaction(async tx => { await lock(tx, run.tenantId); const [fresh] = await tx.select().from(runs).where(ownRun(run.tenantId, run.id)); if (fresh && ["preparing", "review", "failed"].includes(fresh.state) && Date.now() - fresh.updatedAt.getTime() > 86400_000) await cleanupRun(tx, fresh, "cancelled"); }); return;
        }
        if (run.state === "preparing") {
          await db.transaction(async tx => {
            await lock(tx, run.tenantId); await allowed(tx, run.tenantId);
            const [fresh] = await tx.select().from(runs).where(ownRun(run.tenantId, run.id));
            if (fresh?.state !== "preparing") return;
            const result = parseSource(fresh.source!, fresh.format);
            const headers = [...new Set(result.rows.flatMap(r => Object.keys(r.fields)))];
            await mapCandidates(tx, fresh, suggestMapping(headers));
          });
          run = (await db.select().from(runs).where(ownRun(ref.tenantId, ref.id)))[0];
        }
        if (["review", "failed"].includes(run.state)) {
          const pending = await db.select({ image: images }).from(images).innerJoin(candidates, and(eq(candidates.id, images.candidateId), eq(candidates.tenantId, images.tenantId))).where(and(eq(candidates.tenantId, run.tenantId), eq(candidates.runId, run.id), eq(images.state, "pending"), eq(images.omitted, false))).orderBy(images.id).limit(3);
          for (const { image } of pending) {
            if (Date.now() >= deadline) break;
            try {
              const downloaded = await downloadImage(image.sourceUrl, { timeout: Math.max(1, deadline - Date.now()) });
              const allocated = await db.transaction(async tx => {
                await lock(tx, run.tenantId); await allowed(tx, run.tenantId); await editable(tx, run.tenantId, run.id);
                const [fresh] = await tx.select().from(images).where(ownImage(run.tenantId, image.id));
                if (!fresh || fresh.omitted || fresh.state !== "pending" || fresh.stageKey !== image.stageKey) return null;
                return allocateImage(tx, fresh, downloaded.ext);
              });
              if (!allocated) continue;
              await db.transaction(async tx => {
                await lock(tx, run.tenantId); await editable(tx, run.tenantId, run.id);
                const [fresh] = await tx.select().from(images).where(ownImage(run.tenantId, image.id));
                if (fresh?.stageKey === allocated.stageKey && !fresh.omitted) await stageImage(tx, run.tenantId, fresh, downloaded.body, downloaded.ext);
              });
            } catch (error) {
              await db.transaction(async tx => { await lock(tx, run.tenantId); await tx.update(images).set({ state: "failed", error: importError(error) }).where(and(ownImage(run.tenantId, image.id), eq(images.state, "pending"))); });
            }
          }
        }
        if (["approved", "processing"].includes(run.state)) {
          for (let batch = 0; batch < 5 && Date.now() < deadline; batch++) {
            const result = await db.transaction(async tx => {
              await lock(tx, run.tenantId);
              const [fresh] = await tx.select().from(runs).where(ownRun(run.tenantId, run.id));
              if (!fresh || !["approved", "processing"].includes(fresh.state)) return false;
              const [c] = await tx.select().from(candidates).where(and(eq(candidates.tenantId, run.tenantId), eq(candidates.runId, run.id), eq(candidates.selected, true), eq(candidates.state, "pending"))).orderBy(candidates.id).limit(1);
              if (!c) { await cleanupRun(tx, fresh, "completed"); return false; }
              await tx.update(runs).set({ state: "processing" }).where(ownRun(run.tenantId, run.id));
              try { await tx.transaction(async savepoint => commitCandidate(savepoint, fresh, c)); }
              catch (error) {
                const imgs = await tx.select().from(images).where(and(eq(images.tenantId, run.tenantId), eq(images.candidateId, c.id)));
                for (const image of imgs) if (image.targetKey && image.state !== "attached") await removeMedia(image.targetKey, tx);
                await tx.update(candidates).set({ state: "failed", error: importError(error) }).where(ownCandidate(run.tenantId, c.id));
                await tx.update(runs).set({ state: "failed", error: "Ein Eintrag benötigt Prüfung. Bereits übernommene Inhalte bleiben erhalten.", updatedAt: new Date() }).where(ownRun(run.tenantId, run.id));
                failures = true; return false;
              }
              return true;
            });
            await recoverMedia(run.tenantId, run.id);
            if (!result) break;
          }
        }
      });
    } catch (error) {
      failures = true;
      await db.transaction(async tx => {
        await lock(tx, ref.tenantId);
        await tx.update(runs).set({ state: "failed", error: importError(error), updatedAt: new Date() }).where(and(ownRun(ref.tenantId, ref.id), inArray(runs.state, ["preparing", "approved", "processing"])));
      });
    }
  }
  if (failures) throw new Error("Inhaltsimport benötigt Prüfung.");
}
