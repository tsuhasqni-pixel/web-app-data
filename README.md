# Data Shaper — Inventory Data Normalizer

Local-first data preparation workbench for company CSV/XLSX data.

Status: **development / not production-ready**. No customer data is uploaded to a server. Review every inferred mapping and destructive transformation before export.

## Six-stage workflow
Inspect → Detect → Map → Confirm → Transform → Validate.

## Repository policy
- Main is protected by workflow convention: changes via `codex/*` draft pull requests.
- No automatic production deployment, payment activation or customer-data ingestion.
- Cloudflare account and project bindings are **not configured** until separately verified.
- Do not commit secrets or actual client spreadsheets.

See development branch for the initial implementation.


## Product lanes and plan tiers
- **Free diagnosis**: local-first diagnostics and safe cleaning preview.
- **Aggregation (Pro)**: choose one grouping field and one numeric field; Data Shaper sums the numeric field by the selected grouping field.
- **Decision & reports (Free / Pro)**:
  - Free: purpose selection, guided sample rows, suggested input fields, top-five category summary, and a simple CSV report.
  - Pro: full category detail, reusable settings, and accounting-template workflows where applicable.
  - Supported purposes: corporate, sole proprietor (blue return preparation), sole proprietor (white return preparation), household/personal management, and custom.
  - Report samples are explanatory only. Missing prior-year values are never fabricated.
  - Outputs are accounting/data-preparation materials, not tax representation or automated tax-law judgments.
- **Cleaning (Pro)**: batch cleaning and canonical output workflows.

## Template-first accounting aggregation
The accounting workflow is template-first, not a generic statistical GROUP BY workflow.

1. Prepare or import a statement template containing the target account rows.
2. Upload a trial balance and map its account / amount (or debit / credit) columns.
3. Match each source account to a template account. Multiple source accounts may roll up into one template row.
4. Keep unknown accounts unresolved until a human maps them; never silently discard them.
5. Calculate the statement template and verify Assets = Liabilities + Equity.
6. Return the calculated CSV immediately; the source file remains Local First.

Template columns:
- `order`
- `section` (current_assets / noncurrent_assets / current_liabilities / noncurrent_liabilities / equity)
- `account`
- `aliases` (pipe-separated)
- `normal_balance` (debit / credit)

The starter template is only a practical Japan-GAAP balance-sheet starter. It is not claimed to be a complete EDINET taxonomy. EDINET/XBRL extraction and PDF/OCR ingestion can populate the same template model in later stages.


## Simple aggregation vs accounting
- **Aggregation** is a generic two-field operation: choose one field to group by and one numeric field to sum.
  - Example: `商品` → group key, `価格` → numeric field. Repeated rows for 商品A are summed.
  - No accounting template is involved.
- **Statement layout** is the accounting workflow. It owns the statement template, trial-balance account mapping, many-to-one account rollups, and balance-sheet reconciliation.
