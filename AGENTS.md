<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Self-Hosted-Grenze

Diese Codebasis bleibt eine eigenständige Single-Verein-Edition. Vor jedem Push
`python3 scripts/check-edition.py` und den vollständigen Veröffentlichungsdiff
prüfen. Neue Dateien/Abhängigkeiten nur bewusst in der Freigabeliste ergänzen.
Keine privaten Repository-Historien übernehmen. Umfang und Releases: `docs/editions.md`.

## Lokale Installation und Abnahme

- Das Projektskript heißt `setup`; ausdrücklich `pnpm run setup` verwenden. `pnpm setup` ist unter pnpm 11 ein anderer, eingebauter Befehl.
- Vor dem Auth-Upgrade `BETTER_AUTH_SECRET` und `SECURITY_MAIL_KEY` konfigurieren. Migrationen erhalten Benutzer-IDs, Rollen und bestehende Passwortnachweise; alte Sitzungen werden nicht als neue Anmeldung übernommen.
- `UPLOAD_DIR` außerhalb von `public` betreiben. Profil- und Entwurfsmedien bleiben privat; App und `media-cleanup` teilen Datenbank und Medienvolume.
- Schreibende Selbsttests und E2E ausschließlich mit Wegwerf-DB auf `127.0.0.1:55439` und lokalen Medien unter `/tmp`. Mailtests verwenden ausschließlich eine lokale SMTP-Senke.
- Produktionscookies für WebKit über den lokalen HTTPS-Testproxy prüfen; Cookies nicht für HTTP-Abnahmen abschwächen.
