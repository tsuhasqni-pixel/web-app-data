# Authentication, billing, and disclosure plan

## End-user authentication

Data Shaper will not use GitHub OAuth as an end-user login method.

The intended model is:

1. Stripe owns payment/customer/subscription identity.
2. Data Shaper verifies its own Stripe entitlement server-side.
3. Cross-device or cookie-recovery login reuses the shared Auth Mail Gateway for email-possession verification.
4. Data Shaper re-checks Stripe after the Gateway assertion before issuing a Data Shaper-specific HttpOnly session/cookie.

The shared Gateway must never receive Data Shaper Stripe secrets.

## Shared Auth Mail Gateway

Repository: `shihuiarenjinba-png/Auth-Mail-Gateway`.

Gateway responsibilities:
- send one-time Magic Link email from the shared `noreply@` sender
- verify email possession
- issue a short-lived one-time assertion
- HMAC authenticate app-to-gateway requests
- replay/rate-limit protection

Data Shaper responsibilities:
- verify Data Shaper Product/Price/subscription before requesting email
- keep `AUTH_MAIL_APP_SECRET` server-side only
- validate callback state
- consume the assertion
- verify Stripe again
- issue its own session/cookie

Current status: HOLD until the Data Shaper backend, Stripe Test product/price, callback endpoint, and Gateway sender-domain E2E exist.

## Stripe separation

Data Shaper must use product-specific Stripe metadata/price identifiers. Do not reuse DemandScope or NamiData Product/Price IDs.

No live billing flag should be enabled before test-mode Checkout, webhook, portal, entitlement and cancellation E2E pass.

## Information disclosure

Business/operator disclosure should link to the shared legal/disclosure page already maintained for the data-science services. Product-specific price, renewal, cancellation, refund and service conditions remain on Data Shaper pages.

## Deployment authentication

End-user login and deployment authentication are different concerns. GitHub OAuth is not required for users.

For deployment, prefer a headless CI path when practical:

`GitHub Actions → npm test/build → Wrangler → Cloudflare`

Use a narrowly scoped Cloudflare API token in GitHub Secrets. Never expose it to browser code or commit it.
