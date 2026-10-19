import { buildThemeVars, onColor } from "@/lib/theme";
import { fontIds, type Design } from "./schema";
export function designVars(d: Design): Record<string, string> {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(d.background.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const ink =
    rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 0.179
      ? "#18251e"
      : "#ffffff";
  return {
    "--pw-ink": ink,
    ...buildThemeVars(d.primary, d.accent),
    "--font-display": `"pw-${d.headingFont}", sans-serif`,
    "--font-body": `"pw-${d.bodyFont}", sans-serif`,
    "--pw-bg": d.background,
    "--pw-primary": d.primary,
    "--pw-accent": d.accent,
    "--pw-on-accent": onColor(d.accent),
    "--pw-width": d.width === "compact" ? "1000px" : "1200px",
    "--pw-space": { compact: "36px", comfortable: "64px", generous: "88px" }[
      d.spacing
    ],
    "--pw-radius": { square: "0px", soft: "12px", round: "30px" }[d.radius],
    "--pw-size": { small: "0.9", medium: "1", large: "1.12" }[d.size],
  };
}
export function designCss(d: Design, selector: string) {
  return `${selector}{${Object.entries(designVars(d))
    .map(([k, v]) => `${k}:${v}`)
    .join(";")};font-family:var(--font-body);background-color:var(--pw-bg)}`;
}
export function fontCss() {
  return fontIds
    .map(
      (id) =>
        `@font-face{font-family:"pw-${id}";src:url("/fonts/website/${id}.woff2") format("woff2");font-weight:400 700;font-style:normal;font-display:swap}`,
    )
    .join("\n");
}
