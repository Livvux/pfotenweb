"use client";
import { useActionState } from "react";
import Image from "next/image";
import { saveOwnProfile } from "@/lib/actions/profile";
import type { FormState } from "@/lib/form";
import { TextArea, TextField } from "./fields";
import { SaveBar } from "./save-bar";
export function ProfileForm({ profile }: { profile: { displayName: string | null; profileRole: string | null; bio: string | null; profileImage: string | null; updatedAt: Date } }) {
  const [state, action, pending] = useActionState(saveOwnProfile, {} as FormState);
  return <form action={action} className="space-y-4"><input type="hidden" name="revision" value={profile.updatedAt.toISOString()}/><TextField name="displayName" label="Anzeigename" defaultValue={profile.displayName}/><TextField name="profileRole" label="Aufgabe im Verein" defaultValue={profile.profileRole}/><TextArea name="bio" label="Über die Person (intern, bis 500 Zeichen)" defaultValue={profile.bio}/>{profile.profileImage && <div className="space-y-2"><Image src={profile.profileImage} alt="Eigenes Profilbild" width={96} height={96} unoptimized className="h-24 w-24 rounded-full object-cover"/><label className="flex gap-2"><input name="removeImage" type="checkbox"/> Profilbild entfernen</label></div>}<label className="grid gap-2">Privates Profilbild<input name="image" type="file" accept="image/jpeg,image/png,image/webp"/></label><p className="text-sm">Profilangaben und Bild sind ausschließlich für das angemeldete Vereinsteam sichtbar.</p><SaveBar state={state} pending={pending} label="Profil speichern" successText="Profil gespeichert. Nur im angemeldeten Vereinsteam sichtbar."/></form>;
}
