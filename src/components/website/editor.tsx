"use client";
import { useActionState, useState, useTransition } from "react";
import { saveWebsiteAction, uploadWebsiteImage } from "@/lib/actions/website";
import { elementLabels, elementTypes, fontIds, type Element, type Section, type Website, type WebsiteState } from "@/lib/website/schema";
import { newElement, newSection, presets } from "@/lib/website/presets";
import type { WebsiteContent } from "@/lib/website/content";
import { PageRenderer } from "./renderer";
import "./website.css";
import "./stilwelten.css";

export function WebsiteEditor({ initial, revision, images, content }: { initial: WebsiteState; revision: number; images: string[]; content: WebsiteContent }) {
  const [site, setSite] = useState<Website>(initial.draft);
  const [state, action, pending] = useActionState(saveWebsiteAction, null);
  const [pageId, setPageId] = useState(site.pages[0].id);
  const [media, setMedia] = useState(images);
  const [uploading, startUpload] = useTransition();
  const [error, setError] = useState("");
  const page = site.pages.find(p => p.id === pageId) ?? site.pages[0];
  function changeElement(id: string, field: keyof Element, value: Element[keyof Element]) {
    setSite(current => ({ ...current, pages: current.pages.map(p => ({ ...p, sections: p.sections.map(s => ({ ...s, columns: s.columns.map(c => ({ ...c, elements: c.elements.map(e => e.id === id ? { ...e, [field]: value } : e) })) })) })) }));
  }
  function changeSection(pageId: string, sectionId: string, update: (section: Section) => Section) {
    setSite(current => ({ ...current, pages: current.pages.map(p => p.id !== pageId ? p : { ...p, sections: p.sections.map(section => section.id === sectionId ? update(section) : section) }) }));
  }
  function upload(file: File | undefined) {
    if (!file) return;
    startUpload(async () => {
      const data = new FormData(); data.set("image", file);
      const result = await uploadWebsiteImage(data);
      if ("url" in result && result.url) { setMedia(current => [...current, result.url]); setError(""); }
      else setError(result.error ?? "Upload fehlgeschlagen.");
    });
  }
  return <div data-website-style={site.design.style} className="grid gap-8 xl:grid-cols-[minmax(320px,440px)_1fr]">
    <noscript><style>{"[data-editor-page][hidden]{display:block}"}</style></noscript>
    <form action={action} className="space-y-5" aria-label="Website gestalten">
      <input type="hidden" name="site" value={JSON.stringify(site)}/>
      <input type="hidden" name="revision" value={state?.ok ? state.revision : revision}/>
      <div className="sticky top-0 z-20 flex flex-wrap gap-3 rounded-2xl bg-white p-3 shadow-sm">
        <button name="intent" value="draft" disabled={pending || uploading || !!(state && !state.ok && state.conflict)} className="min-h-11 rounded-full border px-4">Entwurf speichern</button>
        <button name="intent" value="publish" disabled={pending || uploading || !!(state && !state.ok && state.conflict)} className="min-h-11 rounded-full bg-brand-800 px-4 text-white">Veröffentlichen</button>
      </div>
      <p className="text-sm">Änderungen bleiben privat, bis sie veröffentlicht werden. Die Vorschau zeigt die Eingaben dieses Tabs.</p>
      {state?.ok && <p role="status">Website gespeichert.</p>}
      {state && !state.ok && <p role="alert">{state.error} <a href="/admin/website" className="underline">Aktuellen Stand laden</a></p>}
      {error && <p role="alert">{error}</p>}
      <details className="rounded-2xl border p-4"><summary className="min-h-11 cursor-pointer font-semibold">Design</summary>
        <label className="grid gap-1">Stilwelt<select name="design:style" value={site.design.style} onChange={e => { const preset = Object.values(presets).find(p => p.design.style === e.target.value); if (preset) setSite({ ...site, design: { ...preset.design, primary: site.design.primary, accent: site.design.accent } }); }} className="min-h-11 rounded border p-2">{Object.values(presets).map(p => <option key={p.design.style} value={p.design.style}>{p.name}</option>)}</select></label>
        {(["primary", "accent", "background"] as const).map(key => <label key={key} className="mt-3 grid gap-1">{{ primary: "Hauptfarbe", accent: "Akzentfarbe", background: "Hintergrund" }[key]}<input name={`design:${key}`} type="color" value={site.design[key]} onChange={e => setSite({ ...site, design: { ...site.design, [key]: e.target.value } })} className="min-h-11 w-full"/></label>)}
        {(["headingFont", "bodyFont"] as const).map(key => <label key={key} className="mt-3 grid gap-1">{key === "headingFont" ? "Überschriftenschrift" : "Textschrift"}<select name={`design:${key}`} value={site.design[key]} onChange={e => { const font = fontIds.find(f => f === e.target.value); if (font) setSite({ ...site, design: { ...site.design, [key]: font } }); }} className="min-h-11 rounded border p-2">{fontIds.map(font => <option key={font}>{font}</option>)}</select></label>)}
        {([ ["size", "Schriftgröße", ["small", "medium", "large"]], ["width", "Seitenbreite", ["compact", "wide"]], ["spacing", "Abstände", ["compact", "comfortable", "generous"]], ["radius", "Ecken", ["square", "soft", "round"]], ["button", "Buttons", ["solid", "outline"]] ] as const).map(([key, label, options]) => <label key={key} className="mt-3 grid gap-1">{label}<select name={`design:${key}`} value={site.design[key]} onChange={e => setSite({ ...site, design: { ...site.design, [key]: e.target.value } })} className="min-h-11 rounded border p-2">{options.map(option => <option key={option}>{option}</option>)}</select></label>)}
      </details>
      <section className="rounded-2xl border p-4"><h2 className="font-semibold">Seiten</h2>
        <div className="mt-3 flex flex-wrap gap-2">{site.pages.map(p => <button key={p.id} type="button" aria-pressed={p.id === page.id} onClick={() => setPageId(p.id)} className="min-h-11 rounded-full border px-3">{p.title}</button>)}</div>
        <button type="button" disabled={site.pages.length >= 30} className="mt-3 min-h-11 rounded border px-3" onClick={() => { const id = crypto.randomUUID(); setSite({ ...site, pages: [...site.pages, { id, slug: `seite-${site.pages.length}`, title: "Neue Seite", description: "", navigation: true, sections: [newSection("text")] }] }); setPageId(id); }}>Seite hinzufügen</button>
      </section>
      {site.pages.map(p => <section key={p.id} data-editor-page hidden={p.id !== page.id} className="space-y-4 rounded-2xl border p-4">
        <label className="grid gap-1">Seitentitel<input name={`page:${p.id}:title`} value={p.title} onChange={e => setSite({ ...site, pages: site.pages.map(row => row.id === p.id ? { ...row, title: e.target.value } : row) })} className="min-h-11 rounded border p-2"/></label>
        <label className="grid gap-1">Beschreibung für Suchmaschinen<textarea name={`page:${p.id}:description`} value={p.description} onChange={e => setSite({ ...site, pages: site.pages.map(row => row.id === p.id ? { ...row, description: e.target.value } : row) })} className="rounded border p-2"/></label>
        {!["home", "verein"].includes(p.slug) && <label className="grid gap-1">Seitenadresse<input name={`page:${p.id}:slug`} value={p.slug} onChange={e => setSite({ ...site, pages: site.pages.map(row => row.id === p.id ? { ...row, slug: e.target.value } : row) })} className="min-h-11 rounded border p-2"/></label>}
        <label className="flex gap-2"><input name={`page:${p.id}:navigation`} type="checkbox" checked={p.navigation} onChange={e => setSite({ ...site, pages: site.pages.map(row => row.id === p.id ? { ...row, navigation: e.target.checked } : row) })}/>In der Website-Navigation anzeigen</label>
        {!["home", "verein"].includes(p.slug) && <button type="button" className="min-h-11 underline" onClick={() => { setSite({ ...site, pages: site.pages.filter(row => row.id !== p.id) }); setPageId(site.pages[0].id); }}>Seite entfernen</button>}
        {p.sections.map((section, sectionIndex) => <fieldset key={section.id} className="space-y-3 rounded-xl border p-3"><legend>Abschnitt {sectionIndex + 1}</legend>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={sectionIndex === 0} className="min-h-11 rounded border px-3" onClick={() => setSite({ ...site, pages: site.pages.map(row => { if (row.id !== p.id) return row; const sections = [...row.sections]; [sections[sectionIndex - 1], sections[sectionIndex]] = [sections[sectionIndex], sections[sectionIndex - 1]]; return { ...row, sections }; }) })}>Nach oben</button>
            <button type="button" disabled={sectionIndex === p.sections.length - 1} className="min-h-11 rounded border px-3" onClick={() => setSite({ ...site, pages: site.pages.map(row => { if (row.id !== p.id) return row; const sections = [...row.sections]; [sections[sectionIndex], sections[sectionIndex + 1]] = [sections[sectionIndex + 1], sections[sectionIndex]]; return { ...row, sections }; }) })}>Nach unten</button>
            <button type="button" disabled={p.sections.length <= 1} className="min-h-11 rounded border px-3" onClick={() => setSite({ ...site, pages: site.pages.map(row => row.id === p.id ? { ...row, sections: row.sections.filter(s => s.id !== section.id) } : row) })}>Abschnitt entfernen</button>
          </div>
          <label className="grid gap-1">Abschnittshintergrund<select name={`section:${section.id}:tone`} value={section.tone} onChange={e => { const tone = (["plain", "soft", "brand"] as const).find(value => value === e.target.value); if (tone) changeSection(p.id, section.id, current => ({ ...current, tone })); }} className="min-h-11 rounded border p-2"><option value="plain">Neutral</option><option value="soft">Dezent</option><option value="brand">Hauptfarbe</option></select></label>
          <button type="button" className="admin-button" disabled={section.columns.length >= 3} onClick={() => changeSection(p.id, section.id, current => ({ ...current, columns: [...current.columns, { id: crypto.randomUUID(), elements: [] }] }))}>Spalte hinzufügen</button>
          {section.columns.map((column, columnIndex) => <div key={column.id} className="space-y-3 border-t pt-3"><h3 className="font-semibold">Spalte {columnIndex + 1}</h3><button type="button" className="admin-button" disabled={section.columns.length <= 1 || column.elements.length > 0} onClick={() => changeSection(p.id, section.id, current => ({ ...current, columns: current.columns.filter(c => c.id !== column.id) }))}>Leere Spalte entfernen</button>
          {column.elements.map((element, elementIndex) => <div key={element.id} className="space-y-3">
            <h4 className="font-semibold">{elementLabels[element.type]}</h4>
            <div className="flex gap-2 flex-wrap"><button type="button" className="admin-button" disabled={elementIndex === 0} onClick={() => changeSection(p.id, section.id, current => ({ ...current, columns: current.columns.map(c => { if (c.id !== column.id) return c; const elements = [...c.elements]; [elements[elementIndex - 1], elements[elementIndex]] = [elements[elementIndex], elements[elementIndex - 1]]; return { ...c, elements }; }) }))}>Baustein nach oben</button><button type="button" className="admin-button" disabled={elementIndex === column.elements.length - 1} onClick={() => changeSection(p.id, section.id, current => ({ ...current, columns: current.columns.map(c => { if (c.id !== column.id) return c; const elements = [...c.elements]; [elements[elementIndex], elements[elementIndex + 1]] = [elements[elementIndex + 1], elements[elementIndex]]; return { ...c, elements }; }) }))}>Baustein nach unten</button><button type="button" className="admin-button" onClick={() => changeSection(p.id, section.id, current => ({ ...current, columns: current.columns.map(c => c.id === column.id ? { ...c, elements: c.elements.filter(e => e.id !== element.id) } : c) }))}>Baustein entfernen</button></div>
            <label className="grid gap-1">Ausrichtung<select name={`element:${element.id}:align`} value={element.align} onChange={e => changeElement(element.id, "align", e.target.value === "center" ? "center" : "left")} className="min-h-11 rounded border p-2"><option value="left">Links</option><option value="center">Zentriert</option></select></label>
            {(["title", "text", "label", "href", "alt"] as const).map(field => <label key={field} className="grid gap-1">{{title:"Überschrift",text:"Text",label:"Buttontext",href:"Linkziel",alt:"Bildbeschreibung"}[field]}{field === "text" ? <textarea name={`element:${element.id}:${field}`} value={element[field]} onChange={e => changeElement(element.id, field, e.target.value)} className="rounded border p-2"/> : <input name={`element:${element.id}:${field}`} value={element[field]} onChange={e => changeElement(element.id, field, e.target.value)} className="min-h-11 rounded border p-2"/>}</label>)}
            <label className="grid gap-1">Bild auswählen<select name={`element:${element.id}:image`} value={element.image} onChange={e => changeElement(element.id, "image", e.target.value)} className="min-h-11 rounded border p-2"><option value="">Kein Bild</option>{[...new Set([...media, element.image])].filter(Boolean).map((url, i) => <option key={url} value={url}>Bild {i + 1}</option>)}</select></label>
            {(["animals", "posts"].includes(element.type)) && <label className="grid gap-1">Anzahl<input type="number" min={1} max={12} name={`element:${element.id}:count`} value={element.count} onChange={e => changeElement(element.id, "count", Number(e.target.value))} className="min-h-11 rounded border p-2"/></label>}
            {element.items.map((item, index) => <div key={index} className="grid gap-2">{(["title", "text"] as const).map(field => <label key={field}>{field === "title" ? "Eintrag" : "Erläuterung"}<input name={`item:${element.id}:${index}:${field}`} value={item[field]} onChange={e => changeElement(element.id, "items", element.items.map((row, i) => i === index ? { ...row, [field]: e.target.value } : row))} className="min-h-11 w-full rounded border p-2"/></label>)}<button type="button" className="admin-button" onClick={() => changeElement(element.id, "items", element.items.filter((_, i) => i !== index))}>Eintrag entfernen</button></div>)}
            {["facts", "faq"].includes(element.type) && <button type="button" className="admin-button" disabled={element.items.length >= 12} onClick={() => changeElement(element.id, "items", [...element.items, { title: "", text: "" }])}>Eintrag hinzufügen</button>}
            {element.type === "gallery" && <div>{element.images.map((image, index) => <div key={index}><label>Galeriebild<select name={`gallery:${element.id}:${index}:url`} value={image.url} onChange={e => changeElement(element.id, "images", element.images.map((row, i) => i === index ? { ...row, url: e.target.value } : row))} className="min-h-11 w-full rounded border p-2">{[...new Set([...media, image.url])].filter(Boolean).map((url, i) => <option key={url} value={url}>Bild {i + 1}</option>)}</select></label><label>Bildbeschreibung<input name={`gallery:${element.id}:${index}:alt`} value={image.alt} onChange={e => changeElement(element.id, "images", element.images.map((row, i) => i === index ? { ...row, alt: e.target.value } : row))} className="min-h-11 w-full rounded border p-2"/></label><button type="button" className="min-h-11 underline" onClick={() => changeElement(element.id, "images", element.images.filter((_, i) => i !== index))}>Bild entfernen</button></div>)}<button type="button" disabled={element.images.length >= 12 || !media.length} className="min-h-11 underline" onClick={() => changeElement(element.id, "images", [...element.images, { url: media[0], alt: "" }])}>Galeriebild hinzufügen</button></div>}
          </div>)}
          <label className="grid gap-1">Baustein in dieser Spalte hinzufügen<select disabled={column.elements.length >= 12} value="" className="min-h-11 rounded border p-2" onChange={e => { const type = elementTypes.find(t => t === e.target.value); if (type) changeSection(p.id, section.id, current => ({ ...current, columns: current.columns.map(c => c.id === column.id ? { ...c, elements: [...c.elements, newElement(type)] } : c) })); }}><option value="">Baustein wählen</option>{elementTypes.map(type => <option key={type} value={type}>{elementLabels[type]}</option>)}</select></label>
          </div>)}
        </fieldset>)}
        <label className="grid gap-1">Baustein hinzufügen<select defaultValue="" className="min-h-11 rounded border p-2" onChange={e => { const type = elementTypes.find(t => t === e.target.value); if (type && p.sections.length < 30) { setSite({ ...site, pages: site.pages.map(row => row.id === p.id ? { ...row, sections: [...row.sections, { ...newSection(type), columns: [{ id: crypto.randomUUID(), elements: [newElement(type)] }] }] } : row) }); e.target.value = ""; } }}><option value="">Baustein wählen</option>{elementTypes.map(type => <option key={type} value={type}>{elementLabels[type]}</option>)}</select></label>
      </section>)}
      <label className="grid gap-1 rounded-2xl border p-4">Bild in den privaten Entwurf laden<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={e => upload(e.target.files?.[0])}/></label>
      {initial.history.length > 0 && <details className="rounded-2xl border p-4"><summary className="min-h-11 cursor-pointer">Verlauf</summary>{initial.history.map((entry, i) => <button key={i} type="button" className="block min-h-11 underline" onClick={() => setSite(entry.site)}>Entwurf vom {new Date(entry.date).toLocaleString("de-DE")} wiederherstellen</button>)}</details>}
    </form>
    <section aria-label="Website-Vorschau" className="min-w-0 overflow-hidden rounded-2xl border"><p className="border-b bg-white p-3 text-sm">Vorschau · Links öffnen die veröffentlichte Website</p><PageRenderer site={site} page={page} content={content}/></section>
  </div>;
}
