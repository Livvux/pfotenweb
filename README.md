# Pfotenweb – eine Website für Ihren Tierschutzverein

Vollständige Software für **einen Verein pro Installation**: Tiere und Bilder,
Neuigkeiten, Kontaktanfragen, Vereinsgestaltung, Impressum und Teamzugänge.
Kein Tierlimit, kein Abo, keine Verbindung zu einem Pfotenweb-Konto erforderlich.
MIT-lizenziert: selbst installieren, anpassen und weitergeben.

Für Hosting ohne Serververwaltung gibt es [Pfotenweb](https://pfotenweb.de).
Diese öffentliche Version enthält keine Plattformverwaltung oder Abrechnung.

<img width="1270" height="894" alt="pfotenweb" src="https://github.com/user-attachments/assets/4f326e09-b916-466e-8706-23c701e7b0e2" />

## Installation mit Docker Compose

Voraussetzungen: eigener Linux-Server, Docker mit Compose, Domain. PostgreSQL
bleibt im internen Docker-Netz. Port 3000 ist nur lokal erreichbar.

**Versionshinweis:** Die folgende Installation wählt das veröffentlichte
Release `v1.0.1`, nicht den Entwicklungsstand auf `main`. Dieses Release liest
nur Archivformat 1. Für neuere Archive zuerst die [Kompatibilitätstabelle](#import-aus-neueren-exporten)
und die Hinweise des tatsächlich gewählten Releases prüfen. Ein PR oder grünes
`main` ist noch kein veröffentlichtes Update.

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
docker compose stop app media-cleanup
docker compose run --rm import
docker compose start app media-cleanup
```

Teamkonten richten Sie anschließend neu ein. Abrechnung, Passwörter und Sitzungen
werden nicht übertragen. Entfernen Sie nach erfolgreicher Prüfung nur die Transferkopie. Das vollständige
Quellarchiv mit Zusatzdaten bleibt im privaten Docker-Volume `import_archives`
unter `/data/import-archives` erhalten, auch nach `docker compose run --rm`. Der Import prüft Format, Pfade, Größen, Prüfsummen und Referenzen;
bei einem Fehler werden importierte Daten und Dateien zurückgerollt.

## Sicherung und Wiederherstellung

Datenbank und Uploads gehören zusammen. Erstellen Sie tägliche Sicherungen auf
einem getrennten, verschlüsselten Speichermedium. Für einen konsistenten Stand
wird die Anwendung während der Sicherung kurz gestoppt:

```sh
mkdir -p backup
docker compose stop app media-cleanup
docker compose exec -T db pg_dump -U pfotenweb -d pfotenweb -Fc > backup/database.dump
docker compose run -T --rm --no-deps --entrypoint tar app -czf - -C /data/uploads . > backup/uploads.tar.gz
docker compose run -T --rm --no-deps --entrypoint tar import -czf - -C /data/import-archives . > backup/import-archives.tar.gz
docker compose start app media-cleanup
```

Wiederherstellung auf einer passenden, leeren Installation, mit gestoppter App und Medienbereinigung:

```sh
docker compose exec -T db pg_restore -U pfotenweb -d pfotenweb --clean --if-exists < backup/database.dump
docker compose run -T --rm --no-deps --entrypoint tar app -xzf - -C /data/uploads < backup/uploads.tar.gz
docker compose run -T --rm --no-deps --entrypoint tar import -xzf - -C /data/import-archives < backup/import-archives.tar.gz
docker compose start app media-cleanup
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
`pnpm db:migrate`, `pnpm run setup`, `pnpm dev`. Node.js 24 und pnpm 11 verwenden.
Prüfungen: `pnpm exec next typegen`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.

Für E-Mails optional SMTP konfigurieren. Ohne SMTP bleiben Kontaktanfragen in
`/admin/anfragen` lesbar. Eigene Domains erfordern passende SPF/DKIM-Einträge.

## Lizenz und Hilfe

Anleitung zum Installieren: <a href="https://livvux.dev/blog/animal-rescue-websites/de>https://livvux.dev/blog/animal-rescue-websites/de</a>

[MIT](LICENSE). Abhängigkeiten und Schriften behalten ihre jeweiligen Lizenzen;
siehe [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Keine Tierfotos enthalten.
GitHub-Issues dienen Fehlerberichten und Wünschen; keine garantierte Antwortzeit.
Sicherheitsprobleme bitte vertraulich an lucas@lkmedia.net melden.

## Editionsumfang und Updates

Die Grenzen dieser Edition und der Update-Ablauf stehen in [Editionen](docs/editions.md).

## Tierprofile

<img width="1324" height="800" alt="tierprofil" src="https://github.com/user-attachments/assets/b4da3e15-4f9f-4f23-bcfa-4c070ecdc659" />


### Import aus neueren Exporten

| Installierter Stand | Lesbare Archivformate |
| --- | --- |
| Veröffentlichtes Release `v1.0.1` | 1 |
| Dieser Entwicklungsstand (noch kein neues Release) | 1–18 |

Der Offline-Import dieses Entwicklungsstands liest das gemeinsame Archivformat
bis Version 18. Der eigene Self-Hosted-Export bleibt bei Format 1. Tiere,
Tierbilder, Beiträge, Anfragen und die unterstützten Vereinsfelder werden in die
frisch eingerichtete, ansonsten leere Installation übernommen. App und Medienbereinigung vorher stoppen.

Zusätzliche Felder und Medien werden **nicht stillschweigend verworfen**. Dafür
muss `IMPORT_ARCHIVE_DIR` auf ein absolutes, privates Verzeichnis außerhalb von
`public` und `UPLOAD_DIR` zeigen. Der Import prüft sämtliche Dateien und behält
das vollständige Quellarchiv dort unverändert mit Dateirechten `0600`. Die Ausgabe
nennt alle zusätzlichen Datenbereiche und den Archivpfad. Diese Zusatzdaten sind
archiviert, werden von dieser Edition aber nicht angezeigt oder weiterbearbeitet.
Dazu zählen beispielsweise Cloud-Kampagnen, Verträge, Rückmeldungen,
Analytics-Historien und Videos. Gemeinsame Steckbriefwerte, Antwortverläufe,
Website-Dokumente, Anreden, Standort und Bankspenden werden dagegen übernommen. Quellarchiv in die
private Datensicherung aufnehmen; der normale Website-Export enthält nur die
hier unterstützten Daten. Unbekannte zukünftige Versionen werden abgelehnt.

Bei Format 15 werden auch Bewertungseinstellungen, Rückmeldungen und zugehörige
Medien ausschließlich im Originalarchiv erhalten. Sie werden weder öffentlich
angezeigt noch als Benachrichtigungen erneut ausgeführt. Auch ein Archiv ohne
Zusatzbereiche bleibt vor dem Umzug geschützt aufzubewahren.

### Privater Medienspeicher und Entwürfe

Der Website-Editor trennt Entwurf und Veröffentlichung und prüft beim Speichern
seine Revision. Nur veröffentlichte Bilder sind öffentlich erreichbar; Bilder
im Entwurf und im Verlauf bleiben Verantwortlichen vorbehalten. `UPLOAD_DIR`
muss deshalb absolut sein und außerhalb von `public` liegen. Compose verwendet
`/data/uploads`. Bei manueller Installation diesen Pfad vor dem Start setzen und
bestehende Uploads bei gestoppter App dorthin verschieben; keine öffentliche
Kopie privater Entwürfe behalten.

Der Dienst `media-cleanup` entfernt Dateien erst, wenn keine Inhaltsreferenz mehr
besteht. Löschabsichten werden zusammen mit der Inhaltsänderung gespeichert und
nach Fehlern wiederholt. App und Medienbereinigung verwenden dieselbe Datenbank
und denselben Uploadspeicher. Bei Sicherung und Wiederherstellung beide stoppen.
Manuell läuft der Dienst mit `node scripts/media-cleanup.mjs`.

### Anfrageantworten und Vereinsmails

Antworten werden vor der SMTP-Übergabe dauerhaft im Anfrageverlauf erfasst.
Derselbe Versandauftrag wird nie zweimal ausgeführt. „An Mailserver übergeben“
ist keine Zustellbestätigung; bei einer unklaren Übergabe gibt es keine
automatische Wiederholung. Anfragenlöschen entfernt auch den Antwortverlauf.
Ohne `SMTP_HOST` und `SMTP_FROM` ist die Antwortfunktion gesperrt.
Unter Erscheinungsbild stehen drei lokale HTML-Mailvorlagen mit unverändertem
Klartext zur Auswahl; externe Schrift- und Bildabrufe entfallen.

### Konten-Upgrade und private Profile

Vor diesem Upgrade eine gemeinsame Datenbank-/Mediensicherung erstellen und
App sowie Medienbereinigung stoppen. Zwei neue, dauerhaft aufbewahrte Secrets
konfigurieren: `BETTER_AUTH_SECRET` mit mindestens 32 Zeichen und
`SECURITY_MAIL_KEY` mit 32 zufälligen Bytes in Hex. Beispiele zur Erzeugung stehen
in `.env.example`. Danach Migrationen und ausdrücklich `pnpm run setup` ausführen.
Der gleichnamige eingebaute Befehl `pnpm setup` richtet ausschließlich pnpm ein.

Bestehende Benutzernamen, numerische IDs, Rollen und Passwortnachweise bleiben
erhalten. Bisherige Redaktionskonten behalten ihre drei bestehenden Fachrechte;
neue Teamkonten starten ohne Fachrechte. Bestehende Sitzungen enden beim Upgrade.
Eine Rückkehr zur alten Auth-Version benötigt die vollständige Sicherung vor
der Migration; die neue Anwendung darf nicht mit einem zurückgesetzten Schema
weiterlaufen.

Unter Konto kann jede Person ein internes Profil und eine persönliche
Sicherheitsadresse pflegen. E-Mail-Code, Einmal-Link und Wiederherstellung nutzen
nur bestätigte persönliche Adressen. Einladungen erzeugen erst nach Bestätigung
einen Zugang. Passkeys und Sicherheitsänderungen benötigen eine aktuelle
Bestätigung. Profile sind nur im angemeldeten Vereinsteam sichtbar. Beim Import
werden sie ausschließlich bereits bestehenden Benutzernamen zugeordnet;
Zugänge, Rechte, Sicherheitsadressen und Passwörter werden nicht importiert.

### Geführte Inhaltsübernahme und Tiersteckbriefe

Verantwortliche können unter `/admin/import` CSV oder WordPress-WXR privat
vorbereiten. UTF-8, höchstens 10 MiB und 1.000 Inhalte. Zuordnung, redaktionelle
Korrekturen, Bilder und Sichtbarkeit werden vor der Übernahme bestätigt.
Neuigkeiten starten als Entwurf. Die Seite verarbeitet begrenzte Pakete, solange
sie geöffnet ist, und setzt nach erneutem Öffnen fort. Quellenkennungen vermeiden
Wiederholungen; bereits übernommene Inhalte bleiben erhalten. Fehlende Bilder
ersetzen oder ausdrücklich abwählen. Bildabrufe prüfen öffentliche IP-Adressen,
Redirects und Größe; Dateien werden vollständig dekodiert. Vorbereitungen sind
nicht Teil des portablen Website-Exports. App und Medienbereinigung vor einer
konsistenten Sicherung stoppen.

Der Tiereditor bietet einen PDF-Steckbrief mit QR-Code, Kopiertext, Downloads der
eigenen Website-Bilder und manuelle Einstiegslinks zu shelta/TASSO. Es erfolgt
keine automatische Registrierung oder externe Veröffentlichung. QR-Adressen
bleiben beim Umbenennen stabil; ein Offline-Import erzeugt neue Kennungen.

Neue Exporte kennzeichnen sich als `pfotenweb-self-hosted`, Version 2. Das alte
Self-Hosted-Format `pfotenweb-single` Version 1 bleibt importierbar; gemeinsame
Archive der Versionen 1–18 werden weiterhin bewusst projiziert. Die neue
Kennzeichnung verhindert, dass erweiterte Profile und Website-Dokumente als
inhaltlich unverändertes altes Format ausgegeben werden.
