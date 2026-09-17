import "server-only";
import nodemailer from "nodemailer";
import { env } from "@/lib/env";

type Mail = { to: string; subject: string; text: string };

/**
 * Sends transactional email through SMTP_URL when configured.
 * Without SMTP the message is logged so self-hosters can still complete flows locally.
 */
export async function sendEmail(mail: Mail) {
  if (!env.SMTP_URL) {
    console.log(`[csync:email] SMTP_URL not set — would send to ${mail.to}\n${mail.text}`);
    return;
  }
  try {
    const transport = nodemailer.createTransport(env.SMTP_URL);
    await transport.sendMail({ from: env.EMAIL_FROM, ...mail });
  } catch (error) {
    console.error("[csync:email] failed to send", error instanceof Error ? error.message : error);
  }
}
