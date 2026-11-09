# Architecture / safety gates

Inspect → Detect → Map → Confirm → Transform → Validate. Raw input stays in the browser. The first version does not make external API requests, does not invoke LLMs, and does not persist input files.

## Explicit limitations
- UTF-8 CSV/TSV only; Shift-JIS is not silently guessed.
- XLSX only (not XLS). Merged headers and formulas may need manual correction.
- Long format only for export; wide-format is detected and warned, not silently pivoted.
- No automatic row deletion, deduplication, NULL-to-zero, negative clipping, aggregation, or remote upload.
- A mapping confidence score is a heuristic, not a calibrated probability.
- Inventory profile demands all mapped fields before export; inspect actual downstream inventory schema before enabling live import.
- For now recipes are downloaded as JSON, not stored remotely.
- No authentication, Stripe, D1, R2 or production Cloudflare deployment is configured.

## Planned integrations
Cloudflare Workers/Static Assets and D1 for user-owned recipes and subscriptions after confirming the correct new account. Stripe has separate app entitlement and webhook. Neither is part of MVP.
