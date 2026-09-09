import assert from "node:assert";
import { hashPassword, verifyPassword } from "./password";

async function main() {
  const hash = await hashPassword("richtig-es-P@ss!");
  assert.ok(hash.startsWith("scrypt:"), "Hash-Format scrypt:salt:key");
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
