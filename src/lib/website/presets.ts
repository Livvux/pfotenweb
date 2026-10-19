import {
  type Design,
  type Element,
  type Section,
  type Website,
} from "./schema";
export const presets: Record<
  Design["style"],
  { name: string; description: string; design: Design }
> = {
  wiesengrund: {
    name: "Wiesengrund",
    description: "Natürlich. Warm. Geborgen.",
    design: {
      style: "wiesengrund",
      headingFont: "bricolage",
      bodyFont: "manrope",
      primary: "#244c3b",
      accent: "#edc36a",
      background: "#faf8f2",
      size: "medium",
      width: "wide",
      spacing: "comfortable",
      radius: "round",
      button: "solid",
    },
  },
  seeblick: {
    name: "Seeblick",
    description: "Klarheit und Raum zum Ankommen.",
    design: {
      style: "seeblick",
      headingFont: "inter",
      bodyFont: "dm-sans",
      primary: "#245c70",
      accent: "#acd8df",
      background: "#ffffff",
      size: "medium",
      width: "compact",
      spacing: "generous",
      radius: "soft",
      button: "outline",
    },
  },
  pfotenfreunde: {
    name: "Pfotenfreunde",
    description: "Viel Herz. Viel Leben. Zusammen.",
    design: {
      style: "pfotenfreunde",
      headingFont: "nunito",
      bodyFont: "source-sans",
      primary: "#633b78",
      accent: "#f6b869",
      background: "#fff9ee",
      size: "large",
      width: "wide",
      spacing: "comfortable",
      radius: "round",
      button: "solid",
    },
  },
  lichtblick: {
    name: "Lichtblick",
    description: "Große Bilder. Besondere Geschichten.",
    design: {
      style: "lichtblick",
      headingFont: "lora",
      bodyFont: "source-serif",
      primary: "#393e36",
      accent: "#d5bd94",
      background: "#f4f1eb",
      size: "large",
      width: "wide",
      spacing: "generous",
      radius: "square",
      button: "outline",
    },
  },
};
export function newElement(
  type: Element["type"],
  id = crypto.randomUUID(),
): Element {
  return {
    id,
    type,
    title:
      type === "hero"
        ? "Ein Zuhause verändert alles."
        : type === "animals"
          ? "Sie suchen ein Zuhause"
          : type === "posts"
            ? "Neues aus unserem Verein"
            : type === "donations"
              ? "Gemeinsam können wir helfen."
              : "Platz für Ihre Geschichte",
    text:
      type === "hero"
        ? "Lernen Sie unsere Tiere und die Menschen kennen, die für sie da sind."
        : "Erzählen Sie hier, was Ihren Verein besonders macht.",
    image: "",
    alt: "",
    label: type === "donations" ? "Jetzt helfen" : "Mehr erfahren",
    href: type === "donations" ? "/spenden" : "/kontakt",
    images: [],
    items:
      type === "faq"
        ? [
            {
              title: "Wie kann ich helfen?",
              text: "Schreiben Sie uns. Wir freuen uns auf Sie!",
            },
          ]
        : type === "facts"
          ? [{ title: "100 %", text: "Für unsere Tiere" }]
          : [],
    align: "left",
    count: 3,
  };
}
export function newSection(
  type: Element["type"] = "text",
  prefix = crypto.randomUUID(),
): Section {
  return {
    id: `${prefix}-s`,
    tone: "plain",
    columns: [
      { id: `${prefix}-c`, elements: [newElement(type, `${prefix}-e`)] },
    ],
  };
}
type InitialSettings = {
  heroHeadline: string;
  heroSubline: string | null;
  heroImageUrl: string | null;
  aboutIntro: string | null;
  aboutWork: string | null;
  aboutSupport: string | null;
  colorPrimary: string;
  colorAccent: string;
  facts: { value: string; label: string }[] | null;
  homeAnimalCount?: number;
};
export function initialWebsite(s: InitialSettings): Website {
  const hero = newSection("hero", "home-hero");
  Object.assign(hero.columns[0].elements[0], {
    title: s.heroHeadline,
    text: s.heroSubline ?? "",
    image: s.heroImageUrl ?? "",
    label: "Tiere kennenlernen",
    href: "/tiere",
  });
  const animals = newSection("animals", "home-animals");
  animals.tone = "soft";
  animals.columns[0].elements[0].count = s.homeAnimalCount ?? 3;
  const about = newSection("text", "about-intro");
  Object.assign(about.columns[0].elements[0], {
    title: "Menschen, die bleiben, bis ein Tier angekommen ist.",
    text: s.aboutIntro ?? "",
  });
  const work = newSection("text", "about-work");
  Object.assign(work.columns[0].elements[0], {
    title: "Wie wir arbeiten",
    text: s.aboutWork ?? "",
  });
  const support = newElement("text", "about-support");
  Object.assign(support, {
    title: "Was uns trägt",
    text: s.aboutSupport ?? "",
  });
  work.columns.push({ id: "about-support-c", elements: [support] });
  const facts = newSection("facts", "about-facts");
  facts.columns[0].elements[0].items = (s.facts ?? []).map((f) => ({
    title: f.value,
    text: f.label,
  }));
  return {
    version: 1,
    design: {
      ...presets.wiesengrund.design,
      primary: s.colorPrimary,
      accent: s.colorAccent,
    },
    pages: [
      {
        id: "home",
        slug: "home",
        title: "Startseite",
        description: s.heroSubline?.slice(0, 300) ?? "",
        navigation: false,
        sections: [
          hero,
          animals,
          newSection("posts", "home-posts"),
          { ...newSection("donations", "home-donations"), tone: "brand" },
        ],
      },
      {
        id: "verein",
        slug: "verein",
        title: "Verein",
        description: s.aboutIntro?.slice(0, 300) ?? "",
        navigation: true,
        sections: [about, facts, work],
      },
    ],
  };
}
