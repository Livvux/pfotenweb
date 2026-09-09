# Pfotenweb – eine Website für Ihren Tierschutzverein

Vollständige Software für **einen Verein pro Installation**: Tiere und Bilder,
Neuigkeiten, Kontaktanfragen, Vereinsgestaltung, Impressum und Teamzugänge.
Kein Tierlimit, kein Abo, keine Verbindung zu einem Pfotenweb-Konto erforderlich.
MIT-lizenziert: selbst installieren, anpassen und weitergeben.

Für Hosting ohne Serververwaltung gibt es [Pfotenweb](https://pfotenweb.de).
Diese öffentliche Version enthält keine Plattformverwaltung oder Abrechnung.

## Installation mit Docker Compose

Voraussetzungen: eigener Linux-Server, Docker mit Compose, Domain. PostgreSQL
bleibt im internen Docker-Netz. Port 3000 ist nur lokal erreichbar.

```sh
git clone https://github.com/Livvux/pfotenweb.git
cd pfotenweb
git checkout v1.0.1
cp .env.example .env
openssl rand -hex 32
```

`.env` ausfüllen: frisches Datenbankpasswort, eigenes langes Adminpasswort,
Vereinsname, Domain, SITE_URL und Zertifikatskontakt. Verwenden Sie für das
Datenbankpasswort den erzeugten Hex-Wert. `.env` niemals veröffentlichen.

```sh
docker compose --profile https up -d --build
```

A-/AAAA-Einträge Ihrer Domain müssen auf Ihren Server zeigen; Ports 80 und 443
müssen frei und erreichbar sein. Caddy stellt HTTPS bereit. Mit vorhandenem
Reverse Proxy starten Sie ohne `--profile https` und leiten auf
`127.0.0.1:3000` weiter. Der Proxy muss X-Forwarded-For und X-Forwarded-Host
überschreiben, damit Clients diese Werte nicht vortäuschen können.

Öffnen Sie `https://IHRE-DOMAIN/admin`. Unter „Verein“ ergänzen Sie Anschrift,
Kontakt und Rechtstexte. Die Einrichtung erzeugt keine Tiere oder Demoinhalte.
Spätere Starts ändern vorhandene Zugangsdaten nicht. Die INITIAL_ADMIN_*-Werte
können nach erfolgreicher Einrichtung aus `.env` entfernt werden.

## Daten von Pfotenweb übernehmen

Im gehosteten Vereinszugang: „Datenexport“, Passwort bestätigen, Archiv laden.
Das Archiv enthält auch personenbezogene Kontaktanfragen; geschützt behandeln.

Import nur in eine frisch eingerichtete Installation, bevor Tiere, Beiträge
oder Bilder angelegt wurden:

```sh
mkdir -p transfer
# Archiv als transfer/pfotenweb-export.tar.gz ablegen
docker compose stop app
docker compose run --rm import
docker compose start app
```

Teamkonten richten Sie anschließend neu ein. Abrechnung, Passwörter und Sitzungen
werden nicht übertragen. Entfernen Sie das Archiv nach erfolgreicher Prüfung
vom Server. Der Import prüft Format, Pfade, Größen, Prüfsummen und Referenzen;
bei einem Fehler werden importierte Daten und Dateien zurückgerollt.

## Sicherung und Wiederherstellung

Datenbank und Uploads gehören zusammen. Erstellen Sie tägliche Sicherungen auf
einem getrennten, verschlüsselten Speichermedium. Für einen konsistenten Stand
wird die Anwendung während der Sicherung kurz gestoppt:

```sh
mkdir -p backup
docker compose stop app
docker compose exec -T db pg_dump -U pfotenweb -d pfotenweb -Fc > backup/database.dump
docker compose run -T --rm --no-deps --entrypoint tar app -czf - -C /data/uploads . > backup/uploads.tar.gz
docker compose start app
```

Wiederherstellung auf einer passenden, leeren Installation, mit gestoppter App:

```sh
docker compose exec -T db pg_restore -U pfotenweb -d pfotenweb --clean --if-exists < backup/database.dump
docker compose run -T --rm --no-deps --entrypoint tar app -xzf - -C /data/uploads < backup/uploads.tar.gz
docker compose start app
```

`--clean` ersetzt vorhandene Daten: vorher eine weitere Sicherung erstellen.
Prüfen Sie eine Wiederherstellung regelmäßig auf einem getrennten System.

## Updates und Anpassungen

Vor Updates Datenbank und Uploads sichern, Release-Hinweise lesen und eigene
Änderungen committen. Release auswählen, neu bauen und starten:

```sh
git fetch --tags
git checkout vX.Y.Z
docker compose --profile https up -d --build
```

Migrationen laufen vor dem App-Start. Bei fehlgeschlagener Migration startet die
neue App nicht. Ein Rollback nach Schemaänderungen kann die Wiederherstellung der
Sicherung erfordern; nicht einfach nur ein älteres Image starten.

Farben, Logo, Texte und Vereinsdaten ändern Sie im Vereinszugang. Weitergehende
Anpassungen erfolgen im Quelltext mit Next.js/TypeScript. Entwicklung:
`pnpm install --frozen-lockfile`, `.env` für eine lokale Datenbank einrichten,
`pnpm db:migrate`, `pnpm setup`, `pnpm dev`. Node.js 24 und pnpm 11 verwenden.
Prüfungen: `pnpm exec next typegen`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.

Für E-Mails optional SMTP konfigurieren. Ohne SMTP bleiben Kontaktanfragen in
`/admin/anfragen` lesbar. Eigene Domains erfordern passende SPF/DKIM-Einträge.

## Lizenz und Hilfe

[MIT](LICENSE). Abhängigkeiten und Schriften behalten ihre jeweiligen Lizenzen;
siehe [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Keine Tierfotos enthalten.
GitHub-Issues dienen Fehlerberichten und Wünschen; keine garantierte Antwortzeit.
Sicherheitsprobleme bitte vertraulich an lucas@lkmedia.net melden.
