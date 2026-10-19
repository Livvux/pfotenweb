"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Bell, Building2, ChartNoAxesColumn, ChevronRight, Download, HeartHandshake, House, Menu, Newspaper, PawPrint, ShieldCheck, Users, X } from "lucide-react";
import { finishAdminTour, openNewInquiries } from "@/lib/actions/admin-shell";
type Item = { href: string; label: string };
const icons = { "/admin": House, "/admin/tiere": PawPrint, "/admin/aktuelles": Newspaper, "/admin/anfragen": Bell, "/admin/verein": Building2, "/admin/daten": Download, "/admin/website": ChartNoAxesColumn, "/admin/spenden": HeartHandshake, "/admin/konto": ShieldCheck, "/admin/team": Users };
export function AdminShell({ children, brand, account, nav, unread: initialUnread, inquiriesAllowed, firstVisit }: { children: ReactNode; brand: ReactNode; account: ReactNode; nav: Item[]; unread: number; inquiriesAllowed: boolean; firstVisit: boolean }) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(initialUnread);
  const [tour, setTour] = useState(firstVisit);
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const moreMenu = useRef<HTMLDetailsElement>(null);
  const accountMenu = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (moreMenu.current) moreMenu.current.open = false; if (accountMenu.current) accountMenu.current.open = false; }, [pathname]);
  useEffect(() => { if (tour) dialog.current?.showModal(); }, [tour]);
  useEffect(() => {
    if (!inquiriesAllowed) return;
    let active = true;
    const controller = new AbortController();
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try { const response = await fetch("/api/admin/notifications", { cache: "no-store", signal: controller.signal }); if (!response.ok) return; const data: { unread: number } = await response.json(); if (active && Number.isSafeInteger(data.unread) && data.unread >= 0) setUnread(data.unread); } catch { /* Keep the last confirmed count when temporarily offline. */ }
    };
    const interval = setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { active = false; controller.abort(); clearInterval(interval); document.removeEventListener("visibilitychange", refresh); };
  }, [inquiriesAllowed]);
  const link = (item: Item) => {
    const Icon = icons[item.href as keyof typeof icons] ?? House;
    const current = item.href === "/admin" ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
    return <Link key={item.href} href={item.href} aria-current={current ? "page" : undefined} className="admin-nav-link"><Icon size={20} aria-hidden/><span>{item.label}</span></Link>;
  };
  const steps = [
    { title: "Willkommen in der Vereinsverwaltung", text: "Die Navigation führt zu den freigegebenen Aufgaben. Nicht freigegebene Bereiche bleiben geschützt." },
    { title: "In kleinen Schritten beginnen", text: "Die Übersicht zeigt den Einrichtungsstand. Tiere und Beiträge können zunächst als Entwurf vorbereitet werden." },
    { title: "Konto und Sicherheit", text: "Unter Konto lassen sich das persönliche Profil, bestätigte E-Mail-Adresse und Passkeys pflegen. Die Website bleibt über den Link in der Kopfzeile erreichbar." },
  ];
  const closeTour = () => startTransition(async () => { await finishAdminTour(); dialog.current?.close(); setTour(false); });
  return <div className="admin-shell min-h-screen bg-paper">
    <aside className="admin-sidebar"><div className="admin-brand">{brand}</div><nav aria-label="Verwaltung">{nav.map(link)}</nav><button className="admin-button" onClick={() => { setStep(0); setTour(true); }}>Rundgang öffnen</button></aside>
    <div className="admin-workspace"><header className="admin-topbar"><div className="admin-mobile-brand">{brand}</div><Link href="/" target="_blank" rel="noopener noreferrer" className="admin-button">Website ansehen <ChevronRight size={16} aria-hidden/></Link><div className="admin-topbar-actions">{inquiriesAllowed && <form action={openNewInquiries}><button className="admin-button" aria-label={unread ? `${unread} neue Anfragen` : "Anfragen öffnen"}><Bell size={20} aria-hidden/>{unread > 0 && <span className="admin-notification-count">{unread > 99 ? "99+" : unread}</span>}</button></form>}<details ref={accountMenu} className="admin-account-menu"><summary className="admin-button">Konto</summary><div>{account}<button className="admin-button" onClick={() => { setStep(0); setTour(true); }}>Rundgang öffnen</button></div></details></div></header>
    <main className="admin-main">{children}</main></div>
    <nav className="admin-bottom-tabs" aria-label="Schnellnavigation">{nav.filter(item => ["/admin", "/admin/tiere", "/admin/anfragen"].includes(item.href)).map(link)}<details ref={moreMenu} className="admin-more"><summary className="admin-nav-link"><Menu size={20} aria-hidden/><span>Mehr</span></summary><div>{nav.filter(item => !["/admin", "/admin/tiere", "/admin/anfragen"].includes(item.href)).map(link)}</div></details></nav>
    <dialog ref={dialog} className="admin-tour" aria-labelledby="admin-tour-title" onCancel={event => { event.preventDefault(); closeTour(); }}><div className="flex justify-between items-center"><p className="text-sm text-stone-500">Rundgang {step + 1} / {steps.length}</p><button aria-label="Rundgang überspringen" disabled={pending} onClick={closeTour}><X size={20}/></button></div><h2 id="admin-tour-title" className="text-2xl font-serif my-4">{steps[step].title}</h2><p>{steps[step].text}</p><div className="flex justify-between gap-3 mt-6"><button className="admin-button" disabled={pending} onClick={closeTour}>Überspringen</button>{step < steps.length - 1 ? <button className="admin-button admin-primary" onClick={() => setStep(step + 1)}>Weiter</button> : <button className="admin-button admin-primary" disabled={pending} onClick={closeTour}>Los geht’s</button>}</div></dialog>
  </div>;
}
