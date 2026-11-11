import {suggestMappings,headerMatchScore} from '../mapper/index.js';

export const fields=[
  'sku_id','sku_name','date','period_start','period_end','frequency',
  'demand_qty','inventory_on_hand','inbound_qty','outbound_qty',
  'location_id','location_name','unit','lead_time_days',
  'category','flow_type','description',
  'account_code','account_name','amount','debit','credit','statement_section'
];

const dateHeader=x=>/^\d{4}[-/]\d{1,2}(?:[-/]\d{1,2})?$/.test(String(x??'').trim());
const blank=v=>v===null||v===undefined||String(v).trim()==='';
const numeric=v=>!blank(v)&&Number.isFinite(Number(String(v).trim().replace(/,/g,'')));
const dateLike=v=>{
 if(blank(v))return false;
 if(v instanceof Date&&!Number.isNaN(v.getTime()))return true;
 const s=String(v).trim().normalize('NFKC');
 return /^\d{4}[\/年.-]\d{1,2}(?:[\/月.-]\d{1,2}日?)?$/.test(s);
};
export function profileColumns(header,data){
 return header.map((name,i)=>{
   const values=data.map(r=>r[i]).filter(v=>!blank(v));
   const total=data.length||1;
   const nonNull=values.length;
   const numericCount=values.filter(numeric).length;
   const dateCount=values.filter(dateLike).length;
   const uniqueCount=new Set(values.map(v=>String(v))).size;
   let inferredType='text';
   if(nonNull===0)inferredType='empty';
   else if(numericCount/nonNull>=0.9)inferredType='number';
   else if(dateCount/nonNull>=0.9)inferredType='date';
   else if(uniqueCount===nonNull&&nonNull>=2)inferredType='identifier_or_text';
   return {
     index:i,name:String(name??''),inferredType,
     nonNullRate:nonNull/total,
     numericRate:nonNull?numericCount/nonNull:0,
     dateRate:nonNull?dateCount/nonNull:0,
     uniqueRate:nonNull?uniqueCount/nonNull:0
   };
 });
}
export function detect(rows){
 const ranked=rows.slice(0,8).map((r,i)=>({i,score:headerMatchScore(r)})).sort((a,b)=>b.score-a.score);
 const headerRow=ranked[0]?.score?ranked[0].i:0;
 const header=rows[headerRow]||[];
 const data=rows.slice(headerRow+1).filter(r=>r.some(v=>String(v??'').trim()!==''));
 const {mapping,confidence}=suggestMappings(header,fields);
 const dateColumns=header.filter(dateHeader).length;
 const warnings=[];
 if(dateColumns>=2)warnings.push('横持ちの日付・期間列を検出しました。自動判定を使うか、形式を手動指定できます。');
 if(!ranked[0]?.score)warnings.push('ヘッダー行の自動判定に十分な確信がありません。手動確認してください。');
 return {headerRow,header,data,mapping,confidence,warnings,orientation:dateColumns>=2?'wide':'long',columnProfiles:profileColumns(header,data)};
}
