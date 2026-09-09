/**
 * Verkleinert ein Foto im Browser, bevor es abgeschickt wird.
 *
 * Warum ueberhaupt: Next begrenzt den Body einer Server Action auf 1 MB, und
 * ein Handyfoto hat 3 bis 8 MB. Wir heben die Grenze in next.config.ts an, aber
 * acht Originalfotos waeren trotzdem 40 MB durch das Mobilfunknetz.
 *
 * Der eigentliche Gewinn ist ein anderer: iPhones liefern HEIC, und der Server
 * nimmt nur JPEG, PNG und WebP. Safari dekodiert HEIC nativ, der Umweg ueber
 * das Canvas macht daraus WebP. Damit kann ein Verein einfach das Foto nehmen,
 * das die Kamera gerade gemacht hat.
 *
 * Bewusst <img> mit decode() und nicht createImageBitmap: Handyfotos tragen
 * ihre Ausrichtung in EXIF. Bei <img> gilt `image-orientation: from-image` seit
 * Jahren als Standard, gezeichnet wird also aufrecht. createImageBitmap
 * braeuchte { imageOrientation: "from-image" }, was Safari nur teilweise kennt.
 * Das Ergebnis waeren hochkant fotografierte Hunde, die quer im Katalog liegen.
 */
export async function shrinkImage(
  file: File,
  maxEdge = 1600,
  quality = 0.82,
): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();

    const groesste = Math.max(img.naturalWidth, img.naturalHeight);
    // Kleine Bilder nicht anfassen: neu kodieren wuerde sie nur verschlechtern.
    if (groesste <= maxEdge && file.type === "image/webp") return file;

    const faktor = groesste > maxEdge ? maxEdge / groesste : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * faktor);
    canvas.height = Math.round(img.naturalHeight * faktor);

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    if (!blob) return file;

    const name = file.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${name}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
