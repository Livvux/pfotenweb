# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Pfotenweb als schlankes Produktions-Image.
#
# Drei Stufen, damit im Ergebnis weder pnpm noch devDependencies noch der
# Quelltext landen. Was uebrig bleibt, ist der von Next erzeugte
# standalone-Server plus das, was er zur Laufzeit braucht.
#
# Migrationen laufen NICHT hier, sondern als eigener Einmal-Container aus der
# Builder-Stufe. Grund: db:migrate braucht tsx und drizzle-kit, beides
# devDependencies. Sie ins Laufzeit-Image zu holen, blaeht es auf, und eine
# gescheiterte Migration waere eine Absturzschleife statt eines sichtbaren
# Fehlschlags. Siehe den Dienst "setup" in compose.yaml.
# ---------------------------------------------------------------------------

ARG NODE_VERSION=24-alpine

# --- Bauen ------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
RUN corepack enable
WORKDIR /app
RUN mkdir -p /data/uploads && chown 1001:1001 /data/uploads

# Erst nur die Manifeste. Aendert sich nur der Quelltext, bleibt diese Schicht
# im Cache und die Installation entfaellt.
#
# Bewusst ein schlichtes pnpm install statt pnpm fetch mit Cache-Mount: der
# Store landet bei fetch in einem Mount, den die naechste Stufe nicht sehen
# kann. Das ist der Sorte Cleverness, die genau einmal auffaellt, naemlich
# beim ersten Build auf einem fremden Rechner.
# --node-linker=hoisted legt ein flaches node_modules an, so wie npm es taete.
#
# Ohne das scheitert der fertige Container beim Start mit "Cannot find module
# @swc/helpers". Der Datei-Tracer von Next folgt pnpms Symlink-Baum nicht
# vollstaendig, und die fehlenden Pakete landen nicht in .next/standalone. Der
# Fehler faellt erst beim Start auf, nie beim Build.
#
# Als CLI-Option und nicht in .npmrc: pnpm 11 liest node-linker nicht mehr aus
# .npmrc, sondern aus pnpm-workspace.yaml. Dort einzutragen wuerde die lokale
# Entwicklung mitaendern, und das ist hier nicht gemeint.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN printf '\nnodeLinker: hoisted\n' >> pnpm-workspace.yaml \
 && pnpm install --frozen-lockfile --prod=false

COPY . .
# Keep the same linker for pnpm run; pnpm 11 otherwise reinstalls with symlinks.
RUN printf '\nnodeLinker: hoisted\n' >> pnpm-workspace.yaml

# Die DATABASE_URL zeigt absichtlich ins Leere. Der Build darf keine Datenbank
# brauchen, und wenn er es doch tut, soll es hier scheitern und nicht erst auf
# dem Server.
ENV DATABASE_URL="postgres://build:build@127.0.0.1:1/leer"
ENV BUILD_STANDALONE=true
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# --- Laufzeit ---------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Ohne HOSTNAME bindet der standalone-Server auf localhost und ist von
# ausserhalb des Containers nicht erreichbar.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV UPLOAD_DIR=/data/uploads

RUN apk add --no-cache curl

RUN addgroup -g 1001 -S pfotenweb \
 && adduser -u 1001 -S pfotenweb -G pfotenweb

# standalone kopiert public/ und .next/static/ NICHT mit. Fehlen sie, startet
# der Server, liefert aber jedes Bild und jedes Stylesheet als 404.
COPY --from=builder --chown=pfotenweb:pfotenweb /app/.next/standalone ./
COPY --from=builder --chown=pfotenweb:pfotenweb /app/.next/static ./.next/static
COPY --from=builder --chown=pfotenweb:pfotenweb /app/public ./public
COPY --from=builder --chown=pfotenweb:pfotenweb /app/.runtime ./.runtime
# Startup validation runs outside the Next bundle and needs its own Zod module.
COPY --from=builder --chown=pfotenweb:pfotenweb /app/node_modules/zod ./node_modules/zod

RUN mkdir -p /data/uploads && chown -R pfotenweb:pfotenweb /data

COPY --chown=pfotenweb:pfotenweb LICENSE THIRD_PARTY_NOTICES.md ./
COPY --chown=pfotenweb:pfotenweb licenses ./licenses

USER pfotenweb
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

CMD ["sh", "-c", "node .runtime/env.selftest.js && exec node server.js"]
