import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";
import { LegalPage, Section } from "@/components/marketing/legal";

export const metadata: Metadata = { title: "Privacy Policy" };

/**
 * Keep the processors list equal to what is actually configured in
 * production (SMTP provider, GitHub OAuth, AI provider) and fill LEGAL.address.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`${LEGAL.operator} operates ${LEGAL.brand} and is the data controller for the personal data described here. This policy explains what we store, why, for how long, and your rights under the GDPR.`}
    >
      <Section title="1. What we store">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-ink">Account:</strong> email address, display name, a hashed
            password (or the id and email your GitHub account provides if you sign in with GitHub),
            and the username, bio, links and avatar you choose for your profile.
          </li>
          <li>
            <strong className="text-ink">Your vault:</strong> games, presets, categories, settings,
            notes, revision history, uploaded cover images and the device names, game lists and
            per-PC choices the companion program sends.
          </li>
          <li>
            <strong className="text-ink">Sessions and security:</strong> session tokens with the IP
            address and browser user agent they were created from; hashed companion tokens.
          </li>
          <li>
            <strong className="text-ink">Billing:</strong> your Paddle customer and subscription
            identifiers and plan status. Card details never reach us — Paddle collects them.
          </li>
          <li>
            <strong className="text-ink">Screenshot importer (Pro, optional):</strong> when you
            upload a screenshot for analysis it is sent to our AI provider once and discarded; we
            keep only a usage record (model name, token counts, time) for the daily limit.
          </li>
          <li>
            <strong className="text-ink">Server logs:</strong> standard request logs (IP, path,
            time, status) kept for up to 30 days for security and debugging.
          </li>
        </ul>
        <p>No analytics, no advertising trackers, no third-party cookies.</p>
      </Section>

      <Section title="2. Why (legal bases)">
        <p>
          To provide the Service you signed up for (contract): accounts, vault, companion, billing
          status. To keep the Service secure and to meet tax and accounting duties (legal obligation
          and legitimate interest): sessions, logs, payment records held by Paddle. To run optional
          features you turn on (contract, or consent where you upload a screenshot).
        </p>
      </Section>

      <Section title="3. Who else sees data (processors)">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-ink">{LEGAL.host}</strong> — hosting of the application and
            database.
          </li>
          <li>
            <strong className="text-ink">{LEGAL.merchant}</strong> — payments, invoices and VAT, as
            merchant of record. Paddle is an independent controller for the purchase itself; see its
            privacy policy.
          </li>
          <li>
            <strong className="text-ink">Anthropic, PBC</strong> — analysis of screenshots you
            upload to the Pro screenshot importer. Images are processed to answer the request and
            not used to train models under our API agreement.
          </li>
          <li>
            <strong className="text-ink">GitHub, Inc.</strong> — only if you choose “Continue with
            GitHub”.
          </li>
          <li>
            <strong className="text-ink">Resend (Plus Five Five, Inc.)</strong> — delivery of
            account emails such as password resets (recipient address and the message only).
          </li>
          <li>
            <strong className="text-ink">Cloudflare, Inc.</strong> — DNS for the domain, and email
            routing for the contact address, which forwards messages you send us to our mailbox.
          </li>
        </ul>
        <p>
          We do not sell personal data. Public profiles and presets you explicitly make public are
          visible to anyone with the link; notes are never shown publicly.
        </p>
      </Section>

      <Section title="4. Where">
        <p>
          Data is stored in the European Union. Paddle and Anthropic may process data outside the EU
          under the EU Standard Contractual Clauses.
        </p>
      </Section>

      <Section title="5. How long">
        <p>
          Account and vault data: until you delete your account (Settings → Delete account), then
          removed from the live database immediately and from backups within 30 days. Sessions:
          until they expire or you sign out. Server logs: 30 days. Billing records: as long as tax
          law requires (held by Paddle).
        </p>
      </Section>

      <Section title="6. Your rights">
        <p>
          You can access, correct and export your data yourself in the app (Settings and Export).
          You can delete your account at any time. For anything else — restriction, objection,
          portability in another format, or a question — email{" "}
          <a href={`mailto:${LEGAL.email}`} className="underline underline-offset-4">
            {LEGAL.email}
          </a>
          ; we answer within 30 days. You can also complain to your national data-protection
          authority (in Portugal, the CNPD).
        </p>
      </Section>

      <Section title="7. Cookies">
        <p>
          We set strictly necessary session cookies (prefix <code>csync</code>) to keep you signed
          in. Your theme and density preferences live in your browser’s local storage. Nothing else,
          so no cookie banner is needed.
        </p>
      </Section>

      <Section title="8. Contact and complaints">
        <p>
          {LEGAL.operator} is the controller for the data described here. Write to{" "}
          <a href={`mailto:${LEGAL.email}`} className="text-accent-text hover:text-ink">
            {LEGAL.email}
          </a>{" "}
          for any request under this policy, including access, correction, export and deletion. We
          answer within 30 days; there is no charge.
        </p>
        <p>
          If you are not happy with the answer you can complain to your national data protection
          authority. In Portugal that is the Comissão Nacional de Proteção de Dados (CNPD); if you
          live elsewhere in the EU or the UK, your own authority can take the complaint.
        </p>
      </Section>

      <Section title="9. Changes">
        <p>
          We will announce material changes in the app before they take effect and update the date
          at the top of this page.
        </p>
      </Section>
    </LegalPage>
  );
}
