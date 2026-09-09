import { PawLogo } from "./paw-logo";

/**
 * Logo des Vereins mit Rueckfall auf die Pfote.
 *
 * Eigene Komponente, weil Header und Footer sonst dieselbe Fallback-Logik samt
 * eslint-Ausnahme doppelt tragen. Bewusst kein next/image: die Datei kommt aus
 * einem Vereins-Upload mit unbekannten Massen, und die Optimierung eines
 * 32-Pixel-Logos spart nichts.
 */
export function BrandMark({
  logoUrl,
  className = "h-8 w-8",
  fallbackClassName,
}: {
  logoUrl: string | null;
  className?: string;
  fallbackClassName?: string;
}) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="" className={`${className} object-contain`} />;
  }
  return <PawLogo className={`${className} ${fallbackClassName ?? ""}`.trim()} />;
}
