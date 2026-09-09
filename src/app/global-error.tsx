"use client";

import { useEffect } from "react";

/**
 * Die letzte Instanz. Greift nur, wenn das Root-Layout selbst wirft, also
 * error.tsx gar nicht mehr gerendert werden kann. Deshalb bringt diese Datei
 * html und body selbst mit, und deshalb steht das Styling inline: die
 * Schriftvariablen aus dem Root-Layout gibt es hier nicht mehr, und globals.css
 * zu importieren waere in genau dem Moment eine weitere Fehlerquelle.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Fehler im Root-Layout:", error);
  }, [error]);

  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          background: "#f7f6f2",
          color: "#1c2a24",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
            Die Seite ist gerade nicht erreichbar
          </h1>
          <p style={{ marginTop: "0.75rem", color: "#57534e" }}>
            Bitte versuch es in einigen Minuten noch einmal.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "2rem",
              padding: "0.625rem 1.25rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#1c2a24",
              color: "#fff",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Erneut versuchen
          </button>
          {error.digest ? (
            <p
              style={{
                marginTop: "2rem",
                fontSize: "0.75rem",
                color: "#a8a29e",
              }}
            >
              Kennung: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
