import {toCSV} from '../parser/csv.js';
import {exportFields} from '../transform/index.js';
export function exportCSV(records,profile){
 const keys=exportFields[profile];if(!keys)throw new Error('Unknown profile');
 return toCSV([keys,...records.map(row=>keys.map(k=>row[k]??''))]);
}
export function saveText(filename,text,mime='text/plain'){
 const blob=new Blob([text],{type:mime});const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=filename;a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
