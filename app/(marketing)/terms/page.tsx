import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import { PRICES } from "@/lib/billing/public";
import { LegalPage, Section } from "@/components/marketing/legal";

export const metadata: Metadata = { title: "Terms of Service" };

/** TODO before launch: read once, adjust anything that doesn't match how you run the service. */
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={`These terms govern your use of ${LEGAL.brand} at ${LEGAL.url} (the "Service"), operated by ${LEGAL.operator} (“we”). By creating an account you agree to them.`}
    >
      <Section title="1. The Service">
        <p>
          {LEGAL.brand} stores, organises, compares and exports video-game settings you enter or
          import, and — through the optional companion program you run on your own computer — reads
          and writes the configuration files of games you own. We do not modify games, do not
          interact with game servers, and are not affiliated with any game publisher.
        </p>
      </Section>

      <Section title="2. Accounts">
        <p>
          You need an account to use the Service. Keep your password and companion tokens secret;
          you are responsible for activity under your account. You must be at least 16 years old.
          One person, one account.
        </p>
      </Section>

      <Section title="3. Free and Pro">
        <p>
          The Free plan is free for as long as we run the Service, within the limits shown on the{" "}
          <Link href="/pricing" className="underline underline-offset-4">
            pricing page
          </Link>
          . Pro removes those limits and adds the features listed there, for {PRICES.monthly} or{" "}
          {PRICES.lifetime}. Prices include VAT where applicable and are shown before you pay.
        </p>
        <p>
          Purchases are processed by {LEGAL.merchant} (“Paddle”), our merchant of record. Paddle is
          the seller of record, issues the invoice, and its{" "}
          <a
            href="https://www.paddle.com/legal/checkout-buyer-terms"
            className="underline underline-offset-4"
            rel="noopener noreferrer"
            target="_blank"
          >
            buyer terms
          </a>{" "}
          apply to the transaction. A monthly subscription renews automatically until you cancel;
          cancel any time from Settings → Plan and Pro stays active until the end of the paid
          period. The lifetime licence is a one-time payment for Pro on the hosted Service for as
          long as it exists. Refunds are described in our{" "}
          <Link href="/refunds" className="underline underline-offset-4">
            refund policy
          </Link>
          .
        </p>
      </Section>

      <Section title="4. Your content">
        <p>
          Settings, presets, notes, images and profile text you store remain yours. You grant us
          only the licence needed to host and display them to you and, when you choose to make a
          profile or preset public, to visitors of your public page. You can export everything at
          any time and delete your account from Settings; deletion removes your data from our
          database within 30 days (backups expire on their own schedule).
        </p>
        <p>
          Don’t store or publish content you have no right to share, anything unlawful, or anything
          designed to harm other users or the Service (including attempts to cheat in games —{" "}
          {LEGAL.brand} only handles ordinary settings files).
        </p>
      </Section>

      <Section title="5. The companion program">
        <p>
          The companion (“csync”) runs on your machine under your control. It reads and writes game
          configuration files only when you tell it to, or continuously if you enable auto-switch,
          and it backs files up before writing. You are responsible for what it does on your
          computer; check a game’s rules before automating its files.
        </p>
      </Section>

      <Section title="6. Availability and changes">
        <p>
          We aim to keep the Service running but do not guarantee uninterrupted availability. We may
          change or discontinue features; if we ever discontinue the hosted Service we will give at
          least 60 days’ notice and export remains available until then.
        </p>
      </Section>

      <Section title="7. Termination">
        <p>
          You can stop using the Service and delete your account at any time. We may suspend or
          close accounts that break these terms, abuse the Service or create risk for other users,
          with notice where practical.
        </p>
      </Section>

      <Section title="8. Disclaimer and liability">
        <p>
          The Service is provided “as is”. To the extent permitted by law we exclude implied
          warranties and are not liable for indirect losses, lost data you did not export, or for
          effects of configuration files written to your games. Our total liability for any claim is
          limited to the amount you paid us in the 12 months before the claim. Nothing here limits
          rights you have as a consumer under the law of your country.
        </p>
      </Section>

      <Section title="9. Law and contact">
        <p>
          These terms are governed by the law of {LEGAL.country}; consumers keep the protection of
          the mandatory rules of their country of residence. Questions:{" "}
          <a href={`mailto:${LEGAL.email}`} className="underline underline-offset-4">
            {LEGAL.email}
          </a>
          . We may update these terms; material changes are announced in the app at least 14 days
          before they apply.
        </p>
      </Section>
    </LegalPage>
  );
}
