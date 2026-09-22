/**
 * Business details. Most pages show `place` only — the full postal address and the operator's
 * name are not footer decoration, they are legal disclosures, so they live where the law wants
 * them and nowhere else:
 *
 * - `operator` — data controller (GDPR Art. 13) on /privacy, contract counterparty on /terms.
 * - `address`  — geographic address (e-Commerce Directive Art. 5(1)(b)) on /contact.
 * - `place`    — everywhere else, including the footer of every page.
 *
 * The VAT number is deliberately absent: Paddle is merchant of record and puts its own on the
 * invoice, which is the document that needs one.
 */
export const LEGAL = {
  /** Legal name of the operator (a sole trader's full name is fine). */
  operator: "Miguel Ferreira",
  /** Trading name shown to users. */
  brand: "ConfigSync",
  /** Country of establishment and governing law. */
  country: "Portugal",
  /** Full postal address. Shown on /contact only — Art. 5(1)(b) wants it accessible, not ambient. */
  address: "Praça das Palmeiras lt120, Viseu, Portugal",
  /** What every other page shows instead: where the service is run from, no street. */
  place: "Viseu, Portugal",
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
