# Billing (Paddle)

ConfigSync sells Pro through [Paddle Billing](https://www.paddle.com/billing) as merchant of
record: Paddle is the seller, handles VAT and invoices, and tells the server who paid via
webhooks. Leave every `PADDLE_*` variable unset to run without billing — every account is Pro.

## One-time setup (owner)

1. Paddle → Catalog: one product "ConfigSync Pro" with two prices — **Monthly** (recurring,
   1 month) and **Lifetime** (one-time). Copy both price ids (`pri_…`).
2. Paddle → Developer tools → Authentication: create an **API key** and a **client-side token**.
3. Paddle → Developer tools → Notifications: add a destination
   `https://<your-domain>/api/billing/paddle`, type webhook, events: `transaction.completed`,
   `subscription.activated`, `subscription.updated`, `subscription.canceled`,
   `subscription.past_due`, `subscription.paused`, `subscription.resumed`. Copy the **secret
   key** (`pdl_ntfset_…`).
4. Set the environment:

| Variable                          | Value                                         |
| --------------------------------- | --------------------------------------------- |
| `PADDLE_API_KEY`                  | API key                                       |
| `PADDLE_WEBHOOK_SECRET`           | notification destination secret               |
| `PADDLE_PRICE_MONTHLY`            | `pri_…` of the monthly price                  |
| `PADDLE_PRICE_LIFETIME`           | `pri_…` of the lifetime price                 |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | client-side token                             |
| `NEXT_PUBLIC_PADDLE_ENV`          | `sandbox` while testing, `production` to sell |

Sandbox and live are separate Paddle accounts with separate keys and price ids.

## How a purchase becomes Pro

Checkout runs in Paddle's overlay with `customData.userId`. Paddle posts events to
`/api/billing/paddle`; the server verifies the `Paddle-Signature` HMAC, stores the event id
(retries are no-ops), maps the event to a `plans` row and answers 200. `getPlan()` reads that
row: lifetime ⇒ Pro forever; subscription `active`/`trialing`/`past_due` ⇒ Pro; `canceled` ⇒
Pro until the paid period ends. Nothing is deleted on downgrade.

## Granting Pro by hand

```sql
insert into plans (user_id, source) values ('<user id>', 'manual')
on conflict (user_id) do update set source = 'manual';
```

## Testing locally

Use the sandbox account. Paddle's dashboard can send simulated events to your webhook — or
sign one yourself: `printf '%s:%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SECRET"` and
send it as `Paddle-Signature: ts=$TS;h1=<hex>`.
