# Data Shaper — Inventory Data Normalizer

Local-first data preparation workbench for company CSV/XLSX data.

Status: **pre-sale validation / not production-ready**. No customer data is uploaded to a server. Review every inferred mapping and destructive transformation before export.

## Six-stage workflow
Inspect → Detect → Map → Confirm → Transform → Validate.

## Repository policy
- Main is protected by workflow convention: changes via `codex/*` draft pull requests.
- No automatic production deployment, payment activation or customer-data ingestion.
- Cloudflare account and project bindings are **not configured** until separately verified.
- Do not commit secrets or actual client spreadsheets.

See development branch for the initial implementation.


## Product lanes and plan tiers
- **Free — ¥0**
  - Local-first diagnostics and safe data-shaping preview.
  - Lightweight aggregation: choose a vertical axis, an optional horizontal axis, and one numeric field. Data Shaper can create a cross-tab/pivot-style sum at each vertical × horizontal intersection.
  - Simple report preview/export with top-five categories.
- **Lite — ¥480/month (final launch price; Stripe TEST Price connection pending)**
  - Batch data shaping / normalization.
  - Full household and custom-purpose report detail.
  - Recipe save/reuse.
- **Pro — ¥980/month (final launch price; existing Stripe TEST checkout)**
  - Everything in Lite.
  - Corporate and sole-proprietor accounting preparation.
  - Statement templates, source-account mapping, many-to-one rollups, and balance reconciliation.

Report exports offer:
- **CSV (UTF-8 BOM; Excel-friendly)**
- **PDF** through a local browser print/save flow; report data is not uploaded to the Worker.

Aggregation extraction preserves the input file format: CSV input → CSV output, TSV input → TSV output, XLSX input → XLSX output. The extracted file contains only the calculated aggregation table and never overwrites the uploaded source file.

Report samples are explanatory only. Missing prior-year values are never fabricated. Accounting outputs are preparation/support materials, not tax representation or automated tax-law judgments.

## Template-first accounting aggregation
The accounting workflow is template-first, not a generic statistical GROUP BY workflow.

1. Prepare or import a statement template containing the target account rows.
2. Upload a trial balance and map its account / amount (or debit / credit) columns.
3. Match each source account to a template account. Multiple source accounts may roll up into one template row.
4. Keep unknown accounts unresolved until a human maps them; never silently discard them.
5. Calculate the statement template and verify Assets = Liabilities + Equity.
6. Return the calculated report as CSV or PDF; the source file remains Local First.

Template columns:
- `order`
- `section` (current_assets / noncurrent_assets / current_liabilities / noncurrent_liabilities / equity)
- `account`
- `aliases` (pipe-separated)
- `normal_balance` (debit / credit)

The starter template is only a practical Japan-GAAP balance-sheet starter. It is not claimed to be a complete EDINET taxonomy. EDINET/XBRL extraction and PDF/OCR ingestion can populate the same template model in later stages.


## Simple aggregation vs accounting
- **Aggregation** is a generic pivot-style operation: choose a vertical axis, an optional horizontal axis, and one numeric field to sum.
  - Example: vertical=`商品`, horizontal=`店舗`, value=`価格` creates a 商品 × 店舗 matrix whose intersections contain summed prices.
  - If the horizontal axis is omitted, it behaves as a one-direction grouped sum.
  - The result can be extracted in the same file format as the input (CSV/TSV/XLSX).
  - No accounting template is involved.
- **Statement layout** is the accounting workflow. It owns the statement template, trial-balance account mapping, many-to-one account rollups, and balance-sheet reconciliation.

## Sale gate
Public paid sale remains blocked until all of the following pass:
- Lite and Pro Stripe TEST Checkout both create the correct subscription tier.
- Business owner confirms tax treatment and customer-facing total-price wording (`DATA_SHAPER_TAX_DISPLAY_CONFIRMED=true`).
- Webhook entitlement resolves Free / Lite / Pro correctly; Pro inherits Lite access but Lite never receives Pro accounting access.
- CSV / TSV / XLSX matching-format aggregation extraction passes with real files.
- CSV and PDF report export passes for Free/Lite/Pro report paths.
- Google OAuth remains identity-only; email strings never grant paid access.
- No live-mode Stripe mutation occurs before the TEST gate passes.

Launch prices are fixed at **Free ¥0 / Lite ¥480 per month / Pro ¥980 per month**. The nominal launch prices are fixed. Customer-facing tax treatment / total-price wording remains gated until the business owner confirms the tax setup.

### Automated browser sale-gate status (2026-11-11)
- Real CSV pivot upload → aggregation → CSV download/content verification: PASS
- Real XLSX pivot upload → aggregation → XLSX download/cell verification: PASS
- Japanese PDF print/save report renderer: PASS
- PDF popup handling bug found by E2E and fixed before merge
- These Playwright checks now run in normal GitHub CI before build/deploy dry-run.


## Language support
- The application UI can switch between **日本語 / English**.
- UI language is independent from tax jurisdiction. English does **not** imply U.S. tax rules, and Japanese does not automatically apply a Japanese filing regime.
- Standard report purposes are jurisdiction-neutral: Company / Self-employed or Freelancer / Household / Custom.
- Japan-specific blue/white return choices are not exposed as default product modes.
- CSV/XLSX input values and user-defined account names are never machine-translated.
- Generated Free/Lite report labels follow the selected UI language.
- Demand/accounting canonical field names remain stable across languages so Recipes and mappings do not change when the UI language changes.
- The built-in balance-sheet starter remains Japan-oriented and is labeled as such; other jurisdictions should import/edit their own statement template rather than infer a tax form from the UI language.

## Period-aware tax calculation helper
This is a **Pro accounting feature** and an accounting/data calculation helper and is **separate from Stripe tax settings for selling Data Shaper itself**.

Users can register tax rules with:
- business unit (optional scope)
- tax category (optional scope)
- effective-from / effective-to dates
- percentage rate

Safety rules:
- Data Shaper never infers a tax rate from industry or business type.
- Exact rule periods for the same business + tax category may not overlap.
- A more specific business/category rule can override a broader rule deterministically.
- Transactions with no applicable rule remain no_rule; no default rate is silently inserted.
- Invalid dates and ambiguous rules remain uncalculated.
- Amount basis (tax-exclusive / tax-inclusive) and rounding (floor / round / ceil) are explicit user settings.
- Input columns business_unit and tax_category are first-class mappings.

Tax rules are saved in Recipe schema v6.

## Depreciation helper
The Pro accounting workspace includes a conservative calculation helper for:
- straight-line depreciation
- declining-balance depreciation with a **user-confirmed annual rate**
- acquisition cost
- residual value
- useful life

It does **not** automatically determine Japanese statutory useful life, statutory declining rates, guarantee rates, revised rates, or partial-year proration. It is a calculation aid rather than tax-return automation.
