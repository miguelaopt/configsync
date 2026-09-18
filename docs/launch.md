# Launch guide — configsync.app

Step by step from "nothing is deployed" to "Pro is on sale". Tick the boxes in order; each
section ends with a check that proves it worked. Budget: an afternoon, plus Paddle's review
(1–3 business days).

What you need at hand: a card, your NIF and a postal address you are willing to publish (EU
e-commerce rules), a Hetzner account, a Paddle account, a GitHub account, and this repository
with PRs #5, #6 and the launch-prep PR merged.

Running costs: Hetzner ≈ 4 €/month · domain ≈ 13 €/year · email (Resend) free tier · Paddle
5 % + 0.50 € per sale · Anthropic ≈ 0.01 € per screenshot analysed.

---

## 1. Domain

- [ ] Register **configsync.app** at Cloudflare Registrar (at cost, no renewal surprises) or
      Porkbun. `.app` is HTTPS-only by design (HSTS preloaded) — Caddy handles that.
- [ ] Nameservers stay with the registrar (Cloudflare gives you its DNS for free).
- [ ] Do **not** create DNS records yet; you need the server IP first (§2).
- [ ] Email for the domain: Cloudflare → Email Routing → forward `hello@configsync.app` to your
      Gmail (free; it adds the MX records itself). This is the address on the legal pages.

Check: `dig NS configsync.app` shows the registrar's nameservers.

## 2. Server (Hetzner)

- [ ] console.hetzner.cloud → New project "configsync" → Add server:
  - Location **Falkenstein** (or Nuremberg) · Image **Ubuntu 24.04**
  - Type: shared vCPU x86, **2 vCPU / 4 GB** (CX line, ≈ 4 €/month)
  - SSH key: your public key (`cat ~/.ssh/id_ed25519.pub`)
  - Firewall (create one): inbound **22, 80, 443 TCP** and **443 UDP**; nothing else
  - Backups: optional (+20 %) — the `pg_dump` cron below is enough
- [ ] Note the IPv4 (and IPv6).
- [ ] DNS at the registrar: `A @ → <IPv4>`, `A www → <IPv4>` (and `AAAA` for IPv6 if you like).
      If Cloudflare: **DNS only** (grey cloud) so Let's Encrypt can reach Caddy directly.
- [ ] First login and hardening:

```bash
ssh root@<IP>
adduser miguel && usermod -aG sudo miguel
mkdir -p /home/miguel/.ssh && cp ~/.ssh/authorized_keys /home/miguel/.ssh/ && chown -R miguel:miguel /home/miguel/.ssh
apt update && apt upgrade -y && apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades      # answer Yes
curl -fsSL https://get.docker.com | sh && usermod -aG docker miguel
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config && systemctl restart ssh
exit
ssh miguel@<IP>       # from now on, never root
```

Check: `dig +short configsync.app` returns the IP; `docker ps` works as `miguel`.

## 3. Deploy

- [ ] Clone and configure:

```bash
git clone https://github.com/miguelaopt/configsync && cd configsync
cp .env.example .env && nano .env
```

Production `.env` (everything else stays empty for now):

| Variable                                  | Value                                                               |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `DATABASE_URL`                            | leave as is — compose overrides it for the `app` container          |
| `BETTER_AUTH_SECRET`                      | `openssl rand -base64 32` (new; never the local one)                |
| `BETTER_AUTH_URL`                         | `https://configsync.app`                                            |
| `NEXT_PUBLIC_APP_URL`                     | `https://configsync.app`                                            |
| `NEXT_PUBLIC_REPO_URL`                    | `https://github.com/miguelaopt/configsync`                          |
| `APP_DOMAIN`                              | `configsync.app`                                                    |
| `POSTGRES_PASSWORD`                       | `openssl rand -hex 16`                                              |
| `POSTGRES_PORT`                           | `127.0.0.1:5432` (Postgres reachable only from the server itself)   |
| `EMAIL_FROM`                              | `ConfigSync <noreply@configsync.app>`                               |
| `SMTP_URL`                                | filled in §5                                                        |
| `PADDLE_*`, `NEXT_PUBLIC_PADDLE_*`        | filled in §6 — **leave unset until then** (unset ⇒ everyone is Pro) |
| `AI_VISION_PROVIDER`, `AI_VISION_API_KEY` | optional, §7                                                        |

- [ ] Start everything (first build takes a few minutes):

```bash
docker compose --profile app --profile proxy up -d --build
docker compose logs -f app        # wait for "Ready", Ctrl-C
```

Migrations run at boot (`RUN_MIGRATIONS=true`). Caddy obtains the certificate on the first
request.

- [ ] Create your own account at `https://configsync.app/sign-up`. While `PADDLE_*` is unset it
      is Pro. Add CS2 from the catalog so the site has something to show.

Check:

```bash
curl -sI https://configsync.app/pricing | head -1          # HTTP/2 200
curl -sI https://www.configsync.app | grep -i location      # https://configsync.app/
curl -sI http://configsync.app | head -1                    # 308 to https
curl -s https://configsync.app/terms | grep -c "Terms of Service"
```

## 4. Legal pages and the public site

The three pages Paddle's reviewers open exist in the app and are linked from every footer:

| Page       | File                               | Says                                                                                                                                                                              |
| ---------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/terms`   | `app/(marketing)/terms/page.tsx`   | Service description, accounts (16+), Free/Pro and Paddle as merchant of record, your content, companion responsibility, availability, termination, liability cap, Portuguese law. |
| `/privacy` | `app/(marketing)/privacy/page.tsx` | GDPR notice: what is stored, legal bases, processors (Hetzner, Paddle, Anthropic, GitHub, email provider), EU storage, retention, rights, cookies (session only).                 |
| `/refunds` | `app/(marketing)/refunds/page.tsx` | 14 days no questions asked on every payment, cancel-anytime subscriptions, how to ask, chargebacks.                                                                               |

Business details are in **one file**, `lib/legal.ts`. Before launch:

- [ ] `address` — a postal address (a business-address service is fine). Required by EU rules.
- [ ] `taxId` — your NIF, or leave `""` to hide the line.
- [ ] `email` — `hello@configsync.app` once §1 forwarding works.
- [ ] `updated` — today's date after your edits.
- [ ] Read all three pages once on the live site. Every sentence should be true for how you
      actually run the service; edit the JSX freely. The privacy page has a `TODO` comment to
      name the email provider you pick in §5. Nothing here is legal advice — if you want a
      lawyer to look, these pages are the thing to send.
- [ ] `/` currently redirects to sign-in. Paddle needs a public page that explains what is sold:
      finish the landing page (yours) or, as a stopgap, make `/` redirect to `/pricing` for
      visitors. Pricing must show the same prices as Paddle (`lib/billing/public.ts`).

Check: from a private window, `/`, `/pricing`, `/terms`, `/privacy`, `/refunds` all load without
signing in and the footer links work.

## 5. Email (password reset)

- [ ] resend.com → free account → Domains → add `configsync.app` → add the DNS records it shows
      (TXT for SPF/DKIM, MX for bounces) at the registrar → wait for "Verified".
- [ ] API keys → create one (sending only).
- [ ] `.env`: `SMTP_URL=smtp://resend:<api key>@smtp.resend.com:587`
- [ ] `docker compose --profile app --profile proxy up -d`

Check: Forgot password → the email arrives (spam folder counts as a failure — check DKIM).
Any other SMTP provider works the same way (Postmark, Brevo, Mailgun); only `SMTP_URL` changes.

## 6. Paddle live

Sandbox and live are separate accounts with separate keys; keep the sandbox values in your
local `.env` for development.

- [ ] paddle.com → Sign up for a **live** account (not sandbox). Business verification asks for
      identity, business details and payout bank account; the website field is
      `https://configsync.app`. Approval takes 1–3 business days and is where the pages of §4
      matter.
- [ ] Catalog → Products → "ConfigSync Pro" (tax category: standard digital goods). Two prices:
  - **Monthly**: 2.99 EUR, recurring every 1 month, tax-inclusive
  - **Lifetime**: 24.99 EUR, one-time, tax-inclusive
    Copy both `pri_…` ids.
- [ ] Developer tools → Authentication → API key with only **Customer portal sessions: write**;
      and a **client-side token**.
- [ ] Developer tools → Notifications → destination `https://configsync.app/api/billing/paddle`,
      webhook, events `transaction.completed`, `subscription.activated`, `subscription.updated`,
      `subscription.canceled`, `subscription.past_due`, `subscription.paused`,
      `subscription.resumed`. Copy the secret (`pdl_ntfset_…`).
- [ ] Checkout → Checkout settings → default payment link `https://configsync.app/pricing`.
- [ ] `.env`:

```
PADDLE_API_KEY=…
PADDLE_WEBHOOK_SECRET=pdl_ntfset_…
PADDLE_PRICE_MONTHLY=pri_…
PADDLE_PRICE_LIFETIME=pri_…
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=live_…
NEXT_PUBLIC_PADDLE_ENV=production
```

- [ ] `docker compose --profile app --profile proxy up -d --build` (the `NEXT_PUBLIC_*` values
      are baked in at build time, hence `--build`).
- [ ] From now on every account is **Free** unless it paid. Give yourself Pro by hand
      (`docs/billing.md` → "Granting Pro by hand").

Check — one real purchase:

1. Private window, new account, `/pricing` → Monthly → pay with your own card.
2. Header shows **Pro**; Settings → Plan shows the subscription; Paddle → Transactions shows it;
   `docker compose logs app | grep csync:billing` shows no warnings.
3. Paddle → the transaction → Refund, and cancel the subscription immediately when asked.
   `subscription.canceled` arrives and the account stays Pro until the period end that Paddle
   reports (`resolvePlan`). Refunds themselves are **not** handled by the webhook yet, so to
   honour the refund policy today run
   `docker compose exec db psql -U gsv gsv -c "delete from plans where user_id = '<id>';"`
   after refunding (see §10 for the proper fix).
4. Repeat once for Lifetime if you want to see the `lifetime` source; refund and delete the row.

## 7. Optional switches

- [ ] **GitHub sign-in**: github.com → Settings → Developer settings → OAuth Apps → New:
      homepage `https://configsync.app`, callback `https://configsync.app/api/auth/callback/github`
      → `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` in `.env` → `up -d`. The button appears.
- [ ] **AI screenshot importer**: `AI_VISION_PROVIDER=anthropic`, `AI_VISION_API_KEY=sk-ant-…`
      (console.anthropic.com → API keys; set a monthly spend limit there, e.g. 20 €) → `up -d`.
      Update the privacy page only if you change providers.
- [ ] **Cloudflare proxy** (orange cloud) later, if you want DDoS shielding: SSL mode
      "Full (strict)"; Caddy keeps its own certificate. Not needed for launch.

## 8. Operate

- [ ] **Backups** — daily dump kept 14 days, plus a weekly copy off the server:

```bash
mkdir -p ~/backups
( crontab -l 2>/dev/null
  echo '0 4 * * * cd ~/configsync && docker compose exec -T db pg_dump -U gsv gsv | gzip > ~/backups/gsv-$(date +\%F).sql.gz && find ~/backups -mtime +14 -delete'
) | crontab -
```

Weekly, from your PC: `scp miguel@configsync.app:~/backups/gsv-$(date +%F).sql.gz ~/Backups/`
(or `rclone` to a Hetzner Storage Box / Backblaze B2).

- [ ] **Restore drill** (do it once, before you need it):

```bash
gunzip -c ~/backups/gsv-<date>.sql.gz | docker compose exec -T db psql -U gsv -d postgres -c 'drop database gsv; create database gsv;' && \
gunzip -c ~/backups/gsv-<date>.sql.gz | docker compose exec -T db psql -U gsv gsv
```

- [ ] **Updates**: `cd ~/configsync && git pull && docker compose --profile app --profile proxy up -d --build`.
      Migrations run at boot; a failed migration keeps the old container running — read
      `docker compose logs app`.
- [ ] **Monitoring**: uptimerobot.com (free) → HTTPS monitor on `https://configsync.app/pricing`,
      5-minute interval, alert to your email/phone.
- [ ] **Logs**: `docker compose logs -f app` · billing `[csync:billing]` · companion
      `[csync:companion]` · AI `[csync:ai]` · Caddy `docker compose logs caddy`.
- [ ] **Disk**: `df -h` monthly; Docker build cache grows — `docker system prune -f` after updates.
- [ ] **Secrets**: rotating `BETTER_AUTH_SECRET` signs everyone out; rotating Paddle keys needs
      the destination secret updated on both sides.

## 9. Launch checklist

1. [ ] §1 domain resolves to the server; `hello@configsync.app` forwards.
2. [ ] §3 site up on HTTPS, `www` redirects, `http` redirects.
3. [ ] §4 `lib/legal.ts` filled; three pages reviewed; `/` explains the product.
4. [ ] §5 password reset email arrives in the inbox.
5. [ ] §6 Paddle live approved; one real purchase + refund verified for Monthly.
6. [ ] §8 backup cron running (`ls ~/backups` tomorrow); restore drill done; uptime monitor green.
7. [ ] Your own account is Pro (manual grant); demo data looks good on your public profile.
8. [ ] Merge order honoured: #5 → #6 → launch-prep, each without `--delete-branch` while the next
       is open, or retarget first.
9. [ ] Announce.

## 10. After launch

- **First code follow-up:** handle Paddle refunds in `lib/billing/paddle.ts` — subscribe to
  `adjustment.created` (action `refund`/`chargeback`) and downgrade the `plans` row, so the
  refund policy's "Pro is switched off when the refund is issued" needs no manual SQL.
- Watch `ai_requests` and the Paddle dashboard for the first weeks; adjust
  `LIMITS.pro.aiScreenshots` if the AI bill surprises you.
- Roadmap: desktop tray app around `csync watch`; more catalog games (`docs/catalog.md`);
  offline OCR provider for self-hosters.
- Move DNS to Cloudflare proxy if traffic or abuse ever warrants it.
- When the domain changes or you add one: `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`,
  `APP_DOMAIN`, Paddle destination URL and default payment link, Resend domain, GitHub callback,
  `lib/legal.ts` → `url`.
