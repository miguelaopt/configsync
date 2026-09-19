# Before you announce ConfigSync

Everything here needs a human: a click in a dashboard, a look at a real page, or a decision
only you can make. `docs/launch.md` is the build-and-deploy procedure; this is the list you
tick **after** deploying and **before** telling anyone the product exists.

Work top to bottom. The blockers genuinely block.

---

## 0. Blockers — do not deploy this branch without them

- [ ] **Check the companion installer.** The app serves its own package, so there is nothing to
      publish. After deploying, run `npm i -g https://configsync.app/csync.tgz` on a machine that
      has never had it (see §1), then `csync --help`.
- [ ] **Rotate the Anthropic API key.** The key currently in the server's `.env` was shown in
      plain text in a chat session on 2026-09-19. console.anthropic.com → API keys → revoke it,
      create a new one with a monthly spend limit, then replace it on the server (commands below).
- [ ] **Read `/refunds` → "If we stop running the Service".** It promises 60 days' notice and a
      full refund for lifetime licences bought in the preceding 12 months. Those numbers were
      written for you, not by you. Change them in
      `app/(marketing)/refunds/page.tsx` if they are not what you want to be held to.

Replacing the key on the server:

```bash
ssh miguel@49.13.123.75
cd ~/configsync && TERM=xterm nano .env     # replace the AI_VISION_API_KEY= value
docker compose --profile app --profile proxy up -d
```

---

## 1. The companion installer

The companion is not on npm and does not need to be: it has no dependencies, so the app packs
it at build time and serves the tarball. Users run one command, against your own domain.

```bash
curl -fsSL https://configsync.app/csync.tgz -o csync.tgz
npm i -g ./csync.tgz
csync --help
```

(npm 12 sets `allow-remote = "none"`, so it will not install straight from a URL. The download
step is not optional, and the snippet in the app already shows it that way.)

- [ ] `https://configsync.app/csync.tgz` downloads a file (about 11 kB).
- [ ] A clean install works and `csync --help` prints the command list.
- [ ] The snippet in Settings → Companion shows the same URL as the deployment it is served from.

If you ever do want it on npmjs.com, that needs 2FA. A physical key is not the only option —
a passkey on your phone (Chrome's "Use a phone or tablet" → QR → fingerprint) or one stored in
a password manager both work, as does a Classic **Automation** access token, which skips the
2FA prompt on publish. Nothing depends on it.

## 2. Paddle

- [ ] **Domain approved.** Still rejected twice with the generic "offline/login wall" email.
      Reply to that email asking for a human review, pointing at `https://configsync.app` —
      it is now a real public page, and `/pricing`, `/terms`, `/privacy`, `/refunds` all load
      without an account.
- [ ] **Webhook events.** Developer tools → Notifications → the `configsync.app` destination →
      it must include `transaction.completed`, `subscription.activated`, `subscription.updated`,
      `subscription.canceled`, `subscription.past_due`, `subscription.paused`,
      `subscription.resumed`, **`adjustment.created`** and **`adjustment.updated`**.
      The last two are what revoke Pro on a refund or chargeback.
- [ ] **Prices match the site.** Paddle's Monthly is 2.99 EUR recurring and Lifetime is
      24.99 EUR one-time, both tax-inclusive. `/pricing` says the same, from
      `lib/billing/public.ts`.
- [ ] **One real purchase, end to end.** Private window → new account → `/pricing` → Monthly →
      pay with your own card. Then:
  - Header shows **Pro**, Settings → Plan shows the subscription.
  - `docker compose logs app | grep csync:billing` has no warnings.
- [ ] **One real refund.** Paddle → that transaction → Refund (full). Within seconds the account
      drops to Free. **If it does not, the two `adjustment.*` events are not really subscribed.**
- [ ] Repeat once for Lifetime if you want to see the `lifetime` source, and refund that too.
- [ ] Delete the test account afterwards.

---

## 3. Look at the site as a stranger

Private window, signed out. Every one of these is a click, not a command.

- [ ] `/` loads, the hero animation runs, nothing is a placeholder.
- [ ] `/pricing`, `/terms`, `/privacy`, `/refunds` load without an account, and the footer links
      on each one work.
- [ ] The header CTA and every "Create a free account" land on `/sign-up`.
- [ ] **Favicon** shows in the tab (hard-refresh once; browsers cache the old blank one).
- [ ] **Link preview.** Paste `https://configsync.app` into a Discord DM to yourself and into
      X's compose box. You should see the purple card with the mark and "Your game settings.
      Everywhere." If it is a grey box, the OG image did not build — check
      `https://configsync.app/opengraph-image` returns a PNG.
- [ ] `https://configsync.app/robots.txt` and `/sitemap.xml` both return content, and the sitemap
      lists your real domain, not `localhost`.
- [ ] Sign up with a throwaway address. The app opens on the new dashboard, empty state and all.
- [ ] **Password reset.** Forgot password → the email arrives **in the inbox**. Spam counts as a
      failure: check Resend → the domain is Verified and DKIM is green.
- [ ] Add CS2 from the catalog, create a preset, edit a setting, restore a snapshot.
- [ ] **Screenshot importer** (Pro): upload a real CS2 Video-settings screenshot on a preset.
      This has never run against a real model — if the values come back wrong, that is a bug to
      fix, not a launch blocker, but you want to know before a customer does.
- [ ] Delete the throwaway account and confirm it is gone.

---

## 4. Your own public profile

The landing sells sharing and `/p/miguel` currently 404s.

- [ ] Settings → Profile: set the **Username** you want in the URL, turn **Public profile** on.
- [ ] Open each preset you want visible → set its visibility to **public**. A public profile with
      no public presets shows "No public presets yet".
- [ ] Visit `https://configsync.app/p/<your username>` signed out. It should show your games,
      your links, and let a visitor copy a preset.
- [ ] Check that nothing private leaked: notes are never shown, and only the presets you marked
      are there.

---

## 5. The maintenance page

Worth proving once, because you only find out otherwise during a real outage.

```bash
ssh miguel@49.13.123.75
cd ~/configsync
docker compose stop app
curl -s https://configsync.app/ | grep -o "Back shortly"   # prints: Back shortly
docker compose --profile app --profile proxy up -d
```

- [ ] The maintenance page appeared while the app was down, and the site came back after.

---

## 6. Backups: get a copy off the server

Right now the nightly dump lives in `~/backups` **on the same machine as the database**. If that
server dies, the backups die with it. Pick one of these.

### A. Pull to your own PC (simplest, do this today)

One command, run from your PC:

```bash
mkdir -p ~/Backups/configsync
rsync -av --delete miguel@49.13.123.75:~/backups/ ~/Backups/configsync/
```

Make it weekly so you never think about it again:

```bash
( crontab -l 2>/dev/null
  echo '0 20 * * 0 rsync -aq --delete miguel@49.13.123.75:~/backups/ ~/Backups/configsync/'
) | crontab -
```

- [ ] Ran it once by hand; `ls -lh ~/Backups/configsync` shows today's `gsv-YYYY-MM-DD.sql.gz`.
- [ ] Added the cron line.
- [ ] Your PC is off sometimes — that is fine, rsync catches up on the next Sunday it is on.

### B. Also push to a second provider (survives your PC dying too)

A Hetzner Storage Box is about 4 €/month for 1 TB; Backblaze B2 is pay-per-GB and free under
10 GB, which a database this size will be for a long time.

```bash
ssh miguel@49.13.123.75
sudo apt install -y rclone
rclone config          # choose "b2" or "sftp" for a Storage Box; name the remote "offsite"
rclone copy ~/backups offsite:configsync-backups --max-age 30d
```

Then add it to the nightly cron on the server so a dump is copied right after it is made:

```bash
crontab -e
# change the existing 04:00 line to end with:
#   && rclone copy ~/backups offsite:configsync-backups --max-age 2d
```

- [ ] `rclone ls offsite:configsync-backups` lists the dump.

### Check the dumps are not empty

A backup nobody looks at is a backup that is silently zero bytes.

```bash
ssh miguel@49.13.123.75 'ls -lh ~/backups | tail -5'
```

- [ ] The files are hundreds of KB or more and grow over time, not a few bytes.

---

## 7. Restore drill

**Do this once, now, while nothing is wrong.** The version below restores into a _scratch_
database and never touches the live one — unlike the destructive variant, it is safe to run on
the production server with real users on it.

```bash
ssh miguel@49.13.123.75
cd ~/configsync
BACKUP=~/backups/$(ls ~/backups | tail -1)     # the newest dump
echo "restoring $BACKUP"

# 1. a throwaway database next to the live one
docker compose exec -T db psql -U gsv -d postgres -c 'drop database if exists gsv_drill;'
docker compose exec -T db psql -U gsv -d postgres -c 'create database gsv_drill;'

# 2. load the dump into it
gunzip -c "$BACKUP" | docker compose exec -T db psql -q -U gsv gsv_drill

# 3. prove the data is really there
docker compose exec -T db psql -U gsv -d gsv_drill -c \
  'select (select count(*) from users) as users,
          (select count(*) from games) as games,
          (select count(*) from presets) as presets,
          (select count(*) from settings) as settings;'

# 4. compare against the live database — the numbers should be close
docker compose exec -T db psql -U gsv -d gsv -c \
  'select (select count(*) from users) as users,
          (select count(*) from games) as games,
          (select count(*) from presets) as presets,
          (select count(*) from settings) as settings;'

# 5. clean up
docker compose exec -T db psql -U gsv -d postgres -c 'drop database gsv_drill;'
```

- [ ] The counts from the dump match the live database (allowing for anything added since the
      dump was taken).
- [ ] You wrote down how long the whole thing took. That number is your recovery time.

**If you ever need the real thing** — the live database is gone or corrupt, and you are replacing
it on purpose:

```bash
cd ~/configsync
docker compose stop app                                   # stop writes first
docker compose exec -T db psql -U gsv -d postgres -c 'drop database gsv; create database gsv;'
gunzip -c ~/backups/gsv-<date>.sql.gz | docker compose exec -T db psql -q -U gsv gsv
docker compose --profile app --profile proxy up -d
```

---

## 8. Keep watch after launch

- [ ] Uptime monitor is green and alerts reach your phone (you have UptimeRobot on
      `https://configsync.app/pricing`).
- [ ] First week: `docker compose logs app | grep -E "csync:(billing|ai|companion)"` every day
      or two.
- [ ] Watch the `ai_requests` table and the Anthropic dashboard. If the bill surprises you, lower
      `LIMITS.pro.aiScreenshots` in `lib/billing/limits.ts`.
- [ ] `df -h` monthly. Docker build cache grows; `docker system prune -f` after updates.

---

## What is already done

Domain and DNS · HTTPS with `www` and `http` redirects · production deploy on Hetzner ·
Resend SMTP · legal pages with your NIF and address · nightly backup cron on the server ·
`/` is a real public landing page · refund handling in the webhook code · uptime monitor.
