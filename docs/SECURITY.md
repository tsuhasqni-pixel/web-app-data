# Data Shaper Security Notes

Updated: 2026-11-12

## Local First

Uploaded CSV / TSV / XLSX business data is parsed and transformed in the browser. Source files are not intentionally uploaded to the Worker for shaping / aggregation / accounting calculations.

Server-side data is limited to identity, billing linkage, entitlement, webhook processing evidence and legal acceptance evidence.

## File defenses

- input file limit: 15 MB
- maximum workbook sheets: 20
- maximum expanded rows: 100,000
- maximum expanded cells: 2,000,000
- Recipe input: 1 MB, maximum 500 mapped columns, 1,000 statement accounts, 200 tax rules
- statement templates: maximum 1,000 accounts
- CSV / TSV exports neutralize spreadsheet-formula injection while preserving normal numeric negatives
- PDF report HTML escapes title, note and every cell
- ZIP output sanitizes sheet-derived filenames

## Browser defenses

Static responses set:
- Content-Security-Policy
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy
- Permissions-Policy

## OAuth

Google OAuth uses:
- exact pinned client ID
- exact configured callback origin
- state
- nonce
- PKCE S256
- signed HttpOnly flow/session cookies

## Billing

- TEST / LIVE secrets and prices are separate.
- LIVE requires HTTPS canonical APP_ORIGIN.
- LIVE prices are re-read from Stripe and validated before Checkout.
- explicit legal consent is required in UI and API.
- Stripe webhook HMAC, livemode and event ID are verified.
- webhook event IDs are persisted for idempotency.
- paid role derives from Stripe entitlement, never Google login alone.

## Accounting / tax helper

Tax and depreciation functions are calculation aids only. They do not infer the correct tax treatment, statutory useful life or filing outcome. Unknown / ambiguous cases stay unresolved rather than silently guessed.

## Release safety

`DATA_SHAPER_LIVE_BILLING_ENABLED`, tax-display confirmation, refund-policy confirmation and final sale approval remain separate fail-closed switches.
