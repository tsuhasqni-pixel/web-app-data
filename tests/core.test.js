import {describe,it,expect} from 'vitest';
import {parseCSV,toCSV} from '../src/parser/csv.js';
import {detect} from '../src/detector/index.js';
import {transform} from '../src/transform/index.js';
import {validate} from '../src/validator/index.js';
import {exportCSV} from '../src/exporter/index.js';
import {scenarios} from './fixtures/scenarios.js';

describe('local-first data workflow',()=>{
 it('preserves quoted commas and escaped quotes',()=>expect(parseCSV('a,b\r\n"hi, x","a""b"\r\n')[1]).toEqual(['hi, x','a"b']));
 it('supports CSV roundtrip',()=>{const rows=[['x','y'],['a,b','a"b']];expect(parseCSV(toCSV(rows))).toEqual(rows)});
 it('detects a shifted header',()=>{const d=detect([['Company'],['Note'],['SKU','Date','Demand'],['A','2026-01-01','12']]);expect(d.headerRow).toBe(2);expect(d.mapping[2]).toBe('demand_qty')});
 it('detects daily and monthly wide formats',()=>{
   expect(detect(scenarios.find(x=>x.name==='03_wide_format').rows).orientation).toBe('wide');
   expect(detect(scenarios.find(x=>x.name==='16_monthly_columns').rows).orientation).toBe('wide');
 });
 it('preserves negative quantities for review',()=>{const d=detect([['SKU','Date','Demand'],['A','2026/1/1','-3']]);const t=transform(d,d.mapping);expect(t.records[0].demand_qty).toBe(-3);expect(t.records[0].date).toBe('2026-01-01');expect(validate(d,t).warnings).toContain('1 negative quantities detected (not modified)')});
 it('blocks missing required mappings',()=>{const d=detect([['SKU','Demand'],['A','2']]);const t=transform(d,d.mapping);expect(validate(d,t).errors).toContain('Missing required mapping: date or period_start')});
 it('accepts sku_name as DemandScope identifier',()=>{
   const d=detect([['Product','Date','Demand'],['Widget','2026-01-01','2']]);
   const t=transform(d,d.mapping);
   expect(validate(d,t,'demand').errors).toEqual([]);
   expect(exportCSV(t.records,'demand')).toContain('2026-01-01,Widget,2');
 });
 it('keeps source provenance in canonical records',()=>{
   const d=detect([['SKU','Date','Demand'],['A','2026-01-01','2']]);
   const t=transform(d,d.mapping,{sourceFile:'sales.xlsx',sourceSheet:'Tokyo'});
   expect(t.records[0]).toMatchObject({source_file:'sales.xlsx',source_sheet:'Tokyo',source_row:2});
 });
 it('does not silently coerce ambiguous blank or negative values',()=>{
   const blank=detect(scenarios.find(x=>x.name==='14_blank_zero_ambiguous').rows);
   const bt=transform(blank,blank.mapping);
   expect(bt.records[0].demand_qty).toBe('');
   expect(bt.records[1].demand_qty).toBe(0);
   const ret=detect(scenarios.find(x=>x.name==='18_return_data').rows);
   expect(transform(ret,ret.mapping).records[0].demand_qty).toBe(-1);
 });
 it('exports inventory without silently synthesizing fields',()=>{expect(exportCSV([{sku_id:'A',demand_qty:4}], 'inventory')).toContain('date,sku_id,demand_qty,inventory_on_hand')});
 it('keeps all twenty synthetic scenario fixtures parseable by detector',()=>{
   expect(scenarios).toHaveLength(20);
   for(const scenario of scenarios){
     expect(()=>detect(scenario.rows)).not.toThrow();
   }
 });
});
