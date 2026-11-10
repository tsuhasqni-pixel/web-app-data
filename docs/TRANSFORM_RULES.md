# Transform rules

The MVP follows: Inspect → Detect → Map → Confirm → Transform → Validate.

Safe defaults:
- trim surrounding whitespace: ON
- Unicode width normalization (NFKC): ON
- recognized date normalization: ON

Dangerous transforms are intentionally absent/off:
- NULL → 0
- negative quantity → 0
- fuzzy SKU mutation
- duplicate aggregation
- subtotal/total deletion
- implicit unit conversion

A warning is not permission to mutate a value. Every destructive rule added later must produce an audit entry explaining the before/after value and rule.

## Orientation
The detected orientation is a suggestion. The operator can choose Auto, Long, or Wide. Wide conversion only expands columns whose headers look like dates/months. The semantic value field (demand, inventory, inbound, outbound, amount) must be chosen explicitly.

## Aggregation and financial layout
Aggregation never mutates source rows. Balance-sheet layout is an explicit presentation helper: account names are assigned by the user to current assets, non-current assets, current liabilities, non-current liabilities, or equity. Unclassified items stay visible. Any balance difference is shown and is never automatically plugged.
