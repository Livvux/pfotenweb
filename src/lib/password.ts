import { hashPassword as betterHash, verifyPassword as betterVerify } from "better-auth/crypto";
import {
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  return betterHash(password.normalize("NFKC"));
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  if (!stored.startsWith("scrypt:")) {
    try { return await betterVerify({ password: password.normalize("NFKC"), hash: stored }); }
    catch { return false; }
  }
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !/^[a-f0-9]{32}$/.test(saltHex ?? "") || !/^[a-f0-9]{128}$/.test(hashHex ?? "")) return false;
  const hash = await scrypt(
    password.normalize("NFKC"),
    Buffer.from(saltHex, "hex"),
    KEYLEN,
  );
  const expected = Buffer.from(hashHex, "hex");
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}
