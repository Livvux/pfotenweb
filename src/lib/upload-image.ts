import sharp from "sharp";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const MAX_EDGE = 16_384;
const formats = { ".jpg": "jpeg", ".png": "png", ".webp": "webp" } as const;

/** Decode untrusted uploads before storage; the declared MIME type is not proof. */
export async function normalizeUploadImage(input: Buffer, extension: string): Promise<Buffer> {
  if (!Object.hasOwn(formats, extension)) throw new Error("Bildformat ungültig.");
  if (!input.length || input.length > MAX_BYTES) {
    throw new Error("Das Bild muss zwischen 1 Byte und 5 MB groß sein.");
  }
  const format = formats[extension as keyof typeof formats];
  const signatureMatches = format === "jpeg"
    ? input.length >= 3 && input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff
    : format === "png"
      ? input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : input.length >= 12 && input.toString("ascii", 0, 4) === "RIFF" && input.toString("ascii", 8, 12) === "WEBP";
  if (!signatureMatches) throw new Error("Dateiinhalt und angegebenes Bildformat stimmen nicht überein.");

  try {
    const image = sharp(input, { failOn: "warning", limitInputPixels: MAX_PIXELS, sequentialRead: true });
    const metadata = await image.metadata();
    if (metadata.format !== format || !metadata.width || !metadata.height ||
        metadata.width > MAX_EDGE || metadata.height > MAX_EDGE ||
        metadata.width * metadata.height > MAX_PIXELS || (metadata.pages ?? 1) > 1) {
      throw new Error("Unsupported image dimensions or animation");
    }
    // toBuffer forces a full decode. Fresh encoding drops metadata and trailing payloads;
    // rotate applies EXIF orientation before the metadata is discarded.
    const pipeline = image.rotate().timeout({ seconds: 10 });
    const output = await (format === "jpeg" ? pipeline.jpeg({ quality: 90 })
      : format === "png" ? pipeline.png({ compressionLevel: 6 })
        : pipeline.webp({ quality: 90 })).toBuffer();
    if (!output.length || output.length > MAX_BYTES) throw new Error("Output exceeds upload limit");
    return output;
  } catch {
    throw new Error("Das Bild ist beschädigt, animiert oder zu groß. Bitte als einzelnes JPEG-, PNG- oder WebP-Bild mit höchstens 40 Megapixeln und 5 MB erneut speichern.");
  }
}
