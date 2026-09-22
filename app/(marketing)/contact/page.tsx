import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Section } from "@/components/marketing/legal";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Contact — ConfigSync support, billing and privacy",
  description: `Get in touch with ConfigSync: support for the app and the csync companion, billing and invoice questions, refund requests, privacy requests and security reports. Write to ${LEGAL.email}.`,
  alternates: { canonical: "/contact" },
};

const Mail = () => (
  <a href={`mailto:${LEGAL.email}`} className="text-accent-text hover:text-ink">
    {LEGAL.email}
  </a>
);

/** One address answers everything; this page says what to expect from each kind of message. */
export default function ContactPage() {
  return (
    <LegalPage
      title="Contact"
      updated={null}
      intro={`One address, read by a person: ${LEGAL.email}. ConfigSync is run by one person, so replies are not instant — but every message is read, and nothing here is handled by a bot.`}
      footer={
        <footer className="panel flex flex-col gap-1 p-5 text-[13px] text-ink-3">
          {/* The one place on the site that carries these: EU e-commerce rules want a name and a
              geographic address reachable from any page, not repeated on every one of them. */}
          <span className="font-medium text-ink">Who runs {LEGAL.brand}</span>
          <span>{LEGAL.operator}</span>
          <span>{LEGAL.address}</span>
          <a href={`mailto:${LEGAL.email}`} className="w-fit text-accent-text hover:text-ink">
            {LEGAL.email}
          </a>
          <span className="mt-2">
            {LEGAL.merchant} is the merchant of record for purchases and issues the invoice, which
            carries its own VAT details.
          </span>
        </footer>
      }
    >
      <Section title="Support">
        <p>
          Something in the app or the <code className="font-mono text-[14px]">csync</code> companion
          not behaving? Write to <Mail /> and say which game, which preset, and what you expected to
          happen. If the companion is involved, paste what it printed — it never includes the
          contents of your config files, only file names and what changed.
        </p>
        <p>
          Before writing about the companion, the{" "}
          <Link href="/docs/companion" className="text-accent-text hover:text-ink">
            companion guide
          </Link>{" "}
          covers installing, connecting and the commands.
        </p>
      </Section>

      <Section title="Billing, invoices and refunds">
        <p>
          {LEGAL.merchant} is the merchant of record for every purchase: it takes the payment,
          handles VAT and issues the invoice. Your invoice arrives from Paddle, not from us, and
          card details never reach ConfigSync.
        </p>
        <p>
          Refunds are handled here. Within 14 days of any payment you can ask for a full refund, no
          reason needed — write to <Mail />. The{" "}
          <Link href="/refunds" className="text-accent-text hover:text-ink">
            refund policy
          </Link>{" "}
          has the details.
        </p>
      </Section>

      <Section title="Privacy and your data">
        <p>
          To ask what is stored about you, to correct it, or to have the account and everything in
          it deleted, write to <Mail />. You can also export your whole library yourself at any
          time, on any plan, and delete the account from Settings without asking anyone — see{" "}
          <Link href="/docs/import-export" className="text-accent-text hover:text-ink">
            what an export contains
          </Link>{" "}
          and the{" "}
          <Link href="/privacy" className="text-accent-text hover:text-ink">
            privacy policy
          </Link>
          .
        </p>
      </Section>

      <Section title="Security">
        <p>
          Found a vulnerability? Write to <Mail /> with &ldquo;security&rdquo; in the subject and
          enough detail to reproduce it. Please give us a chance to fix it before telling anyone
          else. We will not take legal action over a report made in good faith.
        </p>
      </Section>

      <Section title="A game you want supported">
        <p>
          Storing and comparing settings works for any game today — you decide what the rows are.
          Reading and writing a game&rsquo;s own config files needs that game in the catalog, and{" "}
          <Link href="/for" className="text-accent-text hover:text-ink">
            the catalog
          </Link>{" "}
          is short on purpose: each game is mapped by hand and tested. Tell us which game, which
          launcher, and where its settings live, and it goes on the list. No promised dates.
        </p>
      </Section>
    </LegalPage>
  );
}
