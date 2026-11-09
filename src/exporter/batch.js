import {zipSync,strToU8} from 'fflate';
import {toCSV} from '../parser/csv.js';

const safeName=name=>String(name||'sheet').replace(/[\\/:*?"<>|]/g,'_').slice(0,80)||'sheet';

export function buildCleaningZip(batchResults){
  const files={};
  const report={schema_version:1,generated_at:new Date().toISOString(),sheets:[]};
  for(const item of batchResults){
    const csv=toCSV([item.cleaned.header,...item.cleaned.rows]);
    files[safeName(item.name)+'.csv']=strToU8(csv);
    report.sheets.push({
      name:item.name,
      input_rows:item.cleaned.inputRows,
      output_rows:item.cleaned.outputRows,
      changed_cells:item.cleaned.changes.length,
      removed_duplicates:item.cleaned.removedDuplicates,
      diagnosis:item.diagnosis
    });
  }
  files['cleaning-report.json']=strToU8(JSON.stringify(report,null,2));
  return new Blob([zipSync(files,{level:6})],{type:'application/zip'});
}

export function saveBlob(filename,blob){
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
