# Data Shaper Google OAuth / OpenID Connect

## Boundary

Google is identity-only.

```text
Google sub
  ↓
Data Shaper internal user_id
  ↓
Stripe Customer
  ↓
Data Shaper-only Product / Price
  ↓
active/trialing Subscription
  ↓
Pro entitlement
```

Google email is display/contact identity data. It is never sufficient to grant Pro.

## Google Cloud

Use the existing Google Cloud project / Google Auth Platform already used for NamiData Lab.

Verified project ID from the signed-in Google Cloud console:

```text
web-513010
```

Verified Web application OAuth client and stable production origin:

Client name:

```text
Data Shaper Web
```

Client ID:

```text
175542619333-d84tqogb2kkhrc92caset5ilmgs2moa4.apps.googleusercontent.com
```

Production origin:

```text
https://web-app-data.data-analist.workers.dev
```

Authorized redirect URI:

```text
https://web-app-data.data-analist.workers.dev/api/auth/google/callback
```

Scopes:

```text
openid email profile
```

No Gmail / Drive / Calendar scope.

## Endpoints

- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `GET /api/auth/session`
- `GET /api/auth/status`
- `POST /api/auth/logout`

## Security

The authorization request uses:

- random `state`
- random `nonce`
- Authorization Code flow
- PKCE S256

The short-lived flow state is stored only in a signed HttpOnly/Secure/SameSite=Lax cookie.

The callback validates:

- state
- ID Token RSA signature against Google JWKS
- issuer
- audience
- expiration
- nonce
- verified email

Google access token / refresh token are not persisted. The ID Token is used for validation only and is not persisted.

The Data Shaper session cookie contains the internal `user_id`, not Google tokens and not Google `sub`.

## Identity storage

D1 binding name:

```text
DB
```

Apply:

1. `migrations/0001_core.sql`
2. `migrations/0002_google_identity.sql`

`oauth_identities` stores the Google `sub` → internal `user_id` mapping.

`stripe_customer_links` and `stripe_entitlements` reserve the future Stripe boundary. Only `product_key=data-shaper-pro` can grant Pro.

## Runtime settings

Cloudflare variables/secrets:

```text
APP_ORIGIN=https://web-app-data.data-analist.workers.dev
# GOOGLE_OAUTH_CLIENT_ID is pinned in code; if set explicitly it must match:
# 175542619333-d84tqogb2kkhrc92caset5ilmgs2moa4.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=<Cloudflare Secret>
SESSION_SECRET=<Cloudflare Secret, 32+ chars>
DATA_SHAPER_BILLING_ENABLED=false
```

Do not commit secret values.

## Legal

- `/legal/privacy/`
- `/legal/terms/`
- common disclosure: https://namidata-lab-public.lingering-salad-74bc.workers.dev/legal/disclosure-request

## Current deployment gate

Google redirect URLs are now verified against the stable Cloudflare Workers production hostname.

Until the OAuth client secret, D1 binding/migrations, and stable callback URL are installed in Cloudflare, status is:

```text
HOLD_WAITING_GOOGLE_CLIENT_SECRET
```

or, if the stable host/D1 is still absent, the more specific infrastructure HOLD reported by `/api/auth/status`.
