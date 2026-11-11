export function parseCSV(text, delimiter) {
  const sample = String(text).replace(/^\uFEFF/, '');
  const sep = delimiter || (sample.slice(0,4096).split(/\r?\n/)[0].split('\t').length > sample.slice(0,4096).split(/\r?\n/)[0].split(',').length ? '\t' : ',');
  let rows=[], row=[], field='', quote=false;
  for(let i=0;i<sample.length;i++){
    const c=sample[i];
    if(quote){if(c==='"'&&sample[i+1]==='"'){field+='"';i++;}else if(c==='"'){quote=false;}else field+=c;}
    else if(c==='"'&&field===''){quote=true;}
    else if(c===sep){row.push(field);field='';}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&sample[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field='';}
    else field+=c;
  }
  if(quote)throw new Error('CSV has an unclosed quoted field');
  if(field!==''||row.length){row.push(field);rows.push(row);}
  return rows;
}
export function toDelimited(rows,delimiter=','){
  const sep=String(delimiter||',');
  return rows.map(r=>r.map(v=>{
    const s=String(v??'');
    const needsQuote=s.includes('"')||s.includes('\r')||s.includes('\n')||s.includes(sep);
    return needsQuote?'"'+s.replace(/"/g,'""')+'"':s;
  }).join(sep)).join('\r\n')+'\r\n';
}
export function toCSV(rows){
  return toDelimited(rows,',');
}
