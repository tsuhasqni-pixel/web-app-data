# Data Shaper Authentication and Billing

Updated: 2026-11-12

## Identity architecture

Google OIDC is the sole application identity provider.

Flow:
1. Google OIDC validates issuer, audience, nonce, state and PKCE.
2. Google stable `sub` is stored in oauth_identities.
3. An internal user ID is created / reused.
4. Stripe Customer is linked to that internal user.
5. Stripe Subscription state is stored as entitlement evidence.
6. Every paid access decision is based on Stripe entitlement, not Google email.

Email is contact / display data. It is not a paid-role key.

## Session rules

- signed HttpOnly cookie
- SameSite=Lax
- Secure on HTTPS
- bounded TTL
- logout clears the application session
- OAuth flow state has its own short-lived cookie

## Paid entitlement rules

Tier order: Free < Lite < Pro.

Active / trialing Data Shaper subscriptions may grant access only when:
- product_key belongs to Data Shaper
- price ID is the configured tier price
- status is active or trialing
- user / customer binding is valid

Other NamiData / DemandScope products are never accepted.

## Cross-device behavior

A user signs in with the same Google identity. The server resolves the internal user, linked Stripe Customer and current active Subscription. Email text alone is never sufficient to restore paid access.

## Failure mode

Authentication, billing configuration, product identity, price verification or database uncertainty fails closed.
