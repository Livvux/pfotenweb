"use client";
import { useActionState } from "react";
import { locationDefaults, type ShelterLocation } from "@/lib/location-rules";
import { saveLocation } from "@/lib/actions/location";
import type { FormState } from "@/lib/form";
import { TextArea, TextField } from "./fields";
import { SaveBar } from "./save-bar";
export function LocationForm({ location }: { location: ShelterLocation | null }) {
  const value = location ?? locationDefaults;
  const [state, action, pending] = useActionState(saveLocation, {} as FormState);
  return <form action={action} className="space-y-5"><label className="flex items-center gap-2"><input type="checkbox" name="enabled" defaultChecked={value.enabled}/> Standortkarte anzeigen</label><TextArea name="address" label="Besuchsadresse" defaultValue={value.address}/><div className="grid gap-5 sm:grid-cols-2"><TextField name="lat" label="Breitengrad" defaultValue={value.lat} hint="Dezimalzahl zwischen −85 und 85"/><TextField name="lng" label="Längengrad" defaultValue={value.lng} hint="Dezimalzahl zwischen −180 und 180"/></div><p className="text-sm">Besuchsadresse und Kartenpunkt werden öffentlich angezeigt. Die Karte lädt erst nach Zustimmung.</p><SaveBar state={state} pending={pending}/></form>;
}
