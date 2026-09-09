import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";
import { BrandMark } from "@/components/brand-mark";
import { TenantTheme } from "@/components/tenant-theme";
import { getSettings, requireTenant } from "@/lib/tenant";

export const metadata: Metadata = { title: "Anmeldung – Verwaltung" };

export default async function LoginPage() {
  if (await getAdminUser()) redirect("/admin");
  // Der Verein kommt aus dem Host, nicht aus dem Formular. Wer sich anmeldet,
  // sieht den Namen seines eigenen Vereins.
  const tenant = await requireTenant();
  const settings = await getSettings(tenant.id);

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4">
      <TenantTheme />
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl shadow-stone-200/60">
        <div className="mb-8 flex flex-col items-center gap-3">
          <BrandMark
            logoUrl={settings?.logoUrl ?? null}
            className="h-12 w-12"
            fallbackClassName="text-brand-800"
          />
          <h1 className="font-serif text-2xl text-stone-900">
            Verwaltung {settings?.shortName ?? ""}
          </h1>
          <p className="text-sm text-stone-500">
            Nur für berechtigte Vereinsmitglieder.
          </p>
        </div>
        <LoginForm />
        <Link
          href="/"
          className="mt-6 block text-center text-sm text-stone-500 transition hover:text-stone-700"
        >
          ← Zurück zur Webseite
        </Link>
      </div>
    </main>
  );
}
