import {detect} from '../detector/index.js';
import {diagnoseCleaning,cleanRawTable} from '../cleaner/index.js';

export const BATCH_LIMITS={maxSheets:20,maxTotalRows:100000};

export function diagnoseWorkbook(sheets){
  return sheets.map((sheet,index)=>{
    const analysis=detect(sheet.rows);
    return {index,name:sheet.name,sourceFile:sheet.sourceFile||'',analysis,diagnosis:diagnoseCleaning(sheet.rows,{headerRow:analysis.headerRow})};
  });
}

export function cleanWorkbook(sheets,selectedIndexes,options={}){
  const indexes=[...new Set(selectedIndexes.map(Number))].filter(i=>Number.isInteger(i)&&i>=0&&i<sheets.length);
  if(!indexes.length)throw new Error('処理するシートを1つ以上選択してください');
  if(indexes.length>BATCH_LIMITS.maxSheets)throw new Error('一度に処理できるシートは'+BATCH_LIMITS.maxSheets+'個までです');
  const totalRows=indexes.reduce((n,i)=>n+sheets[i].rows.length,0);
  if(totalRows>BATCH_LIMITS.maxTotalRows)throw new Error('選択シートの合計行数が安全上限 '+BATCH_LIMITS.maxTotalRows.toLocaleString()+' 行を超えています');
  return indexes.map(i=>{
    const sheet=sheets[i];const analysis=detect(sheet.rows);
    const diagnosis=diagnoseCleaning(sheet.rows,{headerRow:analysis.headerRow});
    const cleaned=cleanRawTable(sheet.rows,{headerRow:analysis.headerRow,...options});
    return {index:i,name:sheet.name,sourceFile:sheet.sourceFile||'',analysis,diagnosis,cleaned};
  });
}
