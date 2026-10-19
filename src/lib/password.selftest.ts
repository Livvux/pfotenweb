import { scryptSync } from "node:crypto";
import assert from "node:assert";
import { hashPassword, verifyPassword } from "./password";

async function main() {
  const hash = await hashPassword("richtig-es-P@ss!");
  assert.match(hash, /^[a-f0-9]+:[a-f0-9]+$/, "Better Auth password format");
  const salt = Buffer.from("00112233445566778899aabbccddeeff", "hex");
  const legacy = `scrypt:${salt.toString("hex")}:${scryptSync("Bestandspasswort", salt, 64).toString("hex")}`;
  assert.ok(await verifyPassword("Bestandspasswort", legacy), "Existing hashes remain usable without a password reset");
  assert.ok(!await verifyPassword("falsch", legacy));
  assert.ok(await verifyPassword("richtig-es-P@ss!", hash), "korrektes PW");
  assert.ok(!(await verifyPassword("falsch", hash)), "falsches PW");
  assert.ok(
    !(await verifyPassword("richtig-es-P@ss!", "md5:aa:bb")),
    "kaputtes Format",
  );
  assert.ok(
    !(await verifyPassword("richtig-es-P@ss!", "scrypt:00:00")),
    "manipulierter Hash",
  );
  const h2 = await hashPassword("richtig-es-P@ss!");
  assert.notEqual(hash, h2, "Salz macht jeden Hash einzigartig");
  console.log("✓ Alle Passwort-Tests bestanden");
}

main();
