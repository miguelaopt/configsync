import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import { PRICES } from "@/lib/billing/public";
import { LegalPage, Section } from "@/components/marketing/legal";

export const metadata: Metadata = { title: "Refund Policy" };

/** Kept deliberately simple and at least as generous as EU consumer law and Paddle's own policy. */
export default function RefundsPage() {
  return (
    <LegalPage
      title="Refund Policy"
      intro={`Pro is sold through ${LEGAL.merchant}, our merchant of record. This page says when you get your money back and how to ask.`}
    >
      <Section title="14 days, no questions asked">
        <p>
          Within 14 days of any payment — the first month of a subscription ({PRICES.monthly}), a
          renewal, or the lifetime licence ({PRICES.lifetime}) — you can request a full refund for
          any reason. This covers your EU right of withdrawal and applies to everyone, everywhere.
        </p>
      </Section>

      <Section title="After 14 days">
        <p>
          Subscription payments are not refunded after 14 days, but you can cancel at any time from
          Settings → Plan and keep Pro until the end of the period you paid for. The lifetime
          licence is not refundable after 14 days. If the Service failed to work for you because of
          a fault on our side, write to us anyway — we would rather fix it or refund than argue.
        </p>
      </Section>

      <Section title="How to ask">
        <p>
          Email{" "}
          <a href={`mailto:${LEGAL.email}`} className="underline underline-offset-4">
            {LEGAL.email}
          </a>{" "}
          from the address on your account, or reply to the Paddle receipt. Refunds are issued by
          Paddle to the original payment method, usually within 5–10 business days depending on your
          bank. Pro is switched off when the refund is issued; your data stays in your account on
          the Free plan.
        </p>
      </Section>

      <Section title="Chargebacks">
        <p>
          Please ask us first — a refund is faster than a chargeback and avoids fees for everyone.
          Accounts that open a chargeback without contacting us may be closed once the dispute is
          settled.
        </p>
      </Section>

      <p className="text-xs text-ink-3">
        See also the{" "}
        <Link href="/terms" className="underline underline-offset-4">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline underline-offset-4">
          Privacy Policy
        </Link>
        .
      </p>
    </LegalPage>
  );
}
