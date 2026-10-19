"use client";
import { useActionState } from "react";
import { sendInquiryReply } from "@/lib/actions/inquiry-replies";
import type { FormState } from "@/lib/form";
import { TextArea, FormAlert } from "./fields";
export function InquiryReplyForm({ inquiryId, requestId, email }: { inquiryId: number; requestId: string; email: string }) {
  const [state, action, pending] = useActionState(sendInquiryReply, {} as FormState);
  if (state.success) return <p role="status">Antwort an den Mailserver übergeben. Das bestätigt keine Zustellung.</p>;
  return <form action={action} className="mt-4 space-y-3" aria-label="Anfrage beantworten">
    <input type="hidden" name="inquiryId" value={inquiryId}/><input type="hidden" name="requestId" value={requestId}/>
    <p className="text-sm">Empfänger: {email}</p><TextArea name="body" label="Antwort" required rows={6} error={state.fieldErrors?.body}/>
    <FormAlert state={state}/><button type="submit" disabled={pending} className="admin-button admin-primary">{pending ? "Wird übergeben …" : "Antwort versenden"}</button>
  </form>;
}
