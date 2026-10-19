"use client";
import { useState } from "react";
import { an } from "@/lib/anrede";
import { useAnrede } from "./anrede-provider";
import { routeLinks, type ShelterLocation as Location } from "@/lib/location-rules";

export function ShelterLocation({ location }: { location: Location | null }) {
  const [loaded, setLoaded] = useState(false);
  const address = useAnrede();
  if (!location?.enabled || location.lat === null || location.lng === null) return null;
  const { lat, lng } = location;
  const bounds = [Math.max(-180, lng - .015), Math.max(-85, lat - .01), Math.min(180, lng + .015), Math.min(85, lat + .01)];
  const params = new URLSearchParams({ bbox: bounds.join(","), layer: "mapnik", marker: `${lat},${lng}` });
  return <section aria-label="Standort und Anfahrt" className="mt-10 space-y-4 rounded-2xl border border-stone-200 p-5">
    <h2 className="font-display text-2xl">{an(address, "Ihr Weg zu uns", "Dein Weg zu uns")}</h2>
    <p className="whitespace-pre-line">{location.address}</p>
    {loaded ? <><iframe title="Standort auf OpenStreetMap" src={`https://www.openstreetmap.org/export/embed.html?${params}`} className="h-80 w-full rounded-xl border-0" referrerPolicy="no-referrer"/><button type="button" onClick={() => setLoaded(false)} className="min-h-11 underline">Karte schließen</button></> : <div className="rounded-xl bg-stone-100 p-5"><p className="mb-3 text-sm">Die Karte wird erst nach Klick geladen. Dabei wird eine Verbindung zu OpenStreetMap hergestellt.</p><button type="button" onClick={() => setLoaded(true)} className="min-h-11 rounded-full bg-brand-800 px-5 text-white">Karte laden</button></div>}
    <details><summary className="min-h-11 cursor-pointer py-3 font-semibold">Route zum Tierheim</summary><ul>{routeLinks(lat, lng).map(link => <li key={link.name}><a href={link.href} target="_blank" rel="noopener noreferrer" className="inline-block min-h-11 py-3 underline">{link.name}</a></li>)}</ul></details>
  </section>;
}
