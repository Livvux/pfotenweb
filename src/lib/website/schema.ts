import { z } from "zod";

export const fontIds = [
  "manrope",
  "bricolage",
  "inter",
  "dm-sans",
  "nunito",
  "source-sans",
  "lora",
  "source-serif",
] as const;
export const fonts = [
  "Manrope",
  "Bricolage Grotesque",
  "Inter",
  "DM Sans",
  "Nunito Sans",
  "Source Sans 3",
  "Lora",
  "Source Serif 4",
];
export const styleIds = [
  "wiesengrund",
  "seeblick",
  "pfotenfreunde",
  "lichtblick",
] as const;
const color = z.string().regex(/^#[a-fA-F0-9]{6}$/);
const id = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const safeLink = z
  .string()
  .max(500)
  .refine(
    (value) =>
      !value ||
      /^\/(?!\/)[a-zA-Z0-9/_?=&%#.-]*$/.test(value) ||
      /^#[a-zA-Z0-9_-]+$/.test(value) ||
      (() => {
        try {
          const url = new URL(value);
          return url.protocol === "https:" && !url.username && !url.password;
        } catch {
          return false;
        }
      })(),
    "Bitte einen Seitenpfad oder HTTPS-Link eingeben.",
  );
// Archive references are accepted here, but only the import remapper may turn them into live URLs.
export const imageRef = z
  .string()
  .max(300)
  .refine(
    (value) =>
      !value ||
      /^\/uploads\/(?:t[1-9]\d*\/)?[a-zA-Z0-9_-]+\.(?:jpg|png|webp)$/.test(
        value,
      ) ||
      /^images\/[a-f0-9]{64}\.(?:jpg|png|webp)$/.test(value),
    "Bitte ein Bild aus dem Vereinsspeicher wählen.",
  );
export const designSchema = z
  .object({
    style: z.enum(styleIds),
    headingFont: z.enum(fontIds),
    bodyFont: z.enum(fontIds),
    primary: color,
    accent: color,
    background: color,
    size: z.enum(["small", "medium", "large"]),
    width: z.enum(["compact", "wide"]),
    spacing: z.enum(["compact", "comfortable", "generous"]),
    radius: z.enum(["square", "soft", "round"]),
    button: z.enum(["solid", "outline"]),
  })
  .strict();
export const elementTypes = [
  "hero",
  "text",
  "image",
  "imageText",
  "gallery",
  "button",
  "facts",
  "faq",
  "animals",
  "posts",
  "donations",
] as const;
export const elementLabels: Record<(typeof elementTypes)[number], string> = {
  hero: "Titelbereich",
  text: "Text",
  image: "Bild",
  imageText: "Bild und Text",
  gallery: "Galerie",
  button: "Button",
  facts: "Kennzahlen",
  faq: "Fragen und Antworten",
  animals: "Tiere",
  posts: "Neuigkeiten",
  donations: "Spenden",
};
export const elementSchema = z
  .object({
    id,
    type: z.enum(elementTypes),
    title: z.string().max(200),
    text: z.string().max(12000),
    image: imageRef,
    alt: z.string().max(200),
    label: z.string().max(100),
    href: safeLink,
    images: z
      .array(z.object({ url: imageRef, alt: z.string().max(200) }).strict())
      .max(12),
    items: z
      .array(
        z
          .object({ title: z.string().max(200), text: z.string().max(2000) })
          .strict(),
      )
      .max(12),
    align: z.enum(["left", "center"]),
    count: z.number().int().min(1).max(12),
  })
  .strict();
export const sectionSchema = z
  .object({
    id,
    tone: z.enum(["plain", "soft", "brand"]),
    columns: z
      .array(
        z.object({ id, elements: z.array(elementSchema).max(12) }).strict(),
      )
      .min(1)
      .max(3),
  })
  .strict();
export const pageSchema = z
  .object({
    id,
    slug: z
      .string()
      .max(80)
      .regex(/^(home|verein|[a-z0-9]+(?:-[a-z0-9]+)*)$/),
    title: z.string().min(1).max(100),
    description: z.string().max(300),
    navigation: z.boolean(),
    sections: z.array(sectionSchema).min(1).max(30),
  })
  .strict();
export const websiteSchema = z
  .object({
    version: z.literal(1),
    design: designSchema,
    pages: z.array(pageSchema).min(2).max(30),
  })
  .strict()
  .superRefine((site, ctx) => {
    const slugs = site.pages.map((p) => p.slug);
    const ids = site.pages.flatMap((p) => [
      p.id,
      ...p.sections.flatMap((s) => [
        s.id,
        ...s.columns.flatMap((c) => [c.id, ...c.elements.map((e) => e.id)]),
      ]),
    ]);
    if (
      new Set(slugs).size !== slugs.length ||
      new Set(ids).size !== ids.length ||
      !slugs.includes("home") ||
      !slugs.includes("verein")
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Seiten und Elemente brauchen eindeutige Kennungen; Startseite und Vereinsseite bleiben erhalten.",
      });
    if (JSON.stringify(site).length > 500_000)
      ctx.addIssue({ code: "custom", message: "Die Website ist zu groß." });
  });
export const websiteStateSchema = z
  .object({
    draft: websiteSchema,
    published: websiteSchema.nullable(),
    history: z
      .array(
        z.object({ date: z.string().datetime(), site: websiteSchema }).strict(),
      )
      .max(10),
  })
  .strict();
export type Website = z.infer<typeof websiteSchema>;
export type WebsiteState = z.infer<typeof websiteStateSchema>;
export type WebsitePage = z.infer<typeof pageSchema>;
export type Element = z.infer<typeof elementSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type Design = z.infer<typeof designSchema>;
export type WebsiteMedia = { url: string; createdAt: string };
export function pagePath(page: Pick<WebsitePage, "slug">) {
  return page.slug === "home"
    ? "/"
    : page.slug === "verein"
      ? "/verein"
      : `/seite/${page.slug}`;
}
export function mediaRefs(site: Website): string[] {
  return site.pages
    .flatMap((p) =>
      p.sections.flatMap((s) =>
        s.columns.flatMap((c) =>
          c.elements.flatMap((e) => [e.image, ...e.images.map((i) => i.url)]),
        ),
      ),
    )
    .filter(Boolean);
}
export function stateMediaRefs(state: WebsiteState | null): string[] {
  return state
    ? [
        ...new Set(
          [
            state.draft,
            ...(state.published ? [state.published] : []),
            ...state.history.map((h) => h.site),
          ].flatMap(mediaRefs),
        ),
      ]
    : [];
}
export async function mapStateMedia(
  state: WebsiteState | null,
  map: (url: string) => Promise<string>,
): Promise<WebsiteState | null> {
  if (!state) return null;
  const copy = structuredClone(state);
  for (const site of [
    copy.draft,
    ...(copy.published ? [copy.published] : []),
    ...copy.history.map((h) => h.site),
  ])
    for (const p of site.pages)
      for (const s of p.sections)
        for (const c of s.columns)
          for (const e of c.elements) {
            if (e.image) e.image = await map(e.image);
            for (const image of e.images)
              if (image.url) image.url = await map(image.url);
          }
  return copy;
}
