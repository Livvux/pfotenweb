import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listTeamProfiles } from "@/lib/account";
export default async function TeamProfilesPage() {
  const actor = await requireAdmin();
  const profiles = await listTeamProfiles(actor.scope);
  return <div className="space-y-6"><div className="flex flex-wrap justify-between gap-3"><h1 className="text-3xl font-serif">Unser Team</h1><Link href="/admin/konto" className="admin-button">Eigenes Profil bearbeiten</Link></div><p>Diese Profile sind nur im angemeldeten Vereinsteam sichtbar.</p><ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{profiles.map(profile => <li key={profile.id} className="rounded-2xl bg-white border border-stone-200 p-5 space-y-3">{profile.profileImage && <Image src={profile.profileImage} alt={`Profilbild ${profile.displayName || profile.username}`} width={80} height={80} unoptimized className="h-20 w-20 object-cover rounded-full"/>}<h2 className="text-xl font-semibold">{profile.displayName || profile.username}</h2>{profile.profileRole && <p className="text-sm font-medium text-stone-600">{profile.profileRole}</p>}{profile.bio && <p className="whitespace-pre-line text-sm">{profile.bio}</p>}</li>)}</ul></div>;
}
