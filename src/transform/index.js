import {fields} from '../detector/index.js';
const dateValue=v=>{
 if(v instanceof Date&&!isNaN(v))return v.toISOString().slice(0,10);
 const s=String(v??'').trim().normalize('NFKC');
 const m=s.match(/^(\d{4})[\/年.-](\d{1,2})[\/月.-](\d{1,2})日?$/);
 if(!m)return s;
 const y=+m[1],mo=+m[2],d=+m[3];const dt=new Date(Date.UTC(y,mo-1,d));
 if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==mo-1||dt.getUTCDate()!==d)return s;
 return [y,String(mo).padStart(2,'0'),String(d).padStart(2,'0')].join('-');
};
export function transform(detected,mapping,options={}){
 const {trim=true,width=true,dates=true,sourceFile='',sourceSheet=''}=options;
 const changes=[];const records=detected.data.map((row,index)=>{
   const out={
     source_file:sourceFile,
     source_sheet:sourceSheet,
     source_row:detected.headerRow+index+2
   };
   for(const [i,field] of Object.entries(mapping)){
     if(!fields.includes(field))continue;
     let value=row[Number(i)]??'';
     const before=value;
     if(typeof value==='string'&&trim)value=value.trim();
     if(typeof value==='string'&&width)value=value.normalize('NFKC');
     if(['date','period_start','period_end'].includes(field)&&dates)value=dateValue(value);
     if(['demand_qty','inventory_on_hand','inbound_qty','outbound_qty','lead_time_days'].includes(field)&&value!==''){
       const n=Number(String(value).replace(/,/g,''));if(Number.isFinite(n))value=n;
     }
     out[field]=value;
     if(String(before)!==String(value))changes.push({row:out.source_row,field,before,after:value});
   }
   return out;
 });
 return {records,changes};
}
export const exportFields={inventory:['date','sku_id','demand_qty','inventory_on_hand','inbound_qty','location_name','unit'],generic:fields};
