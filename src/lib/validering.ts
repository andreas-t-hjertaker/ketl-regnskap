/**
 * Norske valideringsfunksjoner for organisasjonsnummer og bankkontonummer.
 *
 * Begge benytter Modulus 11 — den offisielle kontrollsiffer-algoritmen
 * brukt av Brønnøysundregistrene og norske banker.
 */

// ─── Organisasjonsnummer ─────────────────────────────────────────────────────

/**
 * Modulus 11-validering av norsk organisasjonsnummer (9 sifre).
 *
 * Vekter: [3, 2, 7, 6, 5, 4, 3, 2] for siffer 1–8.
 * Kontrollsiffer (siffer 9) = 11 − (sum mod 11).
 *   - Hvis rest = 0 → kontrollsiffer = 0
 *   - Hvis rest = 1 → ugyldig nummer (ingen gyldig kontrollsiffer)
 *
 * @see https://www.brreg.no/bedrift/organisasjonsnummer/
 */
export function validerOrgnr(orgnr: string): boolean {
  const sifre = orgnr.replace(/[\s.]/g, "");
  if (!/^\d{9}$/.test(sifre)) return false;
  const vekter = [3, 2, 7, 6, 5, 4, 3, 2];
  const sum = vekter.reduce((acc, v, i) => acc + v * parseInt(sifre[i], 10), 0);
  const rest = sum % 11;
  if (rest === 0) return parseInt(sifre[8], 10) === 0;
  if (rest === 1) return false; // ingen gyldig kontrollsiffer
  return parseInt(sifre[8], 10) === 11 - rest;
}

// ─── Bankkontonummer ─────────────────────────────────────────────────────────

/**
 * Modulus 11-validering av norsk bankkontonummer (11 sifre).
 *
 * Vekter: [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] for siffer 1–10.
 * Kontrollsiffer (siffer 11) = 11 − (sum mod 11).
 *   - Hvis rest = 0 → kontrollsiffer = 0
 *   - Hvis rest = 1 → ugyldig nummer
 *
 * Aksepterer formatene: "NNNNNNNNNN" (11 sifre), "NNNN.NN.NNNNN" og "NNNN NN NNNNN".
 *
 * @see https://www.bits.no/document/standarder-og-tjenester/nettbank/
 */
export function validerKontonr(kontonr: string): boolean {
  const sifre = kontonr.replace(/[\s.]/g, "");
  if (!/^\d{11}$/.test(sifre)) return false;
  const vekter = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = vekter.reduce((acc, v, i) => acc + v * parseInt(sifre[i], 10), 0);
  const rest = sum % 11;
  if (rest === 0) return parseInt(sifre[10], 10) === 0;
  if (rest === 1) return false;
  return parseInt(sifre[10], 10) === 11 - rest;
}

/**
 * Formater bankkontonummer til standard norsk visningsformat (NNNN.NN.NNNNN).
 * Returnerer uendret input hvis ikke 11 sifre.
 */
export function formaterKontonr(kontonr: string): string {
  const sifre = kontonr.replace(/[\s.]/g, "");
  if (sifre.length !== 11) return kontonr;
  return `${sifre.slice(0, 4)}.${sifre.slice(4, 6)}.${sifre.slice(6)}`;
}
