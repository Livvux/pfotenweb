import { test, expect } from "@playwright/test";
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
