export const fieldAliases={
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
export const normalizeLabel=x=>String(x??'').trim().normalize('NFKC').toLowerCase().replace(/[ _-]/g,'');
export function suggestMappings(header,fields){
 const mapping={},confidence={};
 header.forEach((h,i)=>{
   const hits=fields.filter(f=>fieldAliases[f]?.some(a=>normalizeLabel(a)===normalizeLabel(h)));
   if(hits.length===1){mapping[i]=hits[0];confidence[i]=0.95;}
   else {mapping[i]='';confidence[i]=0;}
 });
 return {mapping,confidence};
}
export function headerMatchScore(row){
 return row.filter(c=>Object.values(fieldAliases).some(v=>v.some(a=>normalizeLabel(a)===normalizeLabel(c)))).length;
}
