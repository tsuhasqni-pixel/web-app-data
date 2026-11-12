import {describe,it,expect} from 'vitest';
import {parseCSV,toCSV,toDelimited,spreadsheetSafeValue} from '../src/parser/csv.js';
import {readWorkbook,WORKBOOK_LIMITS} from '../src/parser/index.js';
import {detect} from '../src/detector/index.js';
import {buildRecipe,validateRecipe,sourceSignature} from '../src/recipe/index.js';
import {transform} from '../src/transform/index.js';
import {aggregateRecords,buildPivotTable,buildBalanceSheet,buildProgrammedBalanceSheet,classifyBalanceAccount} from '../src/aggregate/index.js';
import {createDefaultStatementTemplate,mapTrialBalanceToTemplate,parseStatementTemplateRows} from '../src/accounting/template.js';
import {diagnoseCleaning,cleanRawTable} from '../src/cleaner/index.js';
import {cleanWorkbook,BATCH_LIMITS} from '../src/batch/index.js';
import {validate} from '../src/validator/index.js';
import {exportCSV} from '../src/exporter/index.js';
import {objectRowsToRows,openPrintReport} from '../src/exporter/report.js';
import {validateTaxRules,resolveTaxRule,calculateTaxAmount,applyTaxRules} from '../src/tax/index.js';
import {buildDepreciationSchedule} from '../src/depreciation/index.js';
import {reportPurposes,buildSimpleReport,simpleReportToRows} from '../src/reporting/index.js';
import {scenarios} from './fixtures/scenarios.js';

describe('local-first data workflow',()=>{
 it('preserves quoted commas and escaped quotes',()=>expect(parseCSV('a,b\r\n"hi, x","a""b"\r\n')[1]).toEqual(['hi, x','a"b']));
 it('supports CSV roundtrip',()=>{const rows=[['x','y'],['a,b','a"b']];expect(parseCSV(toCSV(rows))).toEqual(rows)});
 it('neutralizes spreadsheet formulas without breaking ordinary negative numbers',()=>{
   expect(spreadsheetSafeValue('=2+2')).toBe("'=2+2");
   expect(spreadsheetSafeValue('@SUM(A1:A2)')).toBe("'@SUM(A1:A2)");
   expect(spreadsheetSafeValue('-3')).toBe('-3');
   expect(toCSV([['value'],['=HYPERLINK("https://evil.example")'],['-3']])).toContain("'=HYPERLINK");
 });
 it('rejects CSV that expands beyond the workbook row safety limit',async()=>{
   const text=Array.from({length:WORKBOOK_LIMITS.maxRows+1},(_,i)=>i===0?'x':'1').join('\n');
   const bytes=new TextEncoder().encode(text);
   const file={name:'too-many.csv',size:bytes.byteLength,arrayBuffer:async()=>bytes.buffer};
   await expect(readWorkbook(file)).rejects.toThrow(/100,000 row safety limit/);
 });
 it('detects a shifted header',()=>{const d=detect([['Company'],['Note'],['SKU','Date','Demand'],['A','2026-01-01','12']]);expect(d.headerRow).toBe(2);expect(d.mapping[2]).toBe('demand_qty')});
 it('maps business and tax category headers explicitly',()=>{
   const d=detect([['日付','事業区分','税区分','金額'],['2026-01-01','A','standard','1000']]);
   expect(d.mapping[1]).toBe('business_unit');
   expect(d.mapping[2]).toBe('tax_category');
   expect(d.mapping[3]).toBe('amount');
 });
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
 it('provides guided report purposes without pretending sample values are user history',()=>{
   expect(reportPurposes.map(x=>x.id)).toEqual(expect.arrayContaining(['corporate','sole_blue','sole_white','household','custom']));
   const household=reportPurposes.find(x=>x.id==='household');
   expect(household.suggestedFields).toContain('収支区分');
   expect(household.sample.length).toBeGreaterThan(0);
 });
 it('builds a free household summary from explicit category, amount and flow fields',()=>{
   const rows=[
     {category:'給与',amount:250000,flow_type:'収入'},
     {category:'食費',amount:4000,flow_type:'支出'},
     {category:'食費',amount:6000,flow_type:'支出'},
     {category:'不明',amount:1000,flow_type:'その他'}
   ];
   const out=buildSimpleReport(rows,{categoryField:'category',amountField:'amount',flowField:'flow_type'});
   expect(out.cashflow).toMatchObject({income:250000,expense:10000,net:240000,unknownFlowRows:1});
   expect(out.categories.find(x=>x.category==='食費').amount).toBe(10000);
   const csvRows=simpleReportToRows(out,'household');
   expect(csvRows.some(r=>r[0]==='収支差額'&&r[1]===240000)).toBe(true);
   const enRows=simpleReportToRows(out,'household',{language:'en'});
   expect(enRows.some(r=>r[0]==='Net cash flow'&&r[1]===240000)).toBe(true);
   expect(enRows.some(r=>r[0]==='Notice'&&String(r[1]).includes('does not provide tax representation'))).toBe(true);
 });
 it('converts object rows into table rows for CSV/PDF report export',()=>{
   expect(objectRowsToRows([{商品:'A',価格:100},{商品:'B',価格:200}])).toEqual([
     ['商品','価格'],['A',100],['B',200]
   ]);
   expect(()=>openPrintReport({title:'x',rows:[]})).toThrow('PDF出力はブラウザで実行してください');
 });
 it('builds a vertical by horizontal pivot table and totals intersections',()=>{
   const rows=[
     {product:'商品A',store:'那覇',price:100},
     {product:'商品A',store:'那覇',price:250},
     {product:'商品A',store:'浦添',price:400},
     {product:'商品B',store:'那覇',price:300}
   ];
   const pivot=buildPivotTable(rows,{rowField:'product',columnField:'store',valueField:'price'});
   expect(pivot.rows).toEqual([
     ['product × store','那覇','浦添','合計'],
     ['商品A',350,400,750],
     ['商品B',300,0,300],
     ['合計',650,400,1050]
   ]);
   expect(pivot.grandTotal).toBe(1050);
 });
 it('keeps one-direction aggregation when no horizontal axis is selected',()=>{
   const pivot=buildPivotTable([
     {product:'商品A',price:100},{product:'商品A',price:50},{product:'商品B',price:30}
   ],{rowField:'product',valueField:'price'});
   expect(pivot.rows).toEqual([
     ['product','price 合計'],['商品A',150],['商品B',30]
   ]);
 });
 it('serializes tab-separated output without breaking tabs or quotes',()=>{
   const tsv=toDelimited([['a','b'],['x\ty','a"b']],'\t');
   expect(tsv).toContain('"x\ty"');
   expect(tsv).toContain('"a""b"');
 });
 it('supports the simple two-field aggregation use case: item -> price total',()=>{
   const rows=[
     {product:'商品A',price:100},
     {product:'商品A',price:250},
     {product:'商品B',price:400}
   ];
   const agg=aggregateRecords(rows,{groupBy:['product'],valueField:'price',method:'sum'});
   expect(agg.find(x=>x.product==='商品A')).toMatchObject({sum_price:350,source_count:2});
   expect(agg.find(x=>x.product==='商品B')).toMatchObject({sum_price:400,source_count:1});
 });
 it('aggregates by user-selected primary and secondary axes',()=>{
   const rows=[
     {sku_name:'A',location_name:'Tokyo',demand_qty:3},
     {sku_name:'A',location_name:'Tokyo',demand_qty:4},
     {sku_name:'A',location_name:'Osaka',demand_qty:5}
   ];
   const agg=aggregateRecords(rows,{groupBy:['sku_name','location_name'],valueField:'demand_qty',method:'sum'});
   expect(agg.find(x=>x.location_name==='Tokyo').sum_demand_qty).toBe(7);
   expect(agg.find(x=>x.location_name==='Osaka').sum_demand_qty).toBe(5);
 });
 it('classifies common Japanese balance-sheet accounts with deterministic rules',()=>{
   expect(classifyBalanceAccount('現金預金').sectionId).toBe('current_assets');
   expect(classifyBalanceAccount('長期借入金').sectionId).toBe('noncurrent_liabilities');
   expect(classifyBalanceAccount('資本金').sectionId).toBe('equity');
   expect(classifyBalanceAccount('売上高').sectionId).toBe('');
 });
 it('builds and reconciles a programmed balance sheet from amount balances',()=>{
   const rows=[
     {account_name:'現金預金',amount:120},
     {account_name:'建物',amount:80},
     {account_name:'買掛金',amount:50},
     {account_name:'長期借入金',amount:50},
     {account_name:'資本金',amount:100}
   ];
   const sheet=buildProgrammedBalanceSheet(rows);
   expect(sheet.totals).toMatchObject({assets:200,liabilities:100,equity:100,difference:0,isBalanced:true});
   expect(sheet.unclassified).toHaveLength(0);
 });
 it('derives natural balances from debit and credit columns after classification',()=>{
   const rows=[
     {account_name:'現金',debit:150,credit:30},
     {account_name:'買掛金',debit:20,credit:70},
     {account_name:'資本金',debit:0,credit:70}
   ];
   const sheet=buildProgrammedBalanceSheet(rows,{amountField:'',debitField:'debit',creditField:'credit'});
   expect(sheet.totals).toMatchObject({assets:120,liabilities:50,equity:70,difference:0,isBalanced:true});
 });
 it('does not report balanced when any trial-balance account remains unclassified',()=>{
   const rows=[
     {account_name:'現金',amount:100},
     {account_name:'買掛金',amount:50},
     {account_name:'資本金',amount:50},
     {account_name:'売上高',amount:0}
   ];
   const sheet=buildProgrammedBalanceSheet(rows);
   expect(sheet.totals.difference).toBe(0);
   expect(sheet.totals.isBalanced).toBe(false);
   expect(sheet.unclassified.map(x=>x.account)).toContain('売上高');
 });
 it('maps multiple source trial-balance accounts into one statement-template line',()=>{
   const template=createDefaultStatementTemplate();
   const rows=[
     {account_name:'現金',amount:100},
     {account_name:'普通預金',amount:200},
     {account_name:'買掛金',amount:150},
     {account_name:'資本金',amount:150}
   ];
   const out=mapTrialBalanceToTemplate(rows,template);
   const cash=out.rows.find(x=>x.id==='cash_and_deposits');
   expect(cash.amount).toBe(300);
   expect(cash.source_accounts).toEqual(expect.arrayContaining(['現金','普通預金']));
   expect(out.unresolved).toHaveLength(0);
   expect(out.totals).toMatchObject({assets:300,liabilities:150,equity:150,difference:0,isBalanced:true});
 });
 it('keeps unknown input accounts unresolved until the user maps them',()=>{
   const template=createDefaultStatementTemplate();
   const rows=[{account_name:'会社独自科目',amount:40}];
   const first=mapTrialBalanceToTemplate(rows,template);
   expect(first.unresolved.map(x=>x.account)).toContain('会社独自科目');
   expect(first.totals.isBalanced).toBe(false);
   const second=mapTrialBalanceToTemplate(rows,template,{manualMappings:{'会社独自科目':'other_current_assets'}});
   expect(second.unresolved).toHaveLength(0);
   expect(second.rows.find(x=>x.id==='other_current_assets').amount).toBe(40);
 });
 it('parses an editable statement template from CSV-like rows',()=>{
   const tpl=parseStatementTemplateRows([
     ['order','section','account','aliases','normal_balance'],
     [1,'流動資産','現金等','現金|普通預金','debit'],
     [2,'流動負債','仕入債務','買掛金|支払手形','credit']
   ]);
   expect(tpl).toHaveLength(2);
   expect(tpl[0]).toMatchObject({label:'現金等',section:'current_assets',normal_balance:'debit'});
   expect(tpl[0].aliases).toContain('普通預金');
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
 it('Lite batch data shaping can process multiple sheets without deleting duplicates by default',()=>{
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
 it('profiles column types for MVP diagnostics',()=>{
   const d=detect([['SKU','Date','Demand'],['A','2026-01-01','10'],['B','2026-01-02','20']]);
   expect(d.columnProfiles[1].inferredType).toBe('date');
   expect(d.columnProfiles[2].inferredType).toBe('number');
 });
 it('saves and validates structural Recipe signatures',()=>{
   const rows=[['SKU','Date','Demand'],['A','2026-01-01','2']];
   const d=detect(rows);const sheets=[{name:'CSV',rows}];
   const recipe=buildRecipe({sheets,analysis:d,options:{trim:true},profile:'demand',orientation:'auto',wideValueField:'demand_qty',aggregateConfig:{},bsConfig:{},batchOptions:{}});
   expect(recipe.source_signature).toBe(sourceSignature(sheets,d));
   expect(()=>validateRecipe(recipe,{sheets,analysis:d,allowedFields:['sku_id','date','demand_qty']})).not.toThrow();
 });
 it('reports Data Loss Guard SKU, null and date metrics',()=>{
   const d=detect([['SKU','Date','Demand'],['A','2026-01-01','2'],['B','2026-01-02','3']]);
   const t=transform(d,d.mapping);
   const v=validate(d,t,'demand');
   expect(v.stats.inputUniqueSku).toBe(2);
   expect(v.stats.outputUniqueSku).toBe(2);
   expect(v.stats.inputDateMin).toBe('2026-01-01');
   expect(v.stats.outputDateMax).toBe('2026-01-02');
   expect(v.stats.inputNullCount).toBe(0);
   expect(v.stats.outputNullCount).toBe(0);
 });
 it('exports inventory without silently synthesizing fields',()=>{expect(exportCSV([{sku_id:'A',demand_qty:4}], 'inventory')).toContain('date,sku_id,demand_qty,inventory_on_hand')});
 it('keeps all twenty synthetic scenario fixtures parseable by detector',()=>{
   expect(scenarios).toHaveLength(20);
   for(const scenario of scenarios){
     expect(()=>detect(scenario.rows)).not.toThrow();
   }
 });
});
