import { websiteStateSchema, type WebsiteState } from "./schema";
export class WebsiteColorConflictError extends Error {
  constructor() {
    super("Diese Farbe wurde im Website-Entwurf bereits verändert. Bitte den Entwurf zuerst prüfen und dort bearbeiten oder veröffentlichen.");
  }
}
/** Existing logo/branding forms share the published colors; history stays immutable. */
export function syncWebsiteColors(
  state: WebsiteState | null,
  values: { colorPrimary?: string; colorAccent?: string },
  current?: { colorPrimary: string; colorAccent: string },
): WebsiteState | null {
  if (!state || (!values.colorPrimary && !values.colorAccent)) return state;
  const copy = structuredClone(state);
  for (const [field, key] of [["colorPrimary", "primary"], ["colorAccent", "accent"]] as const) {
    const baseline = current?.[field] ?? copy.published?.design[key];
    const value = values[field];
    // Vollständige Bestandsformulare senden auch unveränderte Farben mit.
    if (!value || value === baseline) continue;
    if (baseline && copy.draft.design[key] !== baseline && copy.draft.design[key] !== value)
      throw new WebsiteColorConflictError();
    copy.draft.design[key] = value;
    if (copy.published) copy.published.design[key] = value;
  }
  return copy;
}

const textBindings = {
  heroHeadline: ["home-hero-e", "title"],
  heroSubline: ["home-hero-e", "text"],
  aboutIntro: ["about-intro-e", "text"],
  aboutWork: ["about-work-e", "text"],
  aboutSupport: ["about-support", "text"],
} as const;
type LegacyTextSettings = { website: WebsiteState | null; [key: string]: unknown };
function binding(field: string) {
  return Object.hasOwn(textBindings, field)
    ? textBindings[field as keyof typeof textBindings] : null;
}
function boundElement(site: WebsiteState["draft"], id: string) {
  return site.pages.flatMap(p => p.sections.flatMap(s => s.columns.flatMap(c => c.elements)))
    .find(e => e.id === id);
}
/** Imports compare the effective website text, not an obsolete legacy copy. */
export function websiteText(settings: LegacyTextSettings | undefined, field: string): string | null {
  const target = binding(field);
  if (settings?.website && target) {
    const element = boundElement(settings.website.published ?? settings.website.draft, target[0]);
    return element?.[target[1]] ?? null;
  }
  const value = settings?.[field];
  return typeof value === "string" ? value : null;
}
/** The import's explicit text confirmation may not overwrite a divergent editor draft. */
export function importWebsiteText(state: WebsiteState | null, field: string, previous: string | null, text: string): WebsiteState | null {
  const target = binding(field);
  if (!state || !target) return state;
  const copy = structuredClone(state);
  for (const site of [copy.draft, ...(copy.published ? [copy.published] : [])]) {
    const element = boundElement(site, target[0]);
    if (!element || element[target[1]] !== previous)
      throw new Error("Dieser Text wurde im Website-Editor verändert oder entfernt. Bitte den Text dort bearbeiten oder den Entwurf zuerst veröffentlichen und den Import erneut vergleichen.");
    element[target[1]] = text;
  }
  if (!websiteStateSchema.safeParse(copy).success)
    throw new Error("Der Text ist für diesen Website-Baustein zu lang. Bitte vor der Übernahme kürzen.");
  return copy;
}
