export const fields=[
  'sku_id','sku_name','date','period_start','period_end','frequency',
  'demand_qty','inventory_on_hand','inbound_qty','outbound_qty',
  'location_id','location_name','unit','lead_time_days',
  'account_code','account_name','amount','debit','credit','statement_section'
];
const aliases={
sku_id:['sku','sku_id','商品コード','商品cd','商品番号','品番','item id','item code'],
sku_name:['sku_name','商品名称','商品名','品名','product','product name'],
date:['date','日付','販売日','年月日','受注日','売上日'],
period_start:['period_start','期間開始','開始日'],
period_end:['period_end','期間終了','終了日'],
frequency:['frequency','頻度','周期'],
demand_qty:['demand','demand_qty','販売数量','販売数','需要数','数量'],
inventory_on_hand:['stock','在庫','現在庫','在庫数','inventory'],
inbound_qty:['inbound','入庫','入荷数'],
outbound_qty:['outbound','出庫','出荷数'],
location_id:['location_id','倉庫コード','拠点コード'],
location_name:['location','倉庫','拠点','店舗'],
unit:['unit','単位'],
lead_time_days:['lead_time_days','lead time','リードタイム','リードタイム日数'],
account_code:['account_code','勘定科目コード','科目コード','account id'],
account_name:['account','account_name','勘定科目','科目名','科目'],
amount:['amount','金額','残高','balance','value'],
debit:['debit','借方','借方金額'],
credit:['credit','貸方','貸方金額'],
statement_section:['statement_section','区分','分類','表示区分']
};
const norm=x=>String(x??'').trim().normalize('NFKC').toLowerCase().replace(/[ _-]/g,'');
const dateHeader=x=>/^\d{4}[-/]\d{1,2}(?:[-/]\d{1,2})?$/.test(String(x??'').trim());
export function detect(rows){
 const ranked=rows.slice(0,8).map((r,i)=>({i,score:r.filter(c=>Object.values(aliases).some(v=>v.some(a=>norm(a)===norm(c)))).length})).sort((a,b)=>b.score-a.score);
 const headerRow=ranked[0]?.score?ranked[0].i:0;
 const header=rows[headerRow]||[];
 const data=rows.slice(headerRow+1).filter(r=>r.some(v=>String(v??'').trim()!==''));
 const mapping={}; const confidence={};
 header.forEach((h,i)=>{
   const hits=fields.filter(f=>aliases[f]?.some(a=>norm(a)===norm(h)));
   if(hits.length===1){mapping[i]=hits[0];confidence[i]=0.95;}else{mapping[i]='';confidence[i]=0;}
 });
 const dateColumns=header.filter(dateHeader).length;
 const warnings=[];
 if(dateColumns>=2)warnings.push('横持ちの日付・期間列を検出しました。自動判定を使うか、形式を手動指定できます。');
 if(!ranked[0]?.score)warnings.push('ヘッダー行の自動判定に十分な確信がありません。手動確認してください。');
 return {headerRow,header,data,mapping,confidence,warnings,orientation:dateColumns>=2?'wide':'long'};
}
