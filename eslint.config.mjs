import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".runtime/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Seiten und Komponenten duerfen die Datenbank nicht direkt anfassen.
    //
    // Der Branded Type TenantScope schuetzt nur dort, wo eine Abfragefunktion
    // ihn als Parameter verlangt. `db` selbst ist ungebrandet, also kommt eine
    // Seite, die den Umweg ueberspringt, nie mit dem Typ in Beruehrung und der
    // Compiler kann nicht anschlagen. Genau so sind fuenf Adminseiten ohne
    // Vereinsfilter entstanden. Die Regel macht daraus einen Lint-Fehler.
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/db",
              message:
                "Kein direkter DB-Zugriff in Seiten und Komponenten. Abfragefunktion in src/lib/ anlegen, die einen TenantScope verlangt.",
            },
            {
              name: "@/db/schema",
              message:
                "Tabellen gehoeren nach src/lib/, nicht in die Seite. Dort erzwingt der TenantScope den Vereinsfilter.",
            },
          ],
        },
      ],
    },
  },
  {
    rules: {
      // Bewusst weggeworfene Werte werden mit Unterstrich markiert, etwa beim
      // Herausdestrukturieren eines Feldes, das nicht in die DB soll.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
