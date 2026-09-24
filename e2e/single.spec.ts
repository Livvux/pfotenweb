import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

test("Single-Installation: Anmeldung, Bilder, Export und keine Plattform",async({page,request})=>{
 const errors:string[]=[];
 page.on("pageerror",e=>errors.push(e.message));
 for (const url of ["/plattform","/plattform/registrieren","/preise","/admin/abrechnung","/api/stripe/webhook"]) expect((await request.get(url)).status()).toBe(404);
 await page.goto("/");
 await expect(page.getByRole("heading").first()).toBeVisible();
 await page.goto("/admin/login");
 await page.getByLabel("Benutzername").fill(process.env.INITIAL_ADMIN_USERNAME!);
 await page.getByLabel("Passwort").fill(process.env.INITIAL_ADMIN_PASSWORD!);
 await page.getByRole("button",{name:"Anmelden"}).click();
 await page.waitForURL("/admin");
 await page.goto("/admin/tiere");
 await expect(page.getByRole("heading",{name:"Tiere",exact:true})).toBeVisible();
 await page.goto("/admin/daten");
 await page.getByLabel("Ihr aktuelles Passwort").fill(process.env.INITIAL_ADMIN_PASSWORD!);
 const waiting=page.waitForEvent("download");
 await page.getByRole("button",{name:"Export herunterladen"}).click();
 expect(await (await waiting).failure()).toBeNull();
 if (process.env.E2E_IMPORTED === "true") {
 await page.goto("/tiere/balou");
 await expect(page.getByRole("heading",{name:"Balou",exact:true})).toBeVisible();
 await expect.poll(()=>page.locator("img").evaluateAll((images)=>images.every(img=>img instanceof HTMLImageElement && img.complete && img.naturalWidth>0))).toBe(true);
 } else { await page.goto("/tiere"); }
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:"/tmp/pfotenweb-single-mobile.png",fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);
});

test.describe("Tierfilter: Basisfunktion ohne neue Module", () => {
  const suffix = randomUUID().slice(0, 8);
  const names = {
    dogAvailable: `Filtertest Hund frei ${suffix}`,
    dogReserved: `Filtertest Hund reserviert ${suffix}`,
    catAvailable: `Filtertest Katze frei ${suffix}`,
  };
  let sql: ReturnType<typeof postgres> | undefined;
  let fixtureIds: number[] = [];

  test.beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("Tierfilter-E2E benötigen DATABASE_URL einer Testinstallation.");
    }
    sql = postgres(process.env.DATABASE_URL, { max: 1 });
    // Eine atomare Einfügung; nur selbst erzeugte IDs werden wieder entfernt.
    const rows = await sql<{ id: number }[]>`
      INSERT INTO animals (tenant_id, slug, name, species, description, status)
      VALUES
        (1, ${`filtertest-hund-frei-${suffix}`}, ${names.dogAvailable}, 'hund', 'Fiktives Tier für den Filtertest.', 'vermittelbar'),
        (1, ${`filtertest-hund-reserviert-${suffix}`}, ${names.dogReserved}, 'hund', 'Fiktives Tier für den Filtertest.', 'reserviert'),
        (1, ${`filtertest-katze-frei-${suffix}`}, ${names.catAvailable}, 'katze', 'Fiktives Tier für den Filtertest.', 'vermittelbar')
      RETURNING id
    `;
    fixtureIds = rows.map((row) => row.id);
  });

  test.afterAll(async () => {
    if (!sql) return;
    try {
      for (const id of fixtureIds) {
        await sql`DELETE FROM animals WHERE tenant_id = 1 AND id = ${id}`;
      }
    } finally {
      await sql.end({ timeout: 5 });
    }
  });

  test("Art und Status kombinieren, wechseln und vollständig zurücksetzen", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/tiere");
    const filters = page.getByRole("navigation", { name: "Tierfilter" });
    const dog = filters.getByRole("link", { name: "Hund", exact: true });
    const reserved = filters.getByRole("link", { name: "Reserviert", exact: true });
    const all = filters.getByRole("link", { name: "Alle", exact: true });

    await expect(dog).toHaveAttribute("href", "/tiere?art=hund");
    await dog.click();
    await expect(page).toHaveURL(/\/tiere\?art=hund$/);
    await expect(page.getByText(names.dogAvailable, { exact: true })).toBeVisible();
    await expect(page.getByText(names.catAvailable, { exact: true })).toHaveCount(0);

    await reserved.click();
    await expect(page).toHaveURL(/\/tiere\?art=hund&status=reserviert$/);
    await expect(dog).toHaveAttribute("aria-current", "true");
    await expect(reserved).toHaveAttribute("aria-current", "true");
    await expect(page.getByText(names.dogReserved, { exact: true })).toBeVisible();
    await expect(page.getByText(names.dogAvailable, { exact: true })).toHaveCount(0);

    await filters.getByRole("link", { name: "Katze", exact: true }).click();
    await expect(page).toHaveURL(/\/tiere\?art=katze&status=reserviert$/);
    for (const name of Object.values(names)) {
      await expect(page.getByText(name, { exact: true })).toHaveCount(0);
    }

    await expect(all).toHaveAttribute("href", "/tiere");
    await all.click();
    await expect(page).toHaveURL(/\/tiere$/);
    await expect(all).toHaveAttribute("aria-current", "true");
    for (const name of Object.values(names)) {
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  const cases = [
    { query: "species=hund", visible: ["dogAvailable", "dogReserved"], active: ["Hund"] },
    { query: "species=hund&status=reserviert", visible: ["dogReserved"], active: ["Hund", "Reserviert"] },
    { query: "art=katze&species=hund", visible: ["catAvailable"], active: ["Katze"] },
    { query: "art=ungueltig&species=hund", visible: ["dogAvailable", "dogReserved"], active: ["Hund"] },
    { query: "art=hund&art=katze&species=hund", visible: Object.keys(names), active: ["Alle"] },
    { query: "species=hund&species=katze", visible: Object.keys(names), active: ["Alle"] },
    { query: "art=hund&status=reserviert&status=vermittelbar", visible: ["dogAvailable", "dogReserved"], active: ["Hund"] },
    { query: "art=constructor&status=toString", visible: Object.keys(names), active: ["Alle"] },
  ];
  for (const { query, visible, active } of cases) {
    test(`Geteilte und ungültige Links: ${query}`, async ({ page }) => {
      await page.goto(`/tiere?${query}`);
      const filters = page.getByRole("navigation", { name: "Tierfilter" });
      for (const [key, name] of Object.entries(names)) {
        const animal = page.getByText(name, { exact: true });
        if (visible.includes(key)) await expect(animal).toBeVisible();
        else await expect(animal).toHaveCount(0);
      }
      await expect(filters.locator('[aria-current="true"]')).toHaveText(active);
      for (const href of await filters.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")))) {
        expect(href).not.toContain("species=");
      }
    });
  }

  test("Smartphone: erreichbare Filter, Tastatur und reduzierte Bewegung", async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/tiere?art=hund&status=reserviert");
    const filters = page.getByRole("navigation", { name: "Tierfilter" });
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const link of await filters.getByRole("link").all()) {
        const bounds = await link.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.height).toBeGreaterThanOrEqual(44);
        expect(bounds!.width).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    const all = filters.getByRole("link", { name: "Alle", exact: true });
    await all.focus();
    await expect(all).toBeFocused();
    await expect(all).toHaveCSS("transition-duration", "0s");
    await all.press("Enter");
    await expect(page).toHaveURL(/\/tiere$/);
    await expect(all).toHaveAttribute("aria-current", "true");
    await page.screenshot({ path: testInfo.outputPath("tierfilter-mobile.png"), fullPage: true });
  });
});
