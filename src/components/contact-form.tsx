"use client";

import { useActionState } from "react";
import { contactAction, type ContactState } from "@/lib/actions/contact";

const initial: ContactState = {};

export function ContactForm({
  subject,
  animalId,
}: {
  subject?: string;
  animalId?: number;
}) {
  const [state, formAction, pending] = useActionState(contactAction, initial);

  if (state.success) {
    return (
      <div className="rounded-3xl bg-brand-50 p-8 ring-1 ring-brand-100">
        <h2 className="font-display text-xl font-semibold text-brand-900">
          Danke für Ihre Nachricht!
        </h2>
        <p className="mt-2 leading-relaxed text-ink/70">
          Wir haben Ihre Anfrage erhalten und melden uns so schnell wie
          möglich – meistens innerhalb von zwei Tagen.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {animalId ? (
        <input type="hidden" name="animalId" value={animalId} />
      ) : null}
      {/* Honeypot – Menschen sehen dieses Feld nicht */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium">
            Name *
          </label>
          <input
            id="name"
            name="name"
            required
            autoComplete="name"
            className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            E-Mail *
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </div>
      </div>
      <div>
        <label htmlFor="subject" className="mb-1 block text-sm font-medium">
          Betreff
        </label>
        <input
          id="subject"
          name="subject"
          defaultValue={subject}
          className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
        />
      </div>
      <div>
        <label htmlFor="message" className="mb-1 block text-sm font-medium">
          Nachricht *
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
        />
      </div>
      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand-800 px-7 py-3.5 font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Wird gesendet …" : "Nachricht senden"}
      </button>
      <p className="text-xs leading-relaxed text-ink/50">
        Mit dem Absenden erklären Sie sich damit einverstanden, dass wir Ihre
        Angaben zur Bearbeitung der Anfrage speichern. Details in unserer
        Datenschutzerklärung.
      </p>
    </form>
  );
}
