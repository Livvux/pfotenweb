/**
 * Erzeugt aus zwei Vereinsfarben die vollstaendigen Farbrampen.
 *
 * Hintergrund: Tailwind v4 schreibt die Werte aus dem @theme-Block als
 * CSS-Variablen nach :root, und `bg-brand-800` kompiliert zu
 * `background-color: var(--color-brand-800)`. Ueberschreibt man die Variable
 * zur Laufzeit, faerbt sich jede bestehende Klasse um, ohne dass ein einziges
 * className angefasst werden muss.
 *
 * Gerechnet wird in OKLCH statt HSL, weil die Helligkeitsstufen dort auch
 * tatsaechlich gleichmaessig WAHRGENOMMEN werden. Bei HSL kippt jede zweite
 * Rampe ins Fahle oder Grelle.
 */

/** Nur Buntheit und Farbton der Ausgangsfarbe, die Helligkeit gibt die Rampe vor. */
type Hue = { c: number; h: number };

/** [Stufe, Helligkeit] als Paare, damit sich die Listen nicht verschieben koennen. */
const BRAND_RAMP: [number, number][] = [
  [50, 0.97],
  [100, 0.93],
  [200, 0.86],
  [300, 0.76],
  [400, 0.66],
  [500, 0.57],
  [600, 0.48],
  [700, 0.41],
  [800, 0.34],
  [900, 0.28],
  [950, 0.19],
];

const ACCENT_RAMP: [number, number][] = [
  [100, 0.95],
  [200, 0.89],
  [300, 0.82],
  [400, 0.75],
  [500, 0.68],
  [600, 0.58],
  [700, 0.47],
];

function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function hexToHue(hex: string): Hue {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  // Kein Fallback-Raten: eine unbrauchbare Farbe wird zu neutralem Gruen.
  const int = m ? parseInt(m[1], 16) : 0x1e4334;
  const r = srgbToLinear(((int >> 16) & 255) / 255);
  const g = srgbToLinear(((int >> 8) & 255) / 255);
  const b = srgbToLinear((int & 255) / 255);

  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const c = Math.sqrt(a * a + bb * bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { c, h };
}

/**
 * Chroma an den Rampenenden daempfen. Ohne das wirken die hellsten Stufen
 * neonhaft und die dunkelsten matschig, weil sie die Saettigung der
 * Ausgangsfarbe behalten wuerden.
 */
function chromaFor(base: number, l: number): number {
  const distance = Math.abs(l - 0.57) / 0.45;
  const scaled = base * (1 - 0.55 * distance * distance);
  // Untergrenze fuer nahezu graue Vereinsfarben, sonst kippt die Rampe ins
  // voellig Farblose. Eine Obergrenze braucht es nicht: der Faktor ist immer
  // kleiner als eins, und sRGB kommt nie ueber eine Buntheit von rund 0,32.
  return Math.max(0.004, scaled);
}

function ramp(
  hex: string,
  steps: [number, number][],
  prefix: string,
): Record<string, string> {
  const base = hexToHue(hex);
  const out: Record<string, string> = {};
  for (const [step, l] of steps) {
    const c = chromaFor(base.c, l);
    out[`--color-${prefix}-${step}`] =
      `oklch(${l.toFixed(3)} ${c.toFixed(4)} ${base.h.toFixed(2)})`;
  }
  return out;
}

export function buildThemeVars(
  primaryHex: string,
  accentHex: string,
): Record<string, string> {
  return {
    ...ramp(primaryHex, BRAND_RAMP, "brand"),
    ...ramp(accentHex, ACCENT_RAMP, "accent"),
  };
}

/**
 * Baut den <style>-Inhalt. Nur Werte, die wie eine oklch()-Angabe aussehen,
 * werden durchgelassen: alles andere waere ein CSS-Injection-Vektor
 * (`}</style><script>`).
 */
const SAFE_VALUE = /^oklch\([\d.\s]+\)$/;

export function themeCss(vars: Record<string, string>): string {
  const body = Object.entries(vars)
    .filter(([name, value]) => /^--color-[a-z]+-\d+$/.test(name) && SAFE_VALUE.test(value))
    .map(([name, value]) => `${name}:${value}`)
    .join(";");
  return `:root{${body}}`;
}
