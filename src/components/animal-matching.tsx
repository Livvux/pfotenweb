"use client";

import { useState } from "react";
import Link from "next/link";
import { animalMatch, type MatchPreferences } from "@/lib/animal-matching";
import type { AnimalProfile } from "@/lib/animal-profile-fields";
import { an } from "@/lib/anrede";
import { useAnrede } from "@/components/anrede-provider";

export type MatchingAnimal = { id: number; name: string; slug: string; status: string; profile: AnimalProfile };
export function AnimalMatching({ animals }: { animals: MatchingAnimal[] }) {
  const anrede = useAnrede();
  const [preferences, setPreferences] = useState<MatchPreferences>({ housing: "", children: false, dogs: false, cats: false, experience: "", activity: "" });
  const [show, setShow] = useState(false);
  const results = animals.map(animal => ({ animal, match: animalMatch(animal.status, animal.profile, preferences) }));
  const candidates = results.filter(({ match }) => !match.conflicts.length);
  return <details className="mt-6 rounded-2xl border border-brand-100 bg-white p-5">
    <summary className="min-h-11 cursor-pointer font-semibold text-brand-900">{an(anrede, "Welches Tier könnte zu Ihrem Alltag passen?", "Welches Tier könnte zu deinem Alltag passen?")}</summary>
    <p className="my-3 max-w-[65ch] text-sm text-ink/70">{an(anrede, "Eine Orientierung zu den Tieren auf dieser Ergebnisseite anhand der Vereinsangaben. Fehlende Informationen bleiben offen. Der Verein klärt im Gespräch, welches Zuhause passt. Ihre Antworten bleiben in diesem Tab.", "Eine Orientierung zu den Tieren auf dieser Ergebnisseite anhand der Vereinsangaben. Fehlende Informationen bleiben offen. Der Verein klärt im Gespräch, welches Zuhause passt. Deine Antworten bleiben in diesem Tab.")}</p>
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="text-sm font-medium">Wohnumgebung<select value={preferences.housing} onChange={event => { const housing = event.target.value; if (housing === "" || housing === "wohnung" || housing === "haus" || housing === "haus-mit-garten") { setPreferences({ ...preferences, housing }); setShow(false); } }} className="mt-1 min-h-11 w-full rounded-xl border p-2"><option value="">Bitte auswählen</option><option value="wohnung">Wohnung</option><option value="haus">Haus</option><option value="haus-mit-garten">Haus mit Garten</option></select></label>
      <label className="text-sm font-medium">Erfahrung<select value={preferences.experience} onChange={event => { const experience = event.target.value; if (experience === "" || experience === "anfaenger" || experience === "erfahren") { setPreferences({ ...preferences, experience }); setShow(false); } }} className="mt-1 min-h-11 w-full rounded-xl border p-2"><option value="">Bitte auswählen</option><option value="anfaenger">Noch wenig Erfahrung</option><option value="erfahren">Erfahrung vorhanden</option></select></label>
      <label className="text-sm font-medium">{an(anrede, "Ihr Aktivitätsniveau", "Dein Aktivitätsniveau")}<select value={preferences.activity} onChange={event => { const activity = event.target.value; if (activity === "" || activity === "ruhig" || activity === "mittel" || activity === "aktiv") { setPreferences({ ...preferences, activity }); setShow(false); } }} className="mt-1 min-h-11 w-full rounded-xl border p-2"><option value="">Bitte auswählen</option><option value="ruhig">Ruhig</option><option value="mittel">Mittel</option><option value="aktiv">Aktiv</option></select></label>
    </div>
    <fieldset className="my-4 flex flex-wrap gap-4"><legend className="mb-2 text-sm font-medium">Wer lebt bereits im Haushalt?</legend>{([["children", "Kinder"], ["dogs", "Hunde"], ["cats", "Katzen"]] as const).map(([key, label]) => <label key={key} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={preferences[key]} onChange={event => { setPreferences({ ...preferences, [key]: event.target.checked }); setShow(false); }} />{label}</label>)}</fieldset>
    <button type="button" onClick={() => setShow(true)} disabled={!preferences.housing || !preferences.experience || !preferences.activity} className="min-h-11 rounded-xl bg-brand-800 px-5 py-2 font-semibold text-white disabled:opacity-50">Angaben vergleichen</button>
    <noscript><p>{an(anrede, "Die Orientierung benötigt JavaScript. Alle Tiere und die normale Suche finden Sie unten.", "Die Orientierung benötigt JavaScript. Alle Tiere und die normale Suche findest du unten.")}</p></noscript>
    <div aria-live="polite" className="mt-4 space-y-4">{show && <>
      <p>{candidates.length ? `${candidates.length} Tiere ohne erkannten Ausschluss. Offene Fragen sind keine bestätigte Eignung.` : an(anrede, "Für diese Angaben gibt es derzeit keine Tiere ohne erkannten Ausschluss. Bitte sprechen Sie mit dem Verein.", "Für diese Angaben gibt es derzeit keine Tiere ohne erkannten Ausschluss. Bitte sprich mit dem Verein.")}</p>
      {candidates.map(({ animal, match }) => <section key={animal.id} className="rounded-xl border p-4"><h2 className="font-semibold"><Link className="underline" href={`/tiere/${animal.slug}`}>{animal.name}</Link></h2>
        {match.reasons.length > 0 && <><p className="mt-2 text-sm font-medium">Was laut Steckbrief passen könnte</p><ul className="list-disc pl-5 text-sm">{match.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></>}
        {match.questions.length > 0 && <><p className="mt-2 text-sm font-medium">Vorher mit dem Verein klären</p><ul className="list-disc pl-5 text-sm">{match.questions.map(question => <li key={question}>{question}</li>)}</ul></>}
      </section>)}
      {results.some(({ match }) => match.conflicts.length) && <details><summary className="min-h-11 cursor-pointer">Warum weitere Tiere hier nicht erscheinen</summary>{results.filter(({ match }) => match.conflicts.length).map(({ animal, match }) => <p key={animal.id} className="mt-2 text-sm">{animal.name}: {match.conflicts.join(" ")}</p>)}</details>}
    </>}</div>
  </details>;
}
