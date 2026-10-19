"use client";
import { useActionState } from "react";
import { saveDonations } from "@/lib/actions/donations";
import type { getDonations } from "@/lib/donations";
import type { FormState } from "@/lib/form";
import { TextField, TextArea } from "./fields";
import { SaveBar } from "./save-bar";
export function DonationsForm({ values }: { values: Awaited<ReturnType<typeof getDonations>> }) {
  const [state, action, pending] = useActionState(saveDonations, {} as FormState);
  const fields = [
    ["heading", "Überschrift"], ["accountHolder", "Kontoinhaber"], ["iban", "IBAN"], ["bic", "BIC"], ["bankName", "Bank"], ["purpose", "Verwendungszweck"],
  ] as const;
  return <form action={action} className="max-w-2xl space-y-5">
    {fields.map(([name, label]) => <TextField key={name} name={name} label={label} defaultValue={values[name]} error={state.fieldErrors?.[name]} />)}
    <TextArea name="introduction" label="Einleitung" defaultValue={values.introduction} error={state.fieldErrors?.introduction} />
    <TextArea name="receiptNote" label="Hinweis zur Spendenbescheinigung" defaultValue={values.receiptNote} error={state.fieldErrors?.receiptNote} />
    <p className="text-sm text-ink/60">Ohne Kontoinhaber und IBAN zeigt die öffentliche Seite keine Bankverbindung.</p>
    <SaveBar state={state} pending={pending} />
  </form>;
}
