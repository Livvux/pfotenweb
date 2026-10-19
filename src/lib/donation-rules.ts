import { z } from "zod";

// National formats: SWIFT IBAN Registry, release 102 (June 2026).
// https://www.swift.com/swift-resource/9606/download?language=en
const ibanPatterns: Record<string, RegExp> = {
  AD: /^AD[0-9]{2}[0-9]{4}[0-9]{4}[A-Z0-9]{12}$/,
  AE: /^AE[0-9]{2}[0-9]{3}[0-9]{16}$/,
  AL: /^AL[0-9]{2}[0-9]{8}[A-Z0-9]{16}$/,
  AT: /^AT[0-9]{2}[0-9]{5}[0-9]{11}$/,
  AZ: /^AZ[0-9]{2}[A-Z]{4}[A-Z0-9]{20}$/,
  BA: /^BA[0-9]{2}[0-9]{3}[0-9]{3}[0-9]{8}[0-9]{2}$/,
  BE: /^BE[0-9]{2}[0-9]{3}[0-9]{7}[0-9]{2}$/,
  BG: /^BG[0-9]{2}[A-Z]{4}[0-9]{4}[0-9]{2}[A-Z0-9]{8}$/,
  BH: /^BH[0-9]{2}[A-Z]{4}[A-Z0-9]{14}$/,
  BI: /^BI[0-9]{2}[0-9]{5}[0-9]{5}[0-9]{11}[0-9]{2}$/,
  BR: /^BR[0-9]{2}[0-9]{8}[0-9]{5}[0-9]{10}[A-Z]{1}[A-Z0-9]{1}$/,
  BY: /^BY[0-9]{2}[A-Z0-9]{4}[0-9]{4}[A-Z0-9]{16}$/,
  CH: /^CH[0-9]{2}[0-9]{5}[A-Z0-9]{12}$/,
  CR: /^CR[0-9]{2}[0-9]{4}[0-9]{14}$/,
  CY: /^CY[0-9]{2}[0-9]{3}[0-9]{5}[A-Z0-9]{16}$/,
  CZ: /^CZ[0-9]{2}[0-9]{4}[0-9]{6}[0-9]{10}$/,
  DE: /^DE[0-9]{2}[0-9]{8}[0-9]{10}$/,
  DJ: /^DJ[0-9]{2}[0-9]{5}[0-9]{5}[0-9]{11}[0-9]{2}$/,
  DK: /^DK[0-9]{2}[0-9]{4}[0-9]{9}[0-9]{1}$/,
  DO: /^DO[0-9]{2}[A-Z0-9]{4}[0-9]{20}$/,
  EE: /^EE[0-9]{2}[0-9]{2}[0-9]{14}$/,
  EG: /^EG[0-9]{2}[0-9]{4}[0-9]{4}[0-9]{17}$/,
  ES: /^ES[0-9]{2}[0-9]{4}[0-9]{4}[0-9]{1}[0-9]{1}[0-9]{10}$/,
  FI: /^FI[0-9]{2}[0-9]{3}[0-9]{11}$/,
  FK: /^FK[0-9]{2}[A-Z]{2}[0-9]{12}$/,
  FO: /^FO[0-9]{2}[0-9]{4}[0-9]{9}[0-9]{1}$/,
  FR: /^FR[0-9]{2}[0-9]{5}[0-9]{5}[A-Z0-9]{11}[0-9]{2}$/,
  GB: /^GB[0-9]{2}[A-Z]{4}[0-9]{6}[0-9]{8}$/,
  GE: /^GE[0-9]{2}[A-Z]{2}[0-9]{16}$/,
  GI: /^GI[0-9]{2}[A-Z]{4}[A-Z0-9]{15}$/,
  GL: /^GL[0-9]{2}[0-9]{4}[0-9]{9}[0-9]{1}$/,
  GR: /^GR[0-9]{2}[0-9]{3}[0-9]{4}[A-Z0-9]{16}$/,
  GT: /^GT[0-9]{2}[A-Z0-9]{4}[A-Z0-9]{20}$/,
  HN: /^HN[0-9]{2}[A-Z]{4}[0-9]{20}$/,
  HR: /^HR[0-9]{2}[0-9]{7}[0-9]{10}$/,
  HU: /^HU[0-9]{2}[0-9]{3}[0-9]{4}[0-9]{1}[0-9]{15}[0-9]{1}$/,
  IE: /^IE[0-9]{2}[A-Z]{4}[0-9]{6}[0-9]{8}$/,
  IL: /^IL[0-9]{2}[0-9]{3}[0-9]{3}[0-9]{13}$/,
  IQ: /^IQ[0-9]{2}[A-Z]{4}[0-9]{3}[0-9]{12}$/,
  IS: /^IS[0-9]{2}[0-9]{4}[0-9]{2}[0-9]{6}[0-9]{10}$/,
  IT: /^IT[0-9]{2}[A-Z]{1}[0-9]{5}[0-9]{5}[A-Z0-9]{12}$/,
  JO: /^JO[0-9]{2}[A-Z]{4}[0-9]{4}[A-Z0-9]{18}$/,
  KW: /^KW[0-9]{2}[A-Z]{4}[A-Z0-9]{22}$/,
  KZ: /^KZ[0-9]{2}[0-9]{3}[A-Z0-9]{13}$/,
  LB: /^LB[0-9]{2}[0-9]{4}[A-Z0-9]{20}$/,
  LC: /^LC[0-9]{2}[A-Z]{4}[A-Z0-9]{24}$/,
  LI: /^LI[0-9]{2}[0-9]{5}[A-Z0-9]{12}$/,
  LT: /^LT[0-9]{2}[0-9]{5}[0-9]{11}$/,
  LU: /^LU[0-9]{2}[0-9]{3}[A-Z0-9]{13}$/,
  LV: /^LV[0-9]{2}[A-Z]{4}[A-Z0-9]{13}$/,
  LY: /^LY[0-9]{2}[0-9]{3}[0-9]{3}[0-9]{15}$/,
  MC: /^MC[0-9]{2}[0-9]{5}[0-9]{5}[A-Z0-9]{11}[0-9]{2}$/,
  MD: /^MD[0-9]{2}[A-Z0-9]{2}[A-Z0-9]{18}$/,
  ME: /^ME[0-9]{2}[0-9]{3}[0-9]{13}[0-9]{2}$/,
  MK: /^MK[0-9]{2}[0-9]{3}[A-Z0-9]{10}[0-9]{2}$/,
  MN: /^MN[0-9]{2}[0-9]{4}[0-9]{12}$/,
  MR: /^MR[0-9]{2}[0-9]{5}[0-9]{5}[0-9]{11}[0-9]{2}$/,
  MT: /^MT[0-9]{2}[A-Z]{4}[0-9]{5}[A-Z0-9]{18}$/,
  MU: /^MU[0-9]{2}[A-Z]{4}[0-9]{2}[0-9]{2}[0-9]{12}[0-9]{3}[A-Z]{3}$/,
  NI: /^NI[0-9]{2}[A-Z]{4}[0-9]{20}$/,
  NL: /^NL[0-9]{2}[A-Z]{4}[0-9]{10}$/,
  NO: /^NO[0-9]{2}[0-9]{4}[0-9]{6}[0-9]{1}$/,
  OM: /^OM[0-9]{2}[0-9]{3}[A-Z0-9]{16}$/,
  PK: /^PK[0-9]{2}[A-Z]{4}[A-Z0-9]{16}$/,
  PL: /^PL[0-9]{2}[0-9]{8}[0-9]{16}$/,
  PS: /^PS[0-9]{2}[A-Z]{4}[A-Z0-9]{21}$/,
  PT: /^PT[0-9]{2}[0-9]{4}[0-9]{4}[0-9]{11}[0-9]{2}$/,
  QA: /^QA[0-9]{2}[A-Z]{4}[A-Z0-9]{21}$/,
  RO: /^RO[0-9]{2}[A-Z]{4}[A-Z0-9]{16}$/,
  RS: /^RS[0-9]{2}[0-9]{3}[0-9]{13}[0-9]{2}$/,
  RU: /^RU[0-9]{2}[0-9]{9}[0-9]{5}[A-Z0-9]{15}$/,
  SA: /^SA[0-9]{2}[0-9]{2}[A-Z0-9]{18}$/,
  SC: /^SC[0-9]{2}[A-Z]{4}[0-9]{2}[0-9]{2}[0-9]{16}[A-Z]{3}$/,
  SD: /^SD[0-9]{2}[0-9]{2}[0-9]{12}$/,
  SE: /^SE[0-9]{2}[0-9]{3}[0-9]{16}[0-9]{1}$/,
  SI: /^SI[0-9]{2}[0-9]{5}[0-9]{8}[0-9]{2}$/,
  SK: /^SK[0-9]{2}[0-9]{4}[0-9]{6}[0-9]{10}$/,
  SM: /^SM[0-9]{2}[A-Z]{1}[0-9]{5}[0-9]{5}[A-Z0-9]{12}$/,
  SO: /^SO[0-9]{2}[0-9]{4}[0-9]{3}[0-9]{12}$/,
  ST: /^ST[0-9]{2}[0-9]{4}[0-9]{4}[0-9]{11}[0-9]{2}$/,
  SV: /^SV[0-9]{2}[A-Z]{4}[0-9]{20}$/,
  TL: /^TL[0-9]{2}[0-9]{3}[0-9]{14}[0-9]{2}$/,
  TN: /^TN[0-9]{2}[0-9]{2}[0-9]{3}[0-9]{13}[0-9]{2}$/,
  TR: /^TR[0-9]{2}[0-9]{5}[0-9]{1}[A-Z0-9]{16}$/,
  UA: /^UA[0-9]{2}[0-9]{6}[A-Z0-9]{19}$/,
  VA: /^VA[0-9]{2}[0-9]{3}[0-9]{15}$/,
  VG: /^VG[0-9]{2}[A-Z]{4}[0-9]{16}$/,
  XK: /^XK[0-9]{2}[0-9]{4}[0-9]{10}[0-9]{2}$/,
  YE: /^YE[0-9]{2}[A-Z]{4}[0-9]{4}[A-Z0-9]{18}$/,
};

export function validIban(value: string): boolean {
  if (!ibanPatterns[value.slice(0, 2)]?.test(value)) return false;
  const checkDigits = Number(value.slice(2, 4));
  if (checkDigits < 2 || checkDigits > 98) return false;
  const digits = (value.slice(4) + value.slice(0, 4)).replace(
    /[A-Z]/g,
    (char) => String(char.charCodeAt(0) - 55),
  );
  let remainder = 0;
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}

export const bankSchema = z
  .object({
    accountHolder: z.string().trim().max(160),
    iban: z
      .string()
      .max(80)
      .transform((value) => value.replace(/\s/g, "").toUpperCase())
      .refine(
        (value) => !value || validIban(value),
        "Bitte eine gültige IBAN eingeben.",
      ),
    bic: z
      .string()
      .trim()
      .toUpperCase()
      .refine(
        (value) => !value || /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(value),
        "Bitte eine gültige BIC eingeben.",
      ),
    bankName: z.string().trim().max(160),
    purpose: z.string().trim().max(140),
  })
  .refine((value) => Boolean(value.iban) === Boolean(value.accountHolder), {
    message: "Kontoinhaber und IBAN bitte gemeinsam angeben oder beide leeren.",
    path: ["iban"],
  });
export type DonationBank = z.infer<typeof bankSchema>;
export const emptyBank: DonationBank = {
  accountHolder: "",
  iban: "",
  bic: "",
  bankName: "",
  purpose: "",
};
export const donationCopyDefaults = {
  heading: "Gemeinsam Tieren helfen",
  introduction: "Mit Ihrer Unterstützung ermöglichen Sie Futter, tierärztliche Versorgung und ein sicheres Zuhause.",
  receiptNote: "",
};
export const donationCopySchema = z.object({
  heading: z.string().trim().min(1).max(120),
  introduction: z.string().trim().min(1).max(600),
  receiptNote: z.string().trim().max(600),
});
