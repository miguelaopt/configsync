/**
 * Business details shown on /terms, /privacy and /refunds.
 * TODO before launch: replace every placeholder below (Paddle's website review reads these pages).
 */
export const LEGAL = {
  /** Legal name of the operator (a sole trader's full name is fine). */
  operator: "Miguel Ferreira",
  /** Trading name shown to users. */
  brand: "ConfigSync",
  /** Country of establishment and governing law. */
  country: "Portugal",
  /** TODO: postal address required by EU e-commerce rules (can be a business address service). */
  address: "Praça das Palmeiras lt120, Viseu, Portugal",
  /** TODO: tax id (NIF). Leave empty to hide the line. */
  taxId: "",
  /** Contact for support, privacy requests and refunds. */
  email: "hello@configsync.app",
  /** Public origin of the service. */
  url: "https://configsync.app",
  /** Merchant of record for every purchase. */
  merchant: "Paddle.com Market Ltd",
  /** Hosting provider and region, for the privacy policy. */
  host: "Hetzner Online GmbH (Germany, EU)",
  /** Date shown as "Last updated" on all three pages. */
  updated: "2026-09-19",
} as const;
