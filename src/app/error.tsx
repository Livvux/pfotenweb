"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Faengt jeden Fehler unterhalb des Root-Layouts ab. Die eigentliche Ursache
 * steht im Server-Log, dem Besucher wird sie bewusst nicht gezeigt: eine
 * Stacktrace-Zeile auf der Seite eines Tierschutzvereins hilft niemandem und
 * verraet unter Umstaenden Interna.
 *
 * digest ist die von Next vergebene Kennung. Sie steht auch im Server-Log und
 * ist damit das Einzige, was ein Anrufer sinnvoll durchgeben kann.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unbehandelter Fehler in der Oberflaeche:", error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">
          Da ist etwas schiefgelaufen
        </h1>
        <p className="mt-3 text-stone-600">
          Der Fehler wurde protokolliert. Versuch es bitte noch einmal.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-ink px-5 py-2.5 font-medium text-white transition hover:opacity-90"
          >
            Erneut versuchen
          </button>
          <Link
            href="/"
            className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 font-medium text-stone-700 transition hover:bg-stone-100"
          >
            Zur Startseite
          </Link>
        </div>
        {error.digest ? (
          <p className="mt-8 text-xs text-stone-400">
            Kennung: {error.digest}
          </p>
        ) : null}
      </div>
    </main>
  );
}
