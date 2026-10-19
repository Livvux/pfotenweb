import type { CSSProperties } from "react";
import WebsiteImage from "next/image";
import WebsiteLink from "next/link";
import { designVars } from "@/lib/website/design";
import type { Element, Website, WebsitePage } from "@/lib/website/schema";
import type { WebsiteContent } from "@/lib/website/content";
import { an, type Anrede } from "@/lib/anrede";

function Picture({
  src,
  alt,
  eager = false,
}: {
  src: string;
  alt: string;
  eager?: boolean;
}) {
  return src ? (
    <WebsiteImage
      src={src}
      alt={alt}
      width={1200}
      height={900}
      unoptimized
      loading={eager ? "eager" : "lazy"}
      className="pw-picture"
    />
  ) : null;
}
export function ElementView({
  element: e,
  content,
  heading = false,
  edit,
  anrede = "sie",
}: {
  anrede?: Anrede;
  edit?: (field: "title" | "text", value: string) => void;
  element: Element;
  content: WebsiteContent;
  heading?: boolean;
}) {
  const Heading = heading ? "h1" : "h2";
  const title = e.title && (
    <Heading
      data-edit-field="title"
      contentEditable={!!edit}
      suppressContentEditableWarning
      onBlur={
        edit
          ? (event) => edit("title", event.currentTarget.textContent ?? "")
          : undefined
      }
    >
      {e.title}
    </Heading>
  );
  const text = e.text && (
    <p
      data-edit-field="text"
      className="pw-copy"
      contentEditable={!!edit}
      suppressContentEditableWarning
      onBlur={
        edit
          ? (event) => edit("text", event.currentTarget.textContent ?? "")
          : undefined
      }
    >
      {e.text}
    </p>
  );
  const button = e.href && e.label && (
    <WebsiteLink className="pw-button" href={e.href}>
      {e.label}
      <span aria-hidden="true"> ↗</span>
    </WebsiteLink>
  );
  if (e.type === "hero" || e.type === "imageText")
    return (
      <div className={`pw-feature pw-${e.type}`}>
        <div>
          {title}
          {text}
          {button}
        </div>
        <Picture src={e.image} alt={e.alt} eager={heading} />
      </div>
    );
  if (e.type === "image")
    return (
      <figure>
        <Picture src={e.image} alt={e.alt} />
        {e.text && <figcaption>{e.text}</figcaption>}
      </figure>
    );
  if (e.type === "gallery")
    return (
      <div>
        {title}
        <div className="pw-cards">
          {e.images.map((i, index) => (
            <Picture key={index} src={i.url} alt={i.alt} />
          ))}
        </div>
      </div>
    );
  if (e.type === "button") return button;
  if (e.type === "facts")
    return (
      <dl className="pw-facts">
        {e.items.map((i, n) => (
          <div key={n}>
            <dt>{i.title}</dt>
            <dd>{i.text}</dd>
          </div>
        ))}
      </dl>
    );
  if (e.type === "faq")
    return (
      <div>
        {title}
        {e.items.map((i, n) => (
          <details className="pw-faq" key={n}>
            <summary>{i.title}</summary>
            <p className="pw-copy">{i.text}</p>
          </details>
        ))}
      </div>
    );
  if (e.type === "animals" || e.type === "posts") {
    const items = content[e.type].slice(0, e.count);
    return (
      <div>
        {title}
        {items.length ? (
          <div className="pw-cards">
            {items.map((i) => (
              <WebsiteLink href={i.href} key={i.href} className="pw-card">
                <Picture src={i.image} alt={i.title} />
                <div>
                  <h3>{i.title}</h3>
                  <p>{i.text}</p>
                </div>
              </WebsiteLink>
            ))}
          </div>
        ) : (
          <p className="pw-copy">
            {an(
              anrede,
              <>Hier erscheinen Ihre veröffentlichten{" "}
              {e.type === "animals" ? "vermittelbaren Tiere" : "Neuigkeiten"}.</>,
              <>Hier erscheinen deine veröffentlichten{" "}
              {e.type === "animals" ? "vermittelbaren Tiere" : "Neuigkeiten"}.</>,
            )}
          </p>
        )}
      </div>
    );
  }
  if (e.type === "donations")
    return (
      <div className="pw-donation">
        {title}
        {text}
        <WebsiteLink
          className="pw-button"
          href={content.hasDonations ? "/spenden" : "/kontakt"}
        >
          {content.hasDonations
            ? e.label || "Jetzt helfen"
            : "Kontakt aufnehmen"}{" "}
          ↗
        </WebsiteLink>
      </div>
    );
  return (
    <div>
      {title}
      {text}
    </div>
  );
}
export function PageRenderer({
  site,
  page,
  content,
  selected,
  onTextChange,
  anrede,
}: {
  anrede?: Anrede;
  selected?: string;
  onTextChange?: (id: string, field: "title" | "text", value: string) => void;
  site: Website;
  page: WebsitePage;
  content: WebsiteContent;
}) {
  const firstId = page.sections
    .flatMap((s) => s.columns.flatMap((c) => c.elements))
    .find(
      (e) => !!e.title && ["text", "hero", "imageText"].includes(e.type),
    )?.id;
  return (
    <div
      className="pw-site"
      data-style={site.design.style}
      data-button={site.design.button}
      style={designVars(site.design) as CSSProperties}
    >
      {!firstId && <h1 className="sr-only">{page.title}</h1>}
      {page.sections.map((section) => (
        <section
          className="pw-section"
          data-tone={section.tone}
          data-columns={section.columns.length}
          key={section.id}
        >
          <div
            className="pw-section-inner"
            style={{ "--pw-columns": section.columns.length } as CSSProperties}
          >
            {section.columns.map((column) => (
              <div className="pw-column" key={column.id}>
                {column.elements.map((e) => {
                  const heading = e.id === firstId;
                  return (
                    <div
                      key={e.id}
                      data-element-id={e.id}
                      data-align={e.align}
                      style={{ textAlign: e.align }}
                    >
                      <ElementView
                        element={e}
                        content={content}
                        heading={heading}
                        anrede={anrede}
                        edit={
                          selected === e.id && onTextChange
                            ? (field, value) => onTextChange(e.id, field, value)
                            : undefined
                        }
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
