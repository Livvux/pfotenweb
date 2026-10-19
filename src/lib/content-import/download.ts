import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import ipaddr from "ipaddr.js";
import { imageExtension } from "./storage";
import { MAX_UPLOAD_BYTES } from "./storage";

type Address = { address: string; family: number };
type Dependencies = {
  resolve: (hostname: string) => Promise<Address[]>;
  read: (url: URL, address: Address, signal: AbortSignal) => Promise<Buffer | string>;
  timeout: number;
  validateUrl: (url: URL) => void;
};
export function publicAddress(value: string): boolean {
  try { return ipaddr.parse(value).range() === "unicast"; } catch { return false; }
}
export function imageUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Keine vollständige öffentliche Bildadresse. Bitte Bilddatei hochladen."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port || url.hostname.endsWith(".localhost") || url.hostname === "localhost") throw new Error("Bildadresse nicht erlaubt.");
  return url;
}
function readPublicImage(url: URL, pinned: Address, signal: AbortSignal): Promise<Buffer | string> {
  return new Promise((resolve, reject) => {
    const req = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      signal,
      // Do not resolve again when opening the socket. TLS verifies the original hostname.
      lookup: (_host, options, callback) => options.all ? callback(null, [pinned]) : callback(null, pinned.address, pinned.family),
      headers: { Accept: "image/jpeg,image/png,image/webp" },
    }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode ?? 0) && res.headers.location) { res.destroy(); resolve(new URL(res.headers.location, url).href); return; }
      if (res.statusCode !== 200 || Number(res.headers["content-length"] ?? 0) > MAX_UPLOAD_BYTES) { res.destroy(); reject(new Error("Bild fehlt oder überschreitet 5 MB.")); return; }
      const chunks: Buffer[] = []; let size = 0;
      res.on("data", (chunk: Buffer) => { size += chunk.length; if (size > MAX_UPLOAD_BYTES) res.destroy(new Error("Bild überschreitet 5 MB.")); else chunks.push(chunk); });
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", () => reject(new Error("Bild konnte nicht vollständig geladen werden.")));
    });
    req.on("error", () => reject(new Error("Bildabruf fehlgeschlagen oder dauerte zu lange.")));
    req.end();
  });
}
async function within<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  let abort: () => void = () => {};
  try { return await Promise.race([work, new Promise<never>((_, reject) => { abort = () => reject(new Error("Bildabruf dauerte zu lange.")); if (signal.aborted) abort(); else signal.addEventListener("abort", abort, { once: true }); })]); }
  finally { signal.removeEventListener("abort", abort); }
}
/** Dependencies are injectable for isolated network tests, never derived from request inputs. */
export async function downloadImage(value: string, dependencies: Partial<Dependencies> = {}): Promise<{ body: Buffer; ext: string }> {
  const resolve = dependencies.resolve ?? (hostname => lookup(hostname, { all: true }));
  const read = dependencies.read ?? readPublicImage;
  const signal = AbortSignal.timeout(dependencies.timeout ?? 20_000);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const url = imageUrl(value);
    dependencies.validateUrl?.(url);
    const addresses = await within(resolve(url.hostname.replace(/^\[|\]$/g, "")), signal);
    if (!addresses.length || addresses.some(a => !publicAddress(a.address))) throw new Error("Bildadresse verweist nicht ausschließlich auf öffentliche IP-Adressen.");
    const result = await within(read(url, addresses[0], signal), signal);
    if (typeof result === "string") { value = result; continue; }
    if (!result.length || result.length > MAX_UPLOAD_BYTES) throw new Error("Bild fehlt oder überschreitet 5 MB.");
    return { body: result, ext: imageExtension(result) };
  }
  throw new Error("Bildadresse leitet zu oft weiter.");
}
