import {describe,it,expect} from 'vitest';
import {parseCSV,toCSV} from '../src/parser/csv.js';
import {detect} from '../src/detector/index.js';
import {transform} from '../src/transform/index.js';
import {validate} from '../src/validator/index.js';
import {exportCSV} from '../src/exporter/index.js';
describe('local-first data workflow',()=>{
 it('preserves quoted commas and escaped quotes',()=>expect(parseCSV('a,b\r\n"hi, x","a""b"\r\n')[1]).toEqual(['hi, x','a"b']));
 it('supports CSV roundtrip',()=>{const rows=[['x','y'],['a,b','a"b']];expect(parseCSV(toCSV(rows))).toEqual(rows)});
 it('detects a shifted header',()=>{const d=detect([['Company'],['Note'],['SKU','Date','Demand'],['A','2026-01-01','12']]);expect(d.headerRow).toBe(2);expect(d.mapping[2]).toBe('demand_qty')});
 it('preserves negative quantities for review',()=>{const d=detect([['SKU','Date','Demand'],['A','2026/1/1','-3']]);const t=transform(d,d.mapping);expect(t.records[0].demand_qty).toBe(-3);expect(t.records[0].date).toBe('2026-01-01');expect(validate(d,t).warnings.length).toBe(1)});
 it('blocks missing required mappings',()=>{const d=detect([['SKU','Demand'],['A','2']]);const t=transform(d,d.mapping);expect(validate(d,t).errors).toContain('Missing required mapping: date')});
 it('exports inventory without silently synthesizing fields',()=>{expect(exportCSV([{sku_id:'A',demand_qty:4}], 'inventory')).toContain('date,sku_id,demand_qty,inventory_on_hand')});
});
