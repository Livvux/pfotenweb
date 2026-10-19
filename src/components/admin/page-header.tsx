import type { ReactNode } from "react";
import Link from "next/link";
export function PageHeader({ title, eyebrow, description, action }: { title: string; eyebrow?: string; description?: string; action?: ReactNode }) {
  return <header className="flex flex-wrap items-start justify-between gap-4"><div>{eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-500">{eyebrow}</p>}<h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>{description && <p className="mt-3 max-w-2xl text-sm text-stone-600">{description}</p>}</div>{action}</header>;
}
export function StatCard({ label, value, href }: { label: string; value: number; href?: string }) {
  const content = <><p className="font-serif text-4xl text-brand-800">{value.toLocaleString("de-DE")}</p><p className="mt-2 text-sm text-stone-600">{label}</p></>;
  const classes = "block rounded-2xl border border-stone-200 bg-white p-5 shadow-sm";
  return href ? <Link href={href} className={`${classes} transition hover:border-brand-300`} aria-label={`${label}: ${value.toLocaleString("de-DE")}`}>{content}</Link> : <div className={classes}>{content}</div>;
}
