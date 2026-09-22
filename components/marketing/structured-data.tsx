import { LEGAL } from "@/lib/legal";
import { SITE } from "@/lib/site";
import { PRICES } from "@/lib/billing/public";

/**
 * Schema.org data for the landing page. Search engines use it for the knowledge panel and
 * the price/rating row under the result; everything here must match what the site says.
 */
export function StructuredData() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE.url}/#organization`,
        name: SITE.name,
        url: SITE.url,
        logo: `${SITE.url}/brand/configsync-mark.svg`,
        email: LEGAL.email,
        address: { "@type": "PostalAddress", addressLocality: "Viseu", addressCountry: "PT" },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE.url}/#website`,
        url: SITE.url,
        name: SITE.name,
        publisher: { "@id": `${SITE.url}/#organization` },
        inLanguage: "en",
      },
      {
        "@type": "SoftwareApplication",
        name: SITE.name,
        applicationCategory: "UtilitiesApplication",
        applicationSubCategory: "Game settings manager",
        operatingSystem: "Web, Windows, Linux",
        url: SITE.url,
        publisher: { "@id": `${SITE.url}/#organization` },
        description:
          "Store, organise and compare the settings you use for any game, then put the setup you want on any PC. Every save keeps a snapshot.",
        offers: [
          {
            "@type": "Offer",
            name: "Free",
            price: "0",
            priceCurrency: "EUR",
            description: "Three active games, the companion, ten snapshots per preset.",
          },
          {
            "@type": "Offer",
            name: "Pro (monthly)",
            price: "2.99",
            priceCurrency: "EUR",
            description: `${PRICES.monthly} — unlimited games, full history, auto-switch and per-PC presets.`,
          },
          {
            "@type": "Offer",
            name: "Pro (lifetime)",
            price: "24.99",
            priceCurrency: "EUR",
            description: `${PRICES.lifetime} — the same Pro, paid once.`,
          },
        ],
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      // Built from our own constants, and "<" is escaped so no value could ever close the tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
