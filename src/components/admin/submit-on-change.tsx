"use client";

import { useEffect, useRef } from "react";

/**
 * Schickt das umgebende Filterformular ab, sobald eine Auswahlliste wechselt:
 * ein Tippen statt zwei. Textsuche wartet weiter auf Enter oder „Filtern“,
 * damit nicht jeder Buchstabe eine Navigation auslöst. Ohne JavaScript
 * bleibt der Knopf der Weg.
 */
export function SubmitOnChange() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const submit = (event: Event) => {
      if (event.target instanceof HTMLSelectElement) form.requestSubmit();
    };
    form.addEventListener("change", submit);
    return () => form.removeEventListener("change", submit);
  }, []);
  return <span ref={ref} hidden />;
}
