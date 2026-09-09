import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main(): Promise<void> {
  // Eigener Client mit max: 1 – der Migrator braucht eine einzelne Verbindung
  // und muss sie am Ende schliessen, sonst haengt der Prozess.
  // onnotice unterdrueckt die harmlosen "already exists, skipping"-Hinweise
  const client = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.end();
  console.log("Migrationen angewendet.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
