import type { VatSettings } from "../money/document";
import { ZA_LOCALE } from "./za";
import type { LocalePack } from "./types";

export type { ContactFacts, LocalePack, ProfileField } from "./types";

/**
 * The countries we support. To add one: write src/lib/locale/<cc>.ts with the same shape,
 * add its docs under docs/locales/<cc>/, and register it here (see docs/locales/README.md).
 */
const PACKS: Record<string, LocalePack> = {
  [ZA_LOCALE.countryCode]: ZA_LOCALE,
};

export const DEFAULT_COUNTRY_CODE = ZA_LOCALE.countryCode;

export class UnsupportedCountryError extends Error {
  constructor(countryCode: string) {
    super(`No locale pack for country "${countryCode}"`);
    this.name = "UnsupportedCountryError";
  }
}

export function getLocalePack(countryCode: string): LocalePack {
  const pack = PACKS[countryCode];
  if (!pack) throw new UnsupportedCountryError(countryCode);
  return pack;
}

export function supportedCountryCodes(): string[] {
  return Object.keys(PACKS);
}

/** The VAT settings the money module needs, from the business and its country's rules. */
export function vatSettingsFor(
  profile: { vatRegistered: boolean; pricesIncludeVat: boolean },
  locale: LocalePack,
): VatSettings {
  if (!profile.vatRegistered) return { registered: false };
  return {
    registered: true,
    entry: profile.pricesIncludeVat ? "inclusive" : "exclusive",
    standardRateBp: locale.tax.standardRateBp,
  };
}
