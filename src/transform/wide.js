const dateHeader=s=>/^\d{4}[-/]\d{1,2}(?:[-/]\d{1,2})?$/.test(String(s??'').trim());
const monthHeader=s=>/^\d{4}[-/]\d{1,2}$/.test(String(s??'').trim());
const normalizeDateHeader=s=>{
 const x=String(s).trim().replace(/\//g,'-');
 const p=x.split('-');
 if(p.length===3)return [p[0],String(+p[1]).padStart(2,'0'),String(+p[2]).padStart(2,'0')].join('-');
 return x;
};
export function wideToLong(detected,mapping,{valueField='demand_qty',sourceFile='',sourceSheet=''}={}){
 const dateCols=detected.header.map((h,i)=>dateHeader(h)?i:null).filter(i=>i!==null);
 if(dateCols.length<1)throw new Error('横持ちとして扱える日付・期間列が見つかりません');
 const identityEntries=Object.entries(mapping).filter(([i,f])=>f&& !dateCols.includes(Number(i)));
 const records=[];
 detected.data.forEach((row,rowIndex)=>{
   for(const i of dateCols){
     const raw=row[i]??'';
     if(raw==='')continue;
     const n=Number(String(raw).replace(/,/g,''));
     const rec={source_file:sourceFile,source_sheet:sourceSheet,source_row:detected.headerRow+rowIndex+2};
     for(const [idx,field] of identityEntries)rec[field]=row[Number(idx)]??'';
     const h=String(detected.header[i]);
     if(monthHeader(h)&&h.split(/[-/]/).length===2){
       const [y,m]=h.split(/[-/]/);rec.period_start=y+'-'+String(+m).padStart(2,'0')+'-01';rec.frequency='monthly';
     }else rec.date=normalizeDateHeader(h);
     rec[valueField]=Number.isFinite(n)?n:raw;
     records.push(rec);
   }
 });
 return {records,changes:[],wide:{dateColumns:dateCols.length,valueField}};
}
