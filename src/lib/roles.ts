/**
 * Rollen als reine Daten, ohne jede Datenbankabhaengigkeit.
 *
 * Der Grund ist handfest: team-forms.tsx ist eine Client Component. Holt sie
 * die Beschriftungen aus users.ts, zieht sie ueber @/db den Postgres-Treiber
 * ins Browser-Bundle, und der Build bricht mit „Module not found: Can't resolve
 * 'fs'“ ab. Die ESLint-Regel gegen @/db-Importe greift dabei nicht, weil der
 * Import einen Umweg nimmt.
 *
 * Die Union steht hier wortwoertlich statt aus dem Drizzle-Enum abgeleitet.
 * users.ts prueft zur Compilezeit, dass beide nicht auseinanderlaufen.
 */
export type UserRole = "owner" | "editor";

export const ROLLEN: UserRole[] = ["owner", "editor"];

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Verantwortlich",
  editor: "Redaktion",
};

export const ROLE_HINTS: Record<UserRole, string> = {
  owner: "Darf alles, auch Vereinsdaten und Zugänge.",
  editor: "Darf Tiere, Aktuelles und Anfragen pflegen.",
};

export type TeamUser = {
  id: number;
  username: string;
  role: UserRole;
  createdAt: Date;
};
