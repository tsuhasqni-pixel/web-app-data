# Architecture / safety gates

Inspect → Detect → Map → Confirm → Transform → Validate. Raw input stays in the browser. The first version does not make external API requests, does not invoke LLMs, and does not persist input files.

## Explicit limitations
- UTF-8 CSV/TSV only; Shift-JIS is not silently guessed.
- XLSX only (not XLS). Merged headers and formulas may need manual correction.
- Orientation can be Auto / Long / Wide. Wide mode explicitly pivots recognized date/period columns into long records; the user chooses the value meaning before conversion.
- No automatic row deletion, deduplication, NULL-to-zero, negative clipping, aggregation, or remote upload.
- A mapping confidence score is a heuristic, not a calibrated probability.
- Inventory profile demands all mapped fields before export; inspect actual downstream inventory schema before enabling live import.
- For now recipes are downloaded as JSON, not stored remotely.
- No authentication, Stripe, D1, R2 or production Cloudflare deployment is configured.

## Planned integrations
Cloudflare Workers/Static Assets and D1 for user-owned recipes and subscriptions after confirming the correct new account. Stripe has separate app entitlement and webhook. Neither is part of MVP.

## Workspace modes
- Normalize: canonical mapping + safe export.
- Aggregate: user-selected group keys and numeric field with sum/average/count/min/max.
- Balance-sheet layout helper: explicit account-to-section assignment, section totals, unclassified accounts, and balance difference. It does not invent accounting classifications or auto-correct imbalances.
