import type { Metadata } from "next";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

/*
 * Bewusst statisch und vereinsneutral. Das Root-Layout traegt auch /_not-found
 * und den Adminbereich, und die duerfen fuer ihre Metadata nicht die Datenbank
 * anfassen: /_not-found wird beim Build vorgerendert, dann gibt es weder
 * Request-Host noch zwingend eine erreichbare Datenbank.
 *
 * Den Vereinsnamen setzt das (site)-Layout, das ohnehin nur mit Tenant laeuft.
 */
export const metadata: Metadata = {
  title: "Tierschutzverein",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${bricolage.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-body">{children}</body>
    </html>
  );
}
