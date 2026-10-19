import { test, expect, type Page } from "@playwright/test";
import postgres from "postgres";
import { createHash } from "node:crypto";
import sharp from "sharp";

test.beforeAll(() => {
  expect(process.env.DATABASE_URL).toMatch(/^postgres(?:ql)?:\/\/[^/]+@127\.0\.0\.1:55439\//);
});
async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Benutzername").fill(process.env.INITIAL_ADMIN_USERNAME!);
  await page.getByLabel("Passwort", { exact: true }).fill(process.env.INITIAL_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await page.waitForURL("/admin");
 await page.getByRole("dialog").waitFor({state:"visible",timeout:1500}).then(async () => { await page.getByRole("button",{name:"Rundgang überspringen",exact:true}).click(); await expect(page.getByRole("dialog")).not.toBeVisible(); }).catch(() => {});
}

test("Website: privater Entwurf, geschützte Bilder, Veröffentlichung und Revisionskonflikt", async ({ page, browser, request }, info) => {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const [original] = await sql`SELECT website, website_revision FROM association_settings WHERE tenant_id=1`;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const other = await browser.newContext();
  try {
    await login(page);
    await page.goto("/admin/website");
    const second = await other.newPage();
    await login(second);
    await second.goto("/admin/website");
    const form = page.getByRole("form", { name: "Website gestalten" });
    await form.locator('[name="element:home-hero-e:title"]').fill("Privater QA-Entwurf");
    const image = await sharp({ create: { width: 24, height: 24, channels: 3, background: "green" } }).png().toBuffer();
    await page.getByLabel("Bild in den privaten Entwurf laden").setInputFiles({ name: "qa.png", mimeType: "image/png", buffer: image });
    await expect.poll(async () => Number((await sql`SELECT jsonb_array_length(website_media) AS n FROM association_settings WHERE tenant_id=1`)[0].n)).toBeGreaterThan(0);
    const [stored] = await sql`SELECT website_media FROM association_settings WHERE tenant_id=1`;
    const imageUrl = stored.website_media.at(-1).url;
    expect((await request.get(imageUrl)).status()).toBe(404);
    expect((await page.request.get(imageUrl)).status()).toBe(200);
    await form.getByRole("button", { name: "Entwurf speichern", exact: true }).click();
    await expect(form.getByRole("status")).toHaveText("Website gespeichert.");
    const publicPage = await other.newPage();
    await publicPage.goto("/");
    await expect(publicPage.getByRole("heading", { name: "Privater QA-Entwurf", exact: true })).toHaveCount(0);
    await second.getByRole("button", { name: "Entwurf speichern", exact: true }).click();
    await expect(second.getByRole("form", { name: "Website gestalten" }).getByRole("alert")).toContainText("anderen Tab");
    await expect(second.getByRole("button", { name: "Veröffentlichen", exact: true })).toBeDisabled();
    await Promise.all([page.waitForResponse(response => response.request().method() === "POST" && response.url().includes("/admin/website")), form.getByRole("button", { name: "Veröffentlichen", exact: true }).click()]);
    await expect(form.getByRole("status")).toHaveText("Website gespeichert.");
    await publicPage.reload();
    await expect(publicPage.getByRole("heading", { name: "Privater QA-Entwurf", exact: true })).toBeVisible();
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`website-editor-${width}.png`), fullPage: true });
    }
    expect(errors).toEqual([]);
  } finally {
    await other.close();
    await sql`UPDATE association_settings SET website=${sql.json(original.website)}, website_revision=${original.website_revision} WHERE tenant_id=1`;
    await sql.end();
  }
});

test("Kontakt: drei Felder, Einwilligungstext und Smartphone ohne JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.goto("/kontakt");
    for (const name of ["Name *", "E-Mail *", "Nachricht *"]) await expect(page.getByLabel(name, { exact: true })).toBeVisible();
    await expect(page.locator('input[name="subject"]:not([type="hidden"])')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});

test("Standortkarte: keine Fremdanfrage vor Klick und erreichbare Navigation", async ({ page }) => {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const [original] = await sql`SELECT location FROM association_settings WHERE tenant_id=1`;
  let externalRequests = 0;
  await page.route("https://www.openstreetmap.org/**", async route => {
    externalRequests++;
    await route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Lokale Kartenprobe</title><p>Karte</p>" });
  });
  try {
    await sql`UPDATE association_settings SET location=${sql.json({ enabled: true, address: "QA-Besuchsadresse", lat: 52.5, lng: 13.4 })} WHERE tenant_id=1`;
    await page.goto("/kontakt");
    await expect(page.getByRole("heading", { name: "Ihr Weg zu uns" })).toBeVisible();
    expect(externalRequests).toBe(0);
    await expect(page.locator("iframe")).toHaveCount(0);
    await page.getByRole("button", { name: "Karte laden", exact: true }).click();
    await expect(page.getByTitle("Standort auf OpenStreetMap")).toBeVisible();
    await expect.poll(() => externalRequests).toBe(1);
    await page.getByText("Route zum Tierheim", { exact: true }).click();
    await expect(page.getByRole("link", { name: "OpenStreetMap", exact: true })).toHaveAttribute("href", /directions\?route=/);
    await page.getByRole("button", { name: "Karte schließen" }).click();
    await expect(page.locator("iframe")).toHaveCount(0);
  } finally {
    await sql`UPDATE association_settings SET location=${sql.json(original.location)} WHERE tenant_id=1`;
    await sql.end();
  }
});

test("Fotos: Vorbereitung sperrt Auswahl und Speichern, Anhängen und Entfernen bleiben verlustfrei", async ({ page }) => {
  await login(page);
  await page.goto("/admin/tiere/neu");
  await page.evaluate(() => {
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = async function () {
      await new Promise(resolve => setTimeout(resolve, 1500));
      return decode.call(this);
    };
  });
  const buffer = await sharp({ create: { width: 24, height: 24, channels: 3, background: "red" } }).png().toBuffer();
  const file = { name: "qa.png", mimeType: "image/png", buffer };
  const input = page.locator('input[name="photos"]');
  await input.setInputFiles(file);
  await expect(input).toBeDisabled();
  await expect(page.getByRole("button", { name: "Fotos werden vorbereitet …", exact: true })).toBeDisabled();
  await expect(input).toBeEnabled();
  await input.setInputFiles(file);
  await expect(input).toBeDisabled();
  await expect(input).toBeEnabled();
  await expect(page.locator("figure img")).toHaveCount(2);
  await page.getByRole("button", { name: "Ausgewähltes Foto 1 entfernen", exact: true }).click();
  await expect(page.locator("figure img")).toHaveCount(1);
  expect(await input.evaluate((element: HTMLInputElement) => element.files?.length)).toBe(1);
});

test("Zusatzfotos erhalten das bestehende Titelbild und PDF/QR bleiben erreichbar", async ({ page, request }) => {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const { mkdir, writeFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const suffix = Date.now().toString(16).padStart(24, "0");
  const cover = `/uploads/t1/${suffix}.png`;
  const [animal] = await sql`insert into animals(tenant_id,name,slug,species,description) values(1,'QA Titelbild',${`qa-cover-${suffix}`},'hund','Fiktive Beschreibung für die Titelbildprüfung.') returning id,public_id`;
  try {
    await mkdir(path.join(process.env.UPLOAD_DIR!, "t1"), { recursive: true });
    await writeFile(path.join(process.env.UPLOAD_DIR!, "t1", `${suffix}.png`), await sharp({ create: { width: 24, height: 24, channels: 3, background: "red" } }).png().toBuffer());
    await sql`insert into animal_images(tenant_id,animal_id,url,sort_order) values(1,${animal.id},${cover},0)`;
    await login(page); await page.goto(`/admin/tiere/${animal.id}`);
    await page.locator('input[name="photos"]').setInputFiles({ name: "additional.png", mimeType: "image/png", buffer: await sharp({ create: { width: 24, height: 24, channels: 3, background: "blue" } }).png().toBuffer() });
    await page.getByText("Steckbriefvorschau", { exact: true }).click();
    await expect(page.getByRole("img", { name: "Aktuelles Titelbild", exact: true })).toHaveAttribute("src", cover);
    await page.getByRole("button", { name: "Änderungen speichern", exact: true }).click(); await page.waitForURL("/admin/tiere");
    const images = await sql`select url from animal_images where animal_id=${animal.id} order by sort_order,id`; expect(images.length).toBe(2); expect(images[0].url).toBe(cover);
    const pdf = await page.request.get(`/api/tiere/${animal.id}/steckbrief`); expect(pdf.status()).toBe(200); expect((await pdf.body()).subarray(0,5).toString()).toBe("%PDF-");
    expect((await request.get(`/api/tiere/${animal.id}/steckbrief`)).status()).toBe(401);
    await sql`update animals set slug=${`qa-renamed-${suffix}`} where id=${animal.id}`;
    const stable = await request.get(`/tier/${animal.public_id}`, { maxRedirects: 0 }); expect(stable.status()).toBe(307); expect(stable.headers().location).toContain(`qa-renamed-${suffix}`);
  } finally { await sql`delete from animals where id=${animal.id}`; await sql.end(); }
});

test("Vier Stilwelten: Smartphone, Desktop und lesbare Buttons bei heller Vereinsfarbe", async ({ page, browser }, info) => {
  test.setTimeout(60000);
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const [original] = await sql`select website,website_revision from association_settings where tenant_id=1`;
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const publicPage = await context.newPage();
  const errors: string[] = []; publicPage.on("pageerror", error => errors.push(error.message));
  try {
    await login(page); await page.goto("/admin/website");
    const form = page.getByRole("form", { name: "Website gestalten" });
    await form.getByText("Design", { exact: true }).click();
    await form.locator('[name="design:primary"]').fill("#ffff00");
    await form.locator('[name="design:accent"]').fill("#ffff00");
    for (const style of ["wiesengrund", "seeblick", "pfotenfreunde", "lichtblick"]) {
      await form.locator('[name="design:style"]').selectOption(style);
      await form.getByRole("button", { name: "Veröffentlichen", exact: true }).click();
      await expect(form.getByRole("status")).toContainText("Website gespeichert");
      await publicPage.goto(new URL("/", page.url()).href);
      for (const width of [390, 1440]) {
        await publicPage.setViewportSize({ width, height: 900 });
        expect(await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const buttons = publicPage.locator(".pw-button"); expect(await buttons.count()).toBeGreaterThan(0);
        const contrasts = await buttons.evaluateAll(elements => elements.map(element => {
          const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
          const context = canvas.getContext("2d")!;
          const luminance = (color: string) => { context.fillStyle = "white"; context.fillRect(0,0,1,1); context.fillStyle = color; context.fillRect(0,0,1,1); const rgb = [...context.getImageData(0,0,1,1).data].slice(0,3).map(v => { const s = v / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; }); return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]; };
          const style = getComputedStyle(element); const fg = luminance(style.color); const bg = luminance(style.backgroundColor); return (Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);
        }));
        for (const contrast of contrasts) expect(contrast).toBeGreaterThanOrEqual(4.5);
        await publicPage.screenshot({ path: info.outputPath(`${style}-${width}.png`), fullPage: true });
      }
    }
    expect(errors).toEqual([]);
  } finally {
    await context.close(); await sql`update association_settings set website=${original.website ? sql.json(original.website) : null},website_revision=${original.website_revision} where tenant_id=1`; await sql.end();
  }
});

test("Geführter CSV-Import: redaktionelle Korrektur, Bildersatz und Wiederholung am Smartphone", async ({ page, request }, info) => {
  test.setTimeout(90000);
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const source = `qa-source-${Date.now()}`;
  const name = `QA Import ${Date.now()}`;
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  try {
    await login(page); await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/admin/import");
    const csv = `id;name;beschreibung;tierart;bilder\nqa1;${name};Ein fiktiver Hund sucht für diesen Test ein Zuhause.;falsch;http://127.0.0.1/private.jpg`;
    async function upload() {
      await page.getByLabel("Bisherige Website / Quellenkennung").fill(source);
      await page.getByLabel("Quelldatei").setInputFiles({ name: "tiere.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
      await page.getByRole("button", { name: "Quelle hochladen", exact: true }).click();
      await expect(page.getByRole("article", { name: `Importeintrag ${name}`, exact: true })).toBeVisible({ timeout: 30000 });
    }
    await upload();
    await page.getByRole("article", { name: `Importeintrag ${name}`, exact: true }).getByRole("combobox", { name: "Tierart", exact: true }).selectOption("hund");
    await page.getByRole("button", { name: "Speichern und Bilder prüfen", exact: true }).click();
    await expect(page.getByText(/Bildadresse/)).toBeVisible({ timeout: 30000 });
    await page.getByLabel("Bild ersetzen", { exact: true }).setInputFiles({ name: "ersatz.png", mimeType: "image/png", buffer: await sharp({ create: { width: 24, height: 24, channels: 3, background: "green" } }).png().toBuffer() });
    await expect(page.getByText("Bild geprüft", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Zur Vorschau", exact: true }).click();
    await expect(page.getByText("Tierprofil wird auf der Vereinswebsite sichtbar.", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath("guided-import-mobile.png"), fullPage: true });
    await page.getByRole("button", { name: "Zur Bestätigung", exact: true }).click();
    await page.getByLabel("Ich habe Inhalte, Bilder und Sichtbarkeit").check();
    await page.getByRole("button", { name: "Verbindlich übernehmen", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Abgeschlossen: 1 übernommen", { timeout: 30000 });
    expect(Number((await sql`select count(*)::int as n from animals where name=${name}`)[0].n)).toBe(1);
    await page.getByRole("button", { name: "Neuen Import starten", exact: true }).click(); await upload();
    await expect(page.getByLabel("Diesen Eintrag übernehmen")).not.toBeChecked();
    expect((await page.request.post("/api/import", { headers: { origin: "https://foreign.example" }, data: csv })).status()).toBe(403);
    expect((await request.get("/import-vorlage-tiere.csv")).status()).toBe(200);
    expect((await request.get("/import-vorlage-neuigkeiten.csv")).status()).toBe(200);
    expect(errors).toEqual([]);
  } finally {
    await sql`delete from content_import_runs where namespace=${source}`;
    await sql`delete from content_import_sources where tenant_id=1 and source_hash=${createHash("sha256").update(`${source}\nqa1`).digest("hex")}`;
    await sql`delete from animals where name=${name}`; await sql.end();
  }
});

test("Tierpflege ohne JavaScript: alle Pflichtfelder und native Fotoübermittlung", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const name = `QA ohne JS ${Date.now()}`;
  try {
    await login(page); await page.goto("/admin/tiere/neu");
    await page.getByRole("textbox", { name: "Name *", exact: true }).fill(name);
    await page.getByRole("textbox", { name: "Beschreibung *", exact: true }).fill("Ein fiktives Tier für die vollständige Formularprüfung ohne JavaScript.");
    await page.getByRole("radio", { name: "Hund", exact: true }).check();
    await page.locator('input[name="photos"]').setInputFiles({ name: "no-js.png", mimeType: "image/png", buffer: await sharp({ create: { width: 16, height: 16, channels: 3, background: "green" } }).png().toBuffer() });
    await page.getByRole("button", { name: "Tier anlegen", exact: true }).click(); await page.waitForURL(/\/admin\/tiere\/\d+$/);
    const [animal] = await sql`select id from animals where name=${name}`; expect(animal).toBeTruthy();
    expect(Number((await sql`select count(*)::int as n from animal_images where animal_id=${animal.id}`)[0].n)).toBe(1);
  } finally { await context.close(); await sql`delete from animals where name=${name}`; await sql.end(); }
});
