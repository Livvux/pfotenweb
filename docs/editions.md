# Pfotenweb Self-Hosted

Diese MIT-Edition betreibt genau eine Vereinswebsite. Zum gepflegten Umfang
gehören Tiere und Bilder, Neuigkeiten, Kontaktanfragen, Vereinsgestaltung,
Benutzerverwaltung, Datenimport/-export, Installation und Migrationen.
Sicherheit, Fehlerkorrekturen, Tests und Update-Anleitungen gehören dazu.

Pfotenweb Cloud ist die separat betriebene gehostete Edition. Plattformverwaltung,
Abrechnung, Domain-Automatisierung, Social-Synchronisierung und Pro-Videos sind
nicht Teil dieser Codebasis. Cloud und Self-Hosted haben getrennte Releases.

## Änderungen und Veröffentlichungen

- Relevante Sicherheitskorrekturen bevorzugt ausliefern, normale Verbesserungen
  bündeln. Nicht jedes Cloud-Feature wird Teil von Self-Hosted.
- Neue Dateien und Abhängigkeiten in `.github/self-hosted-policy.json` ausdrücklich
  freigeben und im PR begründen. Keine automatische Neuerzeugung dieser Liste.
- Vor dem ersten Push den vollständigen Diff und die zu veröffentlichenden Commits
  auf sensible Inhalte prüfen. Auch PRs und deren Historie sind öffentlich.
- `python3 scripts/check-edition.py` prüft von Git erfasste Dateien, bekannte
  Plattform-Marker und freigegebene Abhängigkeiten. Neue Dateien vorher mit
  `git add` aufnehmen. Die Prüfung ersetzt keine Inhalts- oder Geheimnisprüfung.
- Änderungen über PRs mit erfolgreicher CI integrieren. Prüfvorschriften selbst
  sind Teil der Diff-Prüfung. Keine private Git-Historie importieren oder spiegeln.
- Für Releases einen geprüften `main`-Commit mit eigener Versionsnummer und
  Update-Hinweisen verwenden. Migrationen nie nachträglich ändern; nötige
  Sicherungs- und Upgrade-Schritte in den Release Notes nennen.
