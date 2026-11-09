export const fields=['sku_id','sku_name','date','demand_qty','inventory_on_hand','inbound_qty','outbound_qty','location_id','location_name','unit'];
const aliases={
sku_id:['sku','sku_id','商品コード','商品cd','商品番号','品番','item id','item code'],
sku_name:['sku_name','商品名称','商品名','品名','product'],
date:['date','日付','販売日','年月日','受注日','売上日'],
demand_qty:['demand','demand_qty','販売数量','販売数','需要数','数量'],
inventory_on_hand:['stock','在庫','現在庫','在庫数','inventory'],
inbound_qty:['inbound','入庫','入荷数'],
outbound_qty:['outbound','出庫','出荷数'],
location_id:['location_id','倉庫コード','拠点コード'],
location_name:['location','倉庫','拠点','店舗'],
unit:['unit','単位']
};
const norm=x=>String(x??'').trim().normalize('NFKC').toLowerCase().replace(/[ _-]/g,'');
export function detect(rows){
 const ranked=rows.slice(0,8).map((r,i)=>({i,score:r.filter(c=>Object.values(aliases).some(v=>v.some(a=>norm(a)===norm(c)))).length})).sort((a,b)=>b.score-a.score);
 const headerRow=ranked[0]?.score?ranked[0].i:0;
 const header=rows[headerRow]||[];
 const data=rows.slice(headerRow+1).filter(r=>r.some(v=>String(v??'').trim()!==''));
 const mapping={}; const confidence={};
 header.forEach((h,i)=>{const hits=fields.filter(f=>aliases[f].some(a=>norm(a)===norm(h)));if(hits.length===1){mapping[i]=hits[0];confidence[i]=0.95;}else{mapping[i]='';confidence[i]=0;}});
 const dateColumns=header.filter(h=>/^\d{4}[-/]\d{1,2}([-/]\d{1,2})?$/.test(String(h))).length;
 const warnings=[];
 if(dateColumns>=2)warnings.push('Wide-format date columns detected. Automatic pivot is not supported in this first version.');
 if(!ranked[0]?.score)warnings.push('Header row was not confidently detected. Check manually.');
 return {headerRow,header,data,mapping,confidence,warnings,orientation:dateColumns>=2?'wide':'long'};
}
