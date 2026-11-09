import readXlsxFile from 'read-excel-file/browser';
import { parseCSV } from './csv.js';
export async function readWorkbook(file){
  if(!file)throw new Error('Select a file');
  const ext=file.name.toLowerCase().split('.').pop();
  if(file.size>15*1024*1024)throw new Error('File exceeds the 15 MB safety limit');
  if(ext==='csv'||ext==='tsv'){
    const bytes=await file.arrayBuffer();
    let text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    const sep=ext==='tsv'?'\t':undefined;
    return [{name:'CSV',rows:parseCSV(text,sep)}];
  }
  if(ext==='xlsx'){
    const sheets=await readXlsxFile(file,{getSheets:true});
    const result=[];
    for(const s of sheets){const rows=await readXlsxFile(file,{sheet:s.name});result.push({name:s.name,rows:rows.map(r=>r.map(x=>x instanceof Date?x.toISOString().slice(0,10):x??''))});}
    return result;
  }
  throw new Error('Only .csv, .tsv and .xlsx are supported');
}
