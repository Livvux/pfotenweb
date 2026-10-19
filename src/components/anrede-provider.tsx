"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Anrede } from "@/lib/anrede";

/*
 * Anrede fuer Client-Komponenten. Das Website-Layout setzt die Anrede der
 * Besucher, das Verwaltungslayout die des Teams; Vorschauen der Website in der
 * Verwaltung setzen wieder die Besucheranrede. Ohne Provider: Sie.
 */
const AnredeContext = createContext<Anrede>("sie");

export function AnredeProvider({ value, children }: { value: Anrede; children: ReactNode }) {
  return <AnredeContext.Provider value={value}>{children}</AnredeContext.Provider>;
}

export function useAnrede(): Anrede {
  return useContext(AnredeContext);
}
