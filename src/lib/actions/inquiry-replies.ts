"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireArea } from "../auth";
import { replyToInquiry } from "../inquiry-replies";
import { zodErrorState, type FormState } from "../form";
export async function sendInquiryReply(_previous: FormState, data: FormData): Promise<FormState> {
  const actor = await requireArea("inquiries");
  const parsed = z.object({ inquiryId: z.coerce.number().int().positive(), requestId: z.uuid(), body: z.string().trim().min(10, "Die Antwort sollte mindestens 10 Zeichen enthalten.").max(10000) }).safeParse(Object.fromEntries(data));
  if (!parsed.success) return zodErrorState(parsed.error);
  const result = await replyToInquiry(actor, parsed.data);
  revalidatePath("/admin/anfragen");
  return result;
}
