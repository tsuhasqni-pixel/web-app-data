import readXlsxFile from 'read-excel-file';
import { parseCSV } from './csv.js';

export const WORKBOOK_LIMITS={maxBytes:15*1024*1024,maxSheets:20,maxRows:100000,maxCells:2000000};
function assertShape(rows,{totalRows=0,totalCells=0}={}){
  const rowCount=Array.isArray(rows)?rows.length:0;
  const cells=(rows||[]).reduce((n,r)=>n+(Array.isArray(r)?r.length:0),0);
  if(totalRows+rowCount>WORKBOOK_LIMITS.maxRows)throw new Error('Workbook exceeds the 100,000 row safety limit');
  if(totalCells+cells>WORKBOOK_LIMITS.maxCells)throw new Error('Workbook exceeds the 2,000,000 cell safety limit');
  return {rows:totalRows+rowCount,cells:totalCells+cells};
}
export async function readWorkbook(file){
  if(!file)throw new Error('Select a file');
  const ext=file.name.toLowerCase().split('.').pop();
  if(file.size>WORKBOOK_LIMITS.maxBytes)throw new Error('File exceeds the 15 MB safety limit');
  if(ext==='csv'||ext==='tsv'){
    const bytes=await file.arrayBuffer();
    let text;
    try {
      text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    } catch {
      throw new Error('UTF-8 decoding failed. Shift-JIS is not silently guessed in this MVP; convert the file to UTF-8 or use XLSX.');
    }
    const sep=ext==='tsv'?'\t':undefined;
    return [{name:'CSV',sourceFile:file.name,rows:parseCSV(text,sep)}];
  }
  if(ext==='xlsx'){
    const sheets=await readXlsxFile(file,{getSheets:true});
    if(sheets.length>WORKBOOK_LIMITS.maxSheets)throw new Error('Workbook exceeds the 20 sheet safety limit');
    const result=[];let totals={rows:0,cells:0};
    for(const s of sheets){
      const rows=await readXlsxFile(file,{sheet:s.name});
      totals=assertShape(rows,{totalRows:totals.rows,totalCells:totals.cells});
      result.push({
        name:s.name,
        sourceFile:file.name,
        rows:rows.map(r=>r.map(x=>x instanceof Date?x.toISOString().slice(0,10):x??''))
      });
    }
    return result;
  }
  throw new Error('Only .csv, .tsv and .xlsx are supported');
}
