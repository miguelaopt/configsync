/**
 * Transactional email copy — edit here, not in lib/auth.
 * Every template returns subject + plain text + HTML; both bodies must say the same thing.
 * HTML is deliberately simple (tables, inline styles) so it renders the same in Gmail,
 * Outlook and Apple Mail. Light background on purpose: dark emails render badly in many clients.
 */
import { LEGAL } from "@/lib/legal";

const ACCENT = "#b27a12"; // light-theme accent from globals.css
const INK = "#151a21";
const INK_2 = "#5b6674";

/** Shared frame: wordmark, content, footer with the contact address. */
function frame(title: string, body: string) {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK}">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
    <table role="presentation" width="520" cellspacing="0" cellpadding="0" style="max-width:520px;width:100%;background:#ffffff;border:1px solid #dde1e7;border-radius:6px">
      <tr><td style="padding:20px 24px 0;font-weight:600;font-size:17px;letter-spacing:-0.01em">Config<span style="color:${ACCENT}">Sync</span></td></tr>
      <tr><td style="padding:20px 24px 8px;font-size:20px;font-weight:600">${title}</td></tr>
      <tr><td style="padding:0 24px 24px;font-size:14px;line-height:1.6;color:${INK}">${body}</td></tr>
      <tr><td style="padding:14px 24px;border-top:1px solid #dde1e7;font-size:12px;color:${INK_2}">
        ${LEGAL.brand} · <a href="${LEGAL.url}" style="color:${INK_2}">${LEGAL.url.replace("https://", "")}</a> · <a href="mailto:${LEGAL.email}" style="color:${INK_2}">${LEGAL.email}</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function button(href: string, label: string) {
  return `<p style="margin:20px 0"><a href="${href}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 18px;border-radius:4px">${label}</a></p>`;
}

export function resetPasswordEmail({ url, name }: { url: string; name?: string | null }) {
  const hi = name ? `Hi ${name},` : "Hi,";
  return {
    subject: `Reset your ${LEGAL.brand} password`,
    text: `${hi}

Someone asked to reset the password for your ${LEGAL.brand} account.

Reset it here (the link works for 1 hour):
${url}

If this wasn't you, ignore this email — your password stays as it is.

— ${LEGAL.brand} · ${LEGAL.email}`,
    html: frame(
      "Reset your password",
      `<p style="margin:0 0 8px">${hi}</p>
       <p style="margin:0">Someone asked to reset the password for your ${LEGAL.brand} account. The link works for <strong>1 hour</strong>.</p>
       ${button(url, "Choose a new password")}
       <p style="margin:0;color:${INK_2};font-size:13px">If this wasn’t you, ignore this email — your password stays as it is.<br>Button not working? Paste this into your browser:<br><span style="word-break:break-all">${url}</span></p>`,
    ),
  };
}
