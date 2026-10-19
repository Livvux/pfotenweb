"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "../auth";
import { approveImport, cancelImport, importError, omitImage, saveCandidate, setMapping } from "../content-import/service";
import type { Draft, Mapping } from "../content-import/types";

export async function editImportCandidate(id: number, draft: Draft, selected: boolean, textConfirmed: boolean) {
  const user = await requireOwner();
  try { await saveCandidate(user.scope, user.id, id, draft, selected, textConfirmed); revalidatePath("/admin/import"); return { success: true }; }
  catch (error) { return { error: importError(error) }; }
}
export async function mapImport(runId: number, mapping: Mapping) {
  const user = await requireOwner();
  try { await setMapping(user.scope, user.id, runId, mapping); revalidatePath("/admin/import"); return { success: true }; }
  catch (error) { return { error: importError(error) }; }
}
export async function toggleImportImage(imageId: number, omitted: boolean) {
  const user = await requireOwner();
  try { await omitImage(user.scope, user.id, imageId, omitted); revalidatePath("/admin/import"); return { success: true }; }
  catch (error) { return { error: importError(error) }; }
}
export async function confirmImport(runId: number, confirmed: boolean, revision: string) {
  const user = await requireOwner();
  try { await approveImport(user.scope, user.id, runId, confirmed, revision); revalidatePath("/admin/import"); return { success: true }; }
  catch (error) { return { error: importError(error) }; }
}
export async function abortImport(runId: number) {
  const user = await requireOwner();
  try { await cancelImport(user.scope, user.id, runId); revalidatePath("/admin/import"); return { success: true }; }
  catch (error) { return { error: importError(error) }; }
}
