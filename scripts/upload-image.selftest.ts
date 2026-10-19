import assert from "node:assert/strict";
import sharp from "sharp";
import { normalizeUploadImage } from "../src/lib/upload-image";

async function main() {
  let passed = 0;
  async function rejects(input: Buffer, ext: string) {
    await assert.rejects(normalizeUploadImage(input, ext));
    passed++;
  }
  for (const [ext, format] of [[".jpg", "jpeg"], [".png", "png"], [".webp", "webp"]] as const) {
    const image = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#668899" } }).toFormat(format).toBuffer();
    const output = await normalizeUploadImage(image, ext);
    const meta = await sharp(output).metadata();
    assert.equal(meta.format, format);
    assert.equal(meta.width, 40);
    assert.equal(meta.height, 30);
    passed++;
    await rejects(image.subarray(0, Math.floor(image.length / 2)), ext);
  }
  await rejects(Buffer.from("this is not a picture"), ".jpg");
  await rejects(Buffer.from("%PDF-1.7\nnot a WebP"), ".webp");
  await rejects(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>'), ".png");
  await rejects(Buffer.alloc(0), ".jpg");
  await rejects(Buffer.alloc(5 * 1024 * 1024 + 1), ".jpg");
  const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "white" } }).png().toBuffer();
  await rejects(png, ".jpg");
  await rejects(png, ".svg");
  const longImage = await sharp({ create: { width: 16_385, height: 1, channels: 3, background: "white" } }).png().toBuffer();
  await rejects(longImage, ".png");
  const bomb = await sharp({ create: { width: 6400, height: 6400, channels: 3, background: "white" } }).png().toBuffer();
  await rejects(bomb, ".png");
  const withMetadata = await sharp(png).withExif({ IFD0: { Artist: "Private author" } }).png().toBuffer();
  const clean = await normalizeUploadImage(withMetadata, ".png");
  assert.equal((await sharp(clean).metadata()).exif, undefined);
  passed++;
  const payload = Buffer.from("PRIVATE_TRAILING_PAYLOAD");
  const stripped = await normalizeUploadImage(Buffer.concat([png, payload]), ".png");
  assert.equal(stripped.includes(payload), false);
  passed++;
  console.log(`Upload image: ${passed} checks passed (full decode, formats, limits, metadata and trailing content).`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
