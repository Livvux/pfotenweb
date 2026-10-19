"use client";

import { useFormStatus } from "react-dom";

/**
 * Statusknöpfe einer Tierzeile. Der getippte Status leuchtet sofort auf,
 * während der Server noch speichert; ohne JavaScript bleibt es ein normales
 * Formular mit drei Submit-Knöpfen.
 */
export function AnimalStatusButtons({
  current,
  options,
}: {
  current: string;
  options: [string, string][];
}) {
  const { pending, data } = useFormStatus();
  const chosen = pending ? String(data?.get("status") ?? current) : current;
  return (
    <div className="admin-status-switch" data-pending={pending ? "" : undefined}>
      {options.map(([value, label]) => (
        <button
          key={value}
          type="submit"
          name="status"
          value={value}
          aria-pressed={chosen === value}
          className={`admin-button ${chosen === value ? "admin-primary" : ""}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
