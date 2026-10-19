import Link from "next/link";
import type { ReactNode } from "react";
export function SecurityPage({ title, children }: { title: string; children: ReactNode }) {
  return <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-4 py-12"><h1 className="font-display text-3xl">{title}</h1>{children}<Link className="inline-block py-3 underline" href="/admin/login">Zur Anmeldung</Link></main>;
}
