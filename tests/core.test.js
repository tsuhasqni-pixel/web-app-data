import {describe,it,expect} from 'vitest';
import {parseCSV,toCSV} from '../src/parser/csv.js';
import {detect} from '../src/detector/index.js';
import {transform} from '../src/transform/index.js';
import {aggregateRecords,buildBalanceSheet} from '../src/aggregate/index.js';
import {diagnoseCleaning,cleanRawTable} from '../src/cleaner/index.js';
import {cleanWorkbook,BATCH_LIMITS} from '../src/batch/index.js';
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
 it('converts user-selected wide format into long records',()=>{
   const d=detect([['SKU','2026-01-01','2026-01-02'],['A','3','4']]);
   d.mapping={0:'sku_id'};
   const t=transform(d,d.mapping,{orientation:'wide',wideValueField:'demand_qty'});
   expect(t.records).toHaveLength(2);
   expect(t.records[0]).toMatchObject({sku_id:'A',date:'2026-01-01',demand_qty:3});
   expect(t.records[1]).toMatchObject({sku_id:'A',date:'2026-01-02',demand_qty:4});
 });
 it('aggregates selected dimensions without changing source records',()=>{
   const rows=[{account_name:'Cash',amount:100},{account_name:'Cash',amount:50},{account_name:'Debt',amount:80}];
   const agg=aggregateRecords(rows,{groupBy:['account_name'],valueField:'amount',method:'sum'});
   expect(agg.find(x=>x.account_name==='Cash').sum_amount).toBe(150);
   expect(rows).toHaveLength(3);
 });
 it('builds a balance-sheet preview only from explicit assignments',()=>{
   const rows=[{account_name:'Cash',amount:100},{account_name:'Debt',amount:60},{account_name:'Capital',amount:40},{account_name:'Unknown',amount:5}];
   const sheet=buildBalanceSheet(rows,{assignments:{Cash:'current_assets',Debt:'current_liabilities',Capital:'equity'}});
   expect(sheet.totals).toMatchObject({assets:100,liabilities:60,equity:40,difference:0});
   expect(sheet.unclassified).toEqual([{account:'Unknown',amount:5}]);
 });
 it('recognizes accounting columns without guessing statement section',()=>{
   const d=detect([['勘定科目','金額'],['現金','100']]);
   expect(d.mapping[0]).toBe('account_name');
   expect(d.mapping[1]).toBe('amount');
   expect(Object.values(d.mapping)).not.toContain('statement_section');
 });
 it('free diagnosis explains blanks and safe cleaning candidates without filling blanks',()=>{
   const rows=[['SKU','Value'],[' A ','１'],['','2'],['','2']];
   const d=diagnoseCleaning(rows,{headerRow:0});
   expect(d.blanks).toBeGreaterThan(0);
   expect(d.outerWhitespace).toBeGreaterThan(0);
   expect(d.fullWidth).toBeGreaterThan(0);
   const cleaned=cleanRawTable(rows,{headerRow:0,trim:true,width:true,removeExactDuplicates:false});
   expect(cleaned.rows[0][0]).toBe('A');
   expect(cleaned.rows[1][0]).toBe('');
   expect(cleaned.outputRows).toBe(3);
 });
 it('Pro batch cleaning can process multiple sheets without deleting duplicates by default',()=>{
   const sheets=[
     {name:'A',sourceFile:'book.xlsx',rows:[['SKU'],[' A '],[' A ']]},
     {name:'B',sourceFile:'book.xlsx',rows:[['SKU'],['Ｂ']]}
   ];
   const out=cleanWorkbook(sheets,[0,1],{trim:true,width:true,removeExactDuplicates:false});
   expect(out).toHaveLength(2);
   expect(out[0].cleaned.outputRows).toBe(2);
   expect(out[1].cleaned.rows[0][0]).toBe('B');
   expect(BATCH_LIMITS.maxSheets).toBeGreaterThanOrEqual(2);
 });
 it('duplicate deletion only happens after explicit opt-in',()=>{
   const rows=[['x'],['A'],['A']];
   expect(cleanRawTable(rows,{headerRow:0,removeExactDuplicates:false}).outputRows).toBe(2);
   expect(cleanRawTable(rows,{headerRow:0,removeExactDuplicates:true}).outputRows).toBe(1);
 });
 it('exports inventory without silently synthesizing fields',()=>{expect(exportCSV([{sku_id:'A',demand_qty:4}], 'inventory')).toContain('date,sku_id,demand_qty,inventory_on_hand')});
 it('keeps all twenty synthetic scenario fixtures parseable by detector',()=>{
   expect(scenarios).toHaveLength(20);
   for(const scenario of scenarios){
     expect(()=>detect(scenario.rows)).not.toThrow();
   }
 });
});
