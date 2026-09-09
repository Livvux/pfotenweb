import { requireOwner } from "@/lib/auth";
import { countOwners, listUsers } from "@/lib/users";
import {
  EigenesPasswortForm,
  NeuerBenutzerForm,
  TeamZeile,
} from "@/components/admin/team-forms";

export default async function TeamPage() {
  const eigen = await requireOwner();
  const [team, ownerZahl] = await Promise.all([
    listUsers(eigen.scope),
    countOwners(eigen.scope),
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
        Zugänge
      </h1>
      <p className="mt-2 text-ink/60">
        Wer darf die Seite pflegen? Legen Sie für jede Person einen eigenen
        Zugang an, statt ein Passwort weiterzugeben. So sehen Sie, wer arbeitet,
        und können einen Zugang einzeln entfernen.
      </p>

      <ul className="mt-6 divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
        {team.map((user) => (
          <TeamZeile
            key={user.id}
            user={user}
            selbst={user.id === eigen.id}
            // Der letzte Verantwortliche bleibt stehen, sonst sperrt sich der
            // Verein aus. Die Aktion prueft das ebenfalls, hier verschwindet
            // der Knopf nur schon vorher aus dem Weg.
            letzterOwner={user.role === "owner" && ownerZahl === 1}
          />
        ))}
      </ul>

      <section className="mt-10 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200 md:p-8">
        <h2 className="font-display text-xl font-semibold text-ink">
          Neuen Zugang anlegen
        </h2>
        <div className="mt-5">
          <NeuerBenutzerForm />
        </div>
      </section>

      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200 md:p-8">
        <h2 className="font-display text-xl font-semibold text-ink">
          Eigenes Passwort ändern
        </h2>
        <div className="mt-5">
          <EigenesPasswortForm />
        </div>
      </section>
    </div>
  );
}
