import {toCSV} from '../parser/csv.js';
import {exportFields} from '../transform/index.js';
export function exportCSV(records,profile){
 if(profile==='demand'){
   return toCSV([
     ['date','sku','demand'],
     ...records.map(r=>[r.date||r.period_start||'',r.sku_id||r.sku_name||'',r.demand_qty??''])
   ]);
 }
 const keys=exportFields[profile];
 if(!keys)throw new Error('Unknown profile');
 return toCSV([keys,...records.map(row=>keys.map(k=>row[k]??''))]);
}
export function exportObjectRows(rows){
 const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];
 return toCSV([keys,...rows.map(r=>keys.map(k=>r[k]??''))]);
}
export function exportBalanceSheet(sheet){
 const rows=[['section','account','amount','classification_source']];
 for(const section of Object.values(sheet.sections)){
   for(const item of section.items)rows.push([section.label,item.account,item.amount,item.classification_source||'']);
   rows.push([section.label+' 合計','',section.total,'']);
 }
 for(const item of sheet.unclassified)rows.push(['未分類',item.account,item.amount,item.classification_source||'unclassified']);
 rows.push(['資産合計','',sheet.totals.assets,'']);
 rows.push(['負債合計','',sheet.totals.liabilities,'']);
 rows.push(['純資産合計','',sheet.totals.equity,'']);
 rows.push(['貸借差額','',sheet.totals.difference,'']);
 rows.push(['貸借一致','',sheet.totals.isBalanced?'一致':'不一致','']);
 rows.push(['ルールバージョン','',sheet.rule_version??'','']);
 return toCSV(rows);
}
export function saveText(filename,text,mime='text/plain'){
 const blob=new Blob([text],{type:mime});const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=filename;a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function saveCsv(filename,csv){
 const text=String(csv??'').startsWith('\\ufeff')?String(csv??''):'\\ufeff'+String(csv??'');
 saveText(filename,text,'text/csv;charset=utf-8');
}
