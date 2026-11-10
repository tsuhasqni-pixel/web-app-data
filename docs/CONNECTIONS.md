# Non-mail connection handoff

This document covers the connections ChatGPT can prepare without changing the shared Auth Mail Gateway or the completed Google-verified data-science product.

## 1. Cloudflare deployment

Target Worker/project: `web-app-data`.

The Worker exposes:

- `GET /api/integration-status`
- `GET /api/domain-readiness`
- `GET /api/legal/disclosure`

Static application traffic continues through the `ASSETS` binding.

Cloudflare Preview build for the connection branch has succeeded. A public Preview URL is not enabled, so browser E2E still remains a separate gate.

Production deployment remains gated. Do not merge/deploy based on project-name inference; verify the intended Cloudflare account first.

## 2. Custom-domain cutover

The repository is ready to accept a domain later without hard-coding the final hostname.

Before the domain exists, keep:

```text
ENFORCE_CANONICAL_ORIGIN=false
```

Once Cloudflare DNS/custom-domain mapping is ready, configure:

```text
APP_ORIGIN=https://data.YOUR_DOMAIN
ENFORCE_CANONICAL_ORIGIN=false
```

Verify:

```text
GET https://data.YOUR_DOMAIN/api/domain-readiness
```

Expected:

- `configured=true`
- `custom_domain=true`
- `ready_for_cutover=true`

Only after HTTPS and browser E2E pass, set:

```text
ENFORCE_CANONICAL_ORIGIN=true
```

Then GET/HEAD page traffic received through an old non-canonical hostname redirects to the configured custom origin. API routes are not redirected.

Cloudflare `.pages.dev` and `.workers.dev` hostnames intentionally do not count as final custom-domain readiness.

## 3. Stripe TEST connection

Data Shaper is intentionally not connected to any existing DemandScope/NamiData Product or Price.

Expected variables/secrets:

```text
DATA_SHAPER_BILLING_ENABLED=false
STRIPE_TEST_SECRET_KEY=<Data Shaper TEST restricted/secret key>
DATA_SHAPER_STRIPE_TEST_PRICE_ID=<Data Shaper-specific TEST price>
DATA_SHAPER_STRIPE_WEBHOOK_SECRET=<Data Shaper-specific TEST webhook signing secret>
```

`/api/integration-status` reports booleans only; it never returns secret values.

Creating the Product/Price is intentionally separate because price/tax settings must be explicitly decided first. No live billing flag exists in this branch.

## 4. Shared legal/disclosure connection

Configure:

```text
LEGAL_DISCLOSURE_URL=https://namidata-lab-public.lingering-salad-74bc.workers.dev/legal/disclosure-request
```

The UI links to `/api/legal/disclosure`, so the destination stays server-configurable and can be changed without exposing secrets.

## Domain-day checklist

1. Add the chosen Data Shaper hostname in Cloudflare.
2. Wait for HTTPS certificate/route to become healthy.
3. Set `APP_ORIGIN` to the exact HTTPS origin, with no path.
4. Keep `ENFORCE_CANONICAL_ORIGIN=false` for the first smoke test.
5. Check `/api/domain-readiness`.
6. Open the app through the custom hostname and verify CSV/XLSX local processing still works.
7. Check `/api/integration-status`.
8. Enable canonical redirects only after the custom-host smoke test passes.

## Excluded from this work

- Auth Mail Gateway repository and email delivery configuration
- NamiData / the completed Google-verified data-science service
- live Stripe activation
- customer-data upload

These remain separate safety gates.
