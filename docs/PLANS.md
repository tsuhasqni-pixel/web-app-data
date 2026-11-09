# Free / Pro product boundary

## Free — Cleaning diagnosis

Purpose: show the user what is wrong with the selected data and what a safe cleaning process would do.

Free diagnosis may inspect:
- blank cells
- surrounding whitespace
- full-width / half-width normalization candidates
- numeric-looking text
- exact duplicate-row candidates
- structure/header/orientation signals

Free may preview safe transformations such as trim and Unicode width normalization.

Free must **not** silently:
- fill blanks with zero
- delete duplicates
- clip negative values
- infer accounting classifications
- process every workbook sheet as a paid batch
- export the fully cleaned multi-sheet job

The value of Free is explainability: "this issue exists, therefore this cleaning step is available."

## Pro — Multi-sheet cleaning

Pro is the operational workspace.

Current batch guardrails:
- up to 20 selected sheets per job
- up to 100,000 total rows across selected sheets
- source file remains local to the browser
- trim and width normalization can be applied in bulk
- exact duplicate deletion is explicit opt-in and defaults OFF
- cleaned output is packaged as sheet-level CSV files plus a JSON cleaning report in one ZIP

Separate Pro workspaces are provided for:
- canonical format conversion
- aggregation
- balance-sheet layout assistance

## Billing status

These product boundaries are implemented in the UI, but Stripe entitlement enforcement is not connected yet. Until authentication + Stripe entitlement is implemented and tested, this repository remains pre-production and the Pro tab is a development preview.
