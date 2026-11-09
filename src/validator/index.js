export function validate(source,results,profile='demand'){
 const errors=[],warnings=[];
 const required=profile==='inventory'?['date','sku_id','demand_qty','inventory_on_hand','inbound_qty','location_name','unit']:['date','sku_id','demand_qty'];
 const present=new Set(Object.keys(results.records[0]||{}));
 for(const k of required)if(!present.has(k))errors.push('Missing required mapping: '+k);
 const invalid=results.records.filter(r=>r.date&&!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date))).length;
 if(invalid)warnings.push(invalid+' dates are not canonical YYYY-MM-DD');
 const missing=results.records.filter(r=>required.some(k=>r[k]===null||r[k]===undefined||r[k]==='')).length;
 if(missing)errors.push(missing+' records contain missing required values');
 const negatives=results.records.filter(r=>typeof r.demand_qty==='number'&&r.demand_qty<0).length;
 if(negatives)warnings.push(negatives+' negative quantities detected (not modified)');
 const badQty=results.records.filter(r=>r.demand_qty!==''&&r.demand_qty!==undefined&&(!Number.isFinite(Number(r.demand_qty)))).length;
 if(badQty)errors.push(badQty+' quantities are not numeric');
 const inputRows=source.data.length, outputRows=results.records.length;
 if(inputRows&&outputRows/inputRows<.9)errors.push('More than 10% of input rows disappeared');
 const sum=a=>a.reduce((s,r)=>s+(Number.isFinite(Number(r.demand_qty))?Number(r.demand_qty):0),0);
 const sourceQtyIndex=Object.keys(source.mapping).find(k=>source.mapping[k]==='demand_qty');
 const originalSum=sourceQtyIndex===undefined?null:source.data.reduce((s,r)=>s+(Number.isFinite(Number(String(r[sourceQtyIndex]??'').replace(/,/g,'')))?Number(String(r[sourceQtyIndex]).replace(/,/g,'')):0),0);
 const transformedSum=sum(results.records);
 if(originalSum!==null&&Math.abs(originalSum-transformedSum)>1e-8)errors.push('Quantity totals changed unexpectedly');
 return {errors,warnings,stats:{inputRows,outputRows,changedCells:results.changes.length,originalSum,transformedSum}};
}
