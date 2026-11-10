const empty=v=>v===null||v===undefined||v==='';
const dateSort=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:null;
const uniq=a=>new Set(a.filter(v=>!empty(v)).map(v=>String(v))).size;
const nulls=(records,keys)=>records.reduce((n,r)=>n+keys.reduce((m,k)=>m+(empty(r[k])?1:0),0),0);
export function validate(source,results,profile='demand'){
 const errors=[],warnings=[];
 const records=results.records;
 const present=new Set(records.flatMap(r=>Object.keys(r)));
 const hasSku=present.has('sku_id')||present.has('sku_name');
 const hasTime=present.has('date')||present.has('period_start');
 if(profile==='demand'){
   if(!hasSku)errors.push('Missing required mapping: sku_id or sku_name');
   if(!hasTime)errors.push('Missing required mapping: date or period_start');
   if(!present.has('demand_qty'))errors.push('Missing required mapping: demand_qty');
 } else if(profile==='inventory'){
   for(const k of ['sku_id','date','demand_qty','inventory_on_hand','inbound_qty','location_name','unit']){
     if(!present.has(k))errors.push('Missing required mapping: '+k);
   }
 }
 const invalid=records.filter(r=>r.date&&!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date))).length;
 if(invalid)warnings.push(invalid+' dates are not canonical YYYY-MM-DD');
 if(profile==='demand'||profile==='inventory'){
   const missing=records.filter(r=>{
     const skuMissing=profile==='demand' ? !(r.sku_id||r.sku_name) : !r.sku_id;
     const timeMissing=profile==='demand' ? !(r.date||r.period_start) : !r.date;
     const qtyMissing=empty(r.demand_qty);
     if(profile==='inventory') return skuMissing||timeMissing||qtyMissing||empty(r.inventory_on_hand)||empty(r.inbound_qty)||!r.location_name||!r.unit;
     return skuMissing||timeMissing||qtyMissing;
   }).length;
   if(missing)errors.push(missing+' records contain missing required values');
 }
 const negatives=records.filter(r=>typeof r.demand_qty==='number'&&r.demand_qty<0).length;
 if(negatives)warnings.push(negatives+' negative quantities detected (not modified)');
 const badQty=records.filter(r=>r.demand_qty!==''&&r.demand_qty!==undefined&&(!Number.isFinite(Number(r.demand_qty)))).length;
 if(badQty)errors.push(badQty+' quantities are not numeric');
 const inputRows=source.data.length, outputRows=records.length;
 if(inputRows&&outputRows/inputRows<.9&&profile!=='generic')warnings.push('Output row count is more than 10% below input; verify the transformation mode');
 const sum=a=>a.reduce((s,r)=>s+(Number.isFinite(Number(r.demand_qty))?Number(r.demand_qty):0),0);
 const sourceQtyIndex=Object.keys(source.mapping).find(k=>source.mapping[k]==='demand_qty');
 const originalSum=sourceQtyIndex===undefined?null:source.data.reduce((s,r)=>s+(Number.isFinite(Number(String(r[sourceQtyIndex]??'').replace(/,/g,'')))?Number(String(r[sourceQtyIndex]).replace(/,/g,'')):0),0);
 const transformedSum=sum(records);
 if(originalSum!==null&&profile!=='generic'&&!results.wide&&Math.abs(originalSum-transformedSum)>1e-8)errors.push('Quantity totals changed unexpectedly');

 const sourceSkuIndex=Object.keys(source.mapping).find(k=>['sku_id','sku_name'].includes(source.mapping[k]));
 const sourceDateIndex=Object.keys(source.mapping).find(k=>['date','period_start'].includes(source.mapping[k]));
 const sourceMappedIndexes=Object.keys(source.mapping).filter(k=>source.mapping[k]).map(Number);
 const inputUniqueSku=sourceSkuIndex===undefined?null:uniq(source.data.map(r=>r[Number(sourceSkuIndex)]));
 const outputUniqueSku=uniq(records.map(r=>r.sku_id||r.sku_name));
 const inputNullCount=sourceMappedIndexes.length?source.data.reduce((n,r)=>n+sourceMappedIndexes.reduce((m,i)=>m+(empty(r[i])?1:0),0),0):null;
 const outputMappedKeys=[...new Set(Object.values(source.mapping).filter(Boolean))];
 const outputNullCount=outputMappedKeys.length?nulls(records,outputMappedKeys):null;
 const sourceDates=sourceDateIndex===undefined?[]:source.data.map(r=>dateSort(String(r[Number(sourceDateIndex)]??''))).filter(Boolean).sort();
 const outputDates=records.map(r=>dateSort(r.date||r.period_start)).filter(Boolean).sort();
 const inputDateMin=sourceDates[0]||null,inputDateMax=sourceDates.at(-1)||null;
 const outputDateMin=outputDates[0]||null,outputDateMax=outputDates.at(-1)||null;
 if(inputUniqueSku!==null&&outputUniqueSku<inputUniqueSku&&profile!=='generic')warnings.push('Unique SKU count decreased from '+inputUniqueSku+' to '+outputUniqueSku);
 if(inputNullCount!==null&&outputNullCount!==null&&outputNullCount>inputNullCount)warnings.push('Mapped-field null count increased from '+inputNullCount+' to '+outputNullCount);

 return {errors,warnings,stats:{
   inputRows,outputRows,changedCells:results.changes.length,originalSum,transformedSum,
   inputUniqueSku,outputUniqueSku,inputNullCount,outputNullCount,
   inputDateMin,inputDateMax,outputDateMin,outputDateMax
 }};
}
