/* eslint-disable jsx-a11y/alt-text -- React PDF images are document primitives, not HTML images. */
import path from "node:path";

let fontRegistered = false;
export type AnimalPdfData = {
  name: string; status: string; orgName: string; color: string;
  facts: [string, string][]; description: string; contact: string[];
  url: string; qr: string; photo?: Buffer; logo?: Buffer;
};
export async function renderAnimalPdf(animals: AnimalPdfData[], now = new Date()) {
  const { Document, Page, Text, View, Image, Link, Font, renderToBuffer } = await import("@react-pdf/renderer");
  if (!fontRegistered) {
    Font.register({ family: "Noto", src: path.join(process.cwd(), "public/fonts/noto-sans-regular.woff") });
    Font.registerHyphenationCallback(word => Array.from(word));
    fontRegistered = true;
  }
  return renderToBuffer(<Document title="Tiersteckbriefe" author={animals[0]?.orgName}>
    {animals.map((animal, index) => <Page key={index} size="A4" style={{ padding: 40, paddingBottom: 65, fontFamily: "Noto", fontSize: 10, lineHeight: 1.5, color: "#202820" }}>
      <View style={{ borderBottomWidth: 2, borderBottomColor: animal.color, paddingBottom: 12, marginBottom: 16 }}>
        {animal.logo && <Image src={{ data: animal.logo, format: "png" }} style={{ width: 64, height: 40, objectFit: "contain", marginBottom: 8 }}/>}
        <Text style={{ fontSize: 10 }}>{animal.orgName}</Text>
        <Text style={{ fontSize: 25, lineHeight: 1.4, marginTop: 8, marginBottom: 8 }}>{animal.name}</Text>
        <Text>{animal.status}</Text>
      </View>
      {animal.photo && <Image src={{ data: animal.photo, format: "png" }} style={{ width: "100%", height: 200, objectFit: "contain", marginBottom: 16 }}/>}
      {animal.facts.map(([label, value]) => <View key={label} style={{ marginBottom: 5 }}><Text style={{ color: "#596159", fontSize: 9 }}>{label}</Text><Text>{value}</Text></View>)}
      <Text style={{ marginTop: 14, marginBottom: 14 }}>{animal.description}</Text>
      <View wrap={false} style={{ borderTopWidth: 1, borderTopColor: "#ccd4cc", paddingTop: 12 }}>
        {animal.contact.map((line, i) => <Text key={i}>{line}</Text>)}
        <Image src={animal.qr} style={{ width: 90, height: 90, marginTop: 8 }}/>
        <Link src={animal.url} style={{ color: "#153f32", fontSize: 9 }}>{animal.url}</Link>
        <Text style={{ fontSize: 8, marginTop: 5 }}>Erstellt am {now.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}. Aktuelle Angaben und Vermittlungsstatus finden Sie im Online-Steckbrief.</Text>
      </View>
      <Text fixed style={{ position: "absolute", bottom: 25, left: 40, right: 40, fontSize: 8 }} render={({ pageNumber, totalPages }) => `${animal.name} · Seite ${pageNumber} / ${totalPages}`}/>
    </Page>)}
  </Document>);
}
