import { test, expect, type Page } from "@playwright/test";
import postgres from "postgres";
import sharp from "sharp";
const email = "browser-owner@example.test";
async function mailText() {
  const response = await fetch("http://127.0.0.1:55441/api/v1/message/latest");
  expect(response.ok).toBe(true);
  return ((await response.json()) as { Text: string }).Text;
}
async function loginPassword(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Benutzername").fill(process.env.INITIAL_ADMIN_USERNAME!);
  await page.getByLabel("Passwort", { exact: true }).fill(process.env.INITIAL_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await page.waitForURL("/admin");
  const tour = page.getByRole("dialog");
  if (await tour.isVisible()) await page.getByRole("button", { name: "Rundgang überspringen", exact: true }).click();
}
test("Sicherheitsabläufe: Code, Login-Link, Profilmedien und mobile Navigation", async ({ page, browser, request }, info) => {
  expect(process.env.DATABASE_URL).toMatch(/^postgres(?:ql)?:\/\/[^/]+@127\.0\.0\.1:55439\//);
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const [original] = await sql`select id,email,email_verified,recovery_email,recovery_email_verified_at from users where username=${process.env.INITIAL_ADMIN_USERNAME!}`;
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  try {
    await sql`update users set email=${email},email_verified=true,recovery_email=${email},recovery_email_verified_at=now() where id=${original.id}`;
    await page.goto("/admin/login");
    const codeSection = page.getByRole("region", { name: "Mit E-Mail-Code anmelden" });
    await codeSection.getByLabel("Bestätigte persönliche E-Mail-Adresse").fill(email);
    await codeSection.getByRole("button", { name: "Code anfordern", exact: true }).click();
    await expect(codeSection.getByRole("form", { name: "E-Mail-Code bestätigen" })).toBeVisible();
    const code = /\b(\d{6})\b/.exec(await mailText())?.[1]; expect(code).toBeTruthy();
    await codeSection.getByRole("textbox", { name: /^Sechsstelliger Code/ }).fill(code!);
    await codeSection.getByRole("button", { name: "Code bestätigen", exact: true }).click();
    await page.waitForURL("/admin");
    if (await page.getByRole("dialog").isVisible()) await page.getByRole("button", { name: "Rundgang überspringen", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    const more = page.locator(".admin-more"); await more.locator("summary").click();
    await more.getByRole("link", { name: "Konto und Sicherheit", exact: true }).click();
    await expect(more).not.toHaveAttribute("open", "");
    await expect(page.getByRole("heading", { name: "Konto und Sicherheit", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath("account-mobile.png"), fullPage: true });
    const profileForm = page.locator("form").filter({ has: page.getByLabel("Anzeigename", { exact: true }) });
    await profileForm.getByLabel("Anzeigename", { exact: true }).fill("Browser QA Person");
    await profileForm.getByLabel("Privates Profilbild", { exact: true }).setInputFiles({ name: "qa-profile.png", mimeType: "image/png", buffer: await sharp({ create: { width: 16, height: 16, channels: 3, background: "blue" } }).png().toBuffer() });
    await profileForm.getByRole("button", { name: "Profil speichern", exact: true }).click();
    await expect(page.getByRole("img", { name: "Eigenes Profilbild", exact: true })).toBeVisible();
    const profileImage = await page.getByRole("img", { name: "Eigenes Profilbild", exact: true }).getAttribute("src"); expect(profileImage).toBeTruthy();
    expect((await request.get(profileImage!)).status()).toBe(404);
    expect((await page.request.get(profileImage!)).status()).toBe(200);
    expect((await page.request.get("/api/admin/notifications")).status()).toBe(200);
    expect((await request.get("/api/admin/notifications")).status()).toBe(401);
    expect((await request.post("/api/auth/pfotenweb/verified-session", { data: { userId: original.id } })).status()).toBe(404);
    const other = await browser.newContext({ ignoreHTTPSErrors: true });
    try {
      const magic = await other.newPage(); await magic.goto(new URL("/admin/login", page.url()).href);
      await magic.getByText("Einmaligen Login-Link verwenden", { exact: true }).click();
      const form = magic.locator("form").filter({ has: magic.getByRole("button", { name: "Einmaligen Login-Link anfordern", exact: true }) });
      await form.getByLabel("Bestätigte persönliche E-Mail-Adresse").fill(email);
      await form.getByRole("button", { name: "Einmaligen Login-Link anfordern", exact: true }).click();
      await expect(form.getByRole("status")).toBeVisible();
      const link = /https?:\/\/\S+#token=\S+/.exec(await mailText())?.[0]; expect(link).toBeTruthy();
      await magic.goto(link!);
      await expect(magic.getByRole("button", { name: "Anmeldung bestätigen", exact: true })).toBeEnabled();
      expect(new URL(magic.url()).hash).toBe("");
      await magic.getByRole("button", { name: "Anmeldung bestätigen", exact: true }).click(); await magic.waitForURL("/admin");
    } finally { await other.close(); }
    expect(errors).toEqual([]);
  } finally {
    await sql`update users set email=${original.email},email_verified=${original.email_verified},recovery_email=${original.recovery_email},recovery_email_verified_at=${original.recovery_email_verified_at} where id=${original.id}`;
    await sql.end();
  }
});
test("Vorhandene Passwortanmeldung funktioniert im Produktionsbuild", async ({ page }) => { await loginPassword(page); await expect(page.getByRole("heading", { name: "Guten Tag!" })).toBeVisible(); });

test("Passkey, frische Bestätigung, passwortlose Einladung und Sitzungswiderruf", async ({ page, context, browser, browserName }) => {
  test.skip(browserName !== "chromium", "Virtual WebAuthn authenticator requires Chromium CDP");
  test.setTimeout(60000);
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const username = `qa-invite-${Date.now()}`;
  const invitedEmail = `${username}@example.test`;
  const client = await context.newCDPSession(page);
  await client.send("WebAuthn.enable");
  await client.send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  const [owner] = await sql`select id from users where username=${process.env.INITIAL_ADMIN_USERNAME!}`;
  const oldKeys = await sql`select id from auth_passkeys where user_id=${owner.id}`;
  const other = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    await loginPassword(page);
    await page.goto("/admin/konto");
    await sql`update auth_sessions set reauthenticated_at=now() - interval '2 hours' where user_id=${owner.id}`;
    expect((await page.request.get("/api/auth/passkey/generate-register-options")).status()).toBe(403);
    const confirmation = page.locator("form").filter({ has: page.getByRole("button", { name: "Passwort bestätigen", exact: true }) });
    await confirmation.getByLabel("Aktuelles Passwort zur Bestätigung").fill(process.env.INITIAL_ADMIN_PASSWORD!);
    await confirmation.getByRole("button", { name: "Passwort bestätigen", exact: true }).click();
    await expect(confirmation.getByRole("status")).toContainText("Bestätigt");
    await page.getByRole("button", { name: "Passkey hinzufügen", exact: true }).click();
    await expect.poll(async () => Number((await sql`select count(*)::int as n from auth_passkeys where user_id=${owner.id}`)[0].n)).toBe(oldKeys.length + 1);
    await page.locator(".admin-account-menu summary").click();
    await page.getByRole("button", { name: "Abmelden", exact: true }).click(); await page.waitForURL("/admin/login");
    await page.getByRole("button", { name: "Mit Passkey anmelden", exact: true }).click(); await page.waitForURL("/admin");
    await page.goto("/admin/team");
    const invitation = page.locator("form").filter({ has: page.getByRole("button", { name: "Einladung verschicken", exact: true }) });
    await invitation.getByLabel("Benutzername").fill(username); await invitation.getByLabel("Persönliche E-Mail-Adresse").fill(invitedEmail);
    await invitation.getByRole("button", { name: "Einladung verschicken", exact: true }).click();
    await expect(invitation.getByRole("status").filter({ hasText: "Einladung wurde verschickt" })).toBeVisible();
    const text = await mailText(); const link = /https?:\/\/\S+#token=\S+/.exec(text)?.[0]; const code = /\b(\d{6})\b/.exec(text)?.[1]; expect(link).toBeTruthy(); expect(code).toBeTruthy();
    const member = await other.newPage(); await member.goto(link!);
    await member.getByLabel("Sechsstelliger Code aus der Einladung").fill(code!);
    await member.getByRole("button", { name: "Einladung annehmen", exact: true }).click(); await member.waitForURL("/admin");
    if (await member.getByRole("dialog").isVisible()) await member.getByRole("button", { name: "Rundgang überspringen", exact: true }).click();
    const [invited] = await sql`select id,permissions from users where username=${username}`; expect(invited.permissions).toEqual([]);
    expect((await member.request.get("/admin/tiere", { maxRedirects: 0 })).status()).toBe(307);
    expect((await sql`select count(*)::int as n from auth_accounts where user_id=${invited.id}`)[0].n).toBe(0);
    await sql`update users set active=false where id=${invited.id}`;
    expect((await member.request.get("/api/admin/notifications")).status()).toBe(401);
  } finally {
    await other.close(); await client.detach();
    await sql`delete from users where username=${username}`;
    const currentKeys = await sql`select id from auth_passkeys where user_id=${owner.id}`;
    for (const key of currentKeys) if (!oldKeys.some(old => old.id === key.id)) await sql`delete from auth_passkeys where id=${key.id}`;
    await sql.end();
  }
});
