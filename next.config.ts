import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Nur fuer das Docker-Image, gesteuert ueber BUILD_STANDALONE=true.
   *
   * "standalone" legt .next/standalone mit einem eigenen server.js an, das
   * ohne node_modules auskommt. Das ist genau das, was ein schlankes Image
   * braucht. Es ist aber nicht das, was `pnpm start` erwartet, und der Weg
   * ueber `pnpm build && pnpm start` steht im README als der einfache
   * Self-Hosting-Weg. Darum ein Schalter statt einer Festlegung: wer nichts
   * setzt, bekommt weiterhin den gewohnten Ablauf.
   *
   * Zwei Dinge, die standalone NICHT mitkopiert und die das Dockerfile
   * deshalb von Hand nachreicht: public/ und .next/static/. Fehlen sie,
   * startet der Server, liefert aber jedes Bild und jedes Stylesheet als 404.
   */
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  experimental: {
    /*
     * Ohne diese Zeile ist der Foto-Upload praktisch unbenutzbar.
     *
     * Next begrenzt den Body einer Server Action standardmaessig auf 1 MB. Die
     * 5-MB-Pruefung in savePhotos wurde deshalb nie erreicht: ein normales
     * Handyfoto (3 bis 8 MB) scheiterte vorher im Framework, ohne dass eine
     * verwertbare Meldung im Formular ankam.
     *
     * 12 MB traegt acht bereits im Browser verkleinerte Fotos mit reichlich
     * Luft fuer den Multipart-Rahmen. Die eigentliche Groessengrenze bleibt
     * serverseitig in savePhotos, wo sie eine deutsche Fehlermeldung erzeugen
     * kann.
     */
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
