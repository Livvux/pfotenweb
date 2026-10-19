"use client";

import Image from "next/image";
import { Check, Copy, Mail, Share2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./share-animal.module.css";

export function ShareAnimal({ url, name }: { url: string; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [open, setOpen] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFallback, setCopyFallback] = useState(false);
  const [status, setStatus] = useState("");
  const text = `${name} – Tierprofil`;
  const links = [
    { label: "WhatsApp", icon: "whatsapp", color: "#25D366", href: `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}` },
    { label: "Facebook", icon: "facebook", color: "#0866FF", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { label: "Telegram", icon: "telegram", color: "#26A5E4", href: `https://t.me/share/url?${new URLSearchParams({ url, text })}` },
    { label: "X", icon: "x", color: "#000000", href: `https://x.com/intent/post?${new URLSearchParams({ url, text })}` },
  ];
  const emailHref = `mailto:?${new URLSearchParams({ subject: text, body: `${text}\n${url}` }).toString().replaceAll("+", "%20")}`;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  function showDialog() {
    setStatus("");
    setCopied(false);
    setCopyFallback(false);
    setCanShare(typeof navigator.share === "function");
    dialog.current?.showModal();
    setOpen(true);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setCopyFallback(false);
      setStatus("Link kopiert.");
    } catch {
      setCopyFallback(true);
      setStatus("Bitte den Link auswählen und kopieren.");
    }
  }

  async function share() {
    try {
      await navigator.share({ title: text, url });
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        setStatus("Teilen nicht möglich. Bitte den Link kopieren.");
      }
    }
  }

  return (
    <div className="mt-6">
      <button ref={trigger} type="button" onClick={showDialog} aria-haspopup="dialog" className={styles.trigger}>
        <Share2 size={18} strokeWidth={1.8} aria-hidden="true" />
        Teilen
      </button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          // Keep keyboard navigation in the sheet instead of the browser chrome.
          const controls = event.currentTarget.querySelectorAll<HTMLElement>("button, a[href], input");
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onClose={() => { setOpen(false); trigger.current?.focus(); }}
        onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}
      >
        <div className={styles.panel}>
          <div className={styles.handle} aria-hidden="true" />
          <header className={styles.header}>
            <div className="min-w-0">
              <h2 id={titleId} className="text-xl font-semibold tracking-tight">Teilen</h2>
              <p id={descriptionId} className="mt-1 break-words text-sm text-ink/60">{name} · Tierprofil</p>
            </div>
            <button type="button" autoFocus className={styles.close} aria-label="Schließen" onClick={() => dialog.current?.close()}>
              <X size={20} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </header>
          <div className={styles.platforms}>
            {links.map(({ label, icon, color, href }) => (
              <a key={icon} href={href} target="_blank" rel="noopener noreferrer" className={styles.platform}>
                <span className={styles.logo} style={{ backgroundColor: color }}>
                  <Image src={`/images/share/${icon}.svg`} alt="" width={28} height={28} unoptimized />
                </span>
                <span>{label}</span>
              </a>
            ))}
          </div>
          <div className={styles.actions}>
            <button type="button" onClick={copyLink} className={styles.action}>
              {copied ? <Check size={20} aria-hidden="true" /> : <Copy size={20} strokeWidth={1.8} aria-hidden="true" />}
              {copied ? "Link kopiert" : "Link kopieren"}
            </button>
            <a href={emailHref} className={styles.action}>
              <Mail size={20} strokeWidth={1.8} aria-hidden="true" />E-Mail
            </a>
            {canShare && <button type="button" onClick={share} className={styles.action}>
              <Share2 size={20} strokeWidth={1.8} aria-hidden="true" />Weitere Apps
            </button>}
          </div>
          {copyFallback && <label className="mt-4 block text-sm font-medium">
            Link zum Tierprofil
            <input type="text" readOnly value={url} onFocus={(event) => event.currentTarget.select()} className={styles.url} />
          </label>}
          <p className="mt-4 text-xs leading-relaxed text-ink/60">
            {canShare ? "Für Instagram: „Weitere Apps“ nutzen oder den Link kopieren." : "Für Instagram den Link kopieren und dort einfügen."}
          </p>
          <p role="status" className={status ? "mt-3 text-sm text-brand-700" : "sr-only"}>{status}</p>
        </div>
      </dialog>
    </div>
  );
}
