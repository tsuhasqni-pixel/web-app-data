# Data model

The browser converts input into a canonical record without uploading raw company data.

Core fields:
- source_file, source_sheet, source_row
- sku_id, sku_name
- date, period_start, period_end, frequency
- demand_qty
- inventory_on_hand, inbound_qty, outbound_qty
- location_id, location_name
- unit, lead_time_days
- source_column, quality_flags

## MVP required profiles

DemandScope long export requires `date`, `sku_id`, `demand_qty`.

Inventory export currently exposes `date,sku_id,demand_qty,inventory_on_hand,inbound_qty,location_name,unit`. This is provisional until the sibling inventory application's exact schema is confirmed. Do not enable direct API import before that confirmation.

Schema versions are additive. Never overwrite an old schema definition in place.
