import { getCurrentTenant, getSettings } from "@/lib/tenant";
import { buildThemeVars, themeCss } from "@/lib/theme";

/**
 * Legt die Farbrampen des aktuellen Vereins als CSS-Variablen auf :root.
 *
 * Tailwind v4 kompiliert `bg-brand-800` zu `var(--color-brand-800)`, also
 * faerbt das Ueberschreiben der Variablen jede bestehende Klasse um, ohne dass
 * ein einziges className angefasst werden muss.
 *
 * :root statt Wrapper-Div, weil globals.css `body { background-color }` setzt
 * und der Body ausserhalb jedes Layout-Wrappers liegt. Serverseitig gerendert,
 * also blitzen die Standardfarben nicht kurz auf.
 *
 * Eigene Komponente und nicht im Wurzel-Layout: der Adminbereich benutzt
 * dieselben brand-Klassen wie die oeffentliche Seite und braucht die Variablen
 * genauso, aber /_not-found wird beim Build vorgerendert und darf dabei weder
 * einen Host noch eine Datenbank voraussetzen.
 *
 * Die beiden Datenbankabfragen sind ueber React cache() dedupliziert, kosten
 * hier also nichts zusaetzlich.
 */
export async function TenantTheme() {
  const tenant = await getCurrentTenant();
  if (!tenant) return null;
  const settings = await getSettings(tenant.id);
  if (!settings) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: themeCss(
          buildThemeVars(settings.colorPrimary, settings.colorAccent),
        ),
      }}
    />
  );
}
