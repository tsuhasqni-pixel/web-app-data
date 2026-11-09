const isBlank=v=>v===null||v===undefined||String(v).trim()==='';
const hasOuterWhitespace=v=>typeof v==='string'&&v!==v.trim();
const hasFullWidth=v=>typeof v==='string'&&v.normalize('NFKC')!==v;
const looksNumericText=v=>typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v.trim().replace(/,/g,'')))&&/[０-９,]/.test(v);
const stableRow=r=>JSON.stringify(r.map(v=>v??''));

export function diagnoseCleaning(rows,{headerRow=0}={}){
  const data=rows.slice(headerRow+1);
  const width=Math.max(0,...rows.map(r=>r.length));
  let blanks=0,outerWhitespace=0,fullWidth=0,numericText=0;
  const seen=new Set();let duplicateRows=0;
  for(const row of data){
    const key=stableRow(row);
    if(seen.has(key))duplicateRows++; else seen.add(key);
    for(let i=0;i<width;i++){
      const v=row[i]??'';
      if(isBlank(v))blanks++;
      if(hasOuterWhitespace(v))outerWhitespace++;
      if(hasFullWidth(v))fullWidth++;
      if(looksNumericText(v))numericText++;
    }
  }
  const suggestions=[];
  if(outerWhitespace)suggestions.push({kind:'safe',rule:'trim',count:outerWhitespace,title:'前後空白の除去',reason:'前後の空白があるセルを検出しました。値の意味を変えず比較・集計しやすくできます。'});
  if(fullWidth)suggestions.push({kind:'safe',rule:'normalize_width',count:fullWidth,title:'全角・半角の統一候補',reason:'表記幅が異なるセルを検出しました。NFKC正規化をプレビューできます。'});
  if(numericText)suggestions.push({kind:'review',rule:'numeric_text',count:numericText,title:'数値文字列の確認',reason:'数値として扱えそうな文字列があります。単位付き文字列は自動変換せず確認します。'});
  if(blanks)suggestions.push({kind:'review',rule:'blank',count:blanks,title:'空欄の確認',reason:'空欄を検出しました。0・欠損・未入力の意味が不明なため自動補完しません。'});
  if(duplicateRows)suggestions.push({kind:'review',rule:'duplicate',count:duplicateRows,title:'完全重複行の確認',reason:'同一行を検出しました。正当な重複の可能性があるため自動削除しません。'});
  return {rows:data.length,columns:width,blanks,outerWhitespace,fullWidth,numericText,duplicateRows,suggestions};
}

export function cleanRawTable(rows,{headerRow=0,trim=true,width=true,removeExactDuplicates=false}={}){
  const header=(rows[headerRow]||[]).map(v=>String(v??''));
  const source=rows.slice(headerRow+1);
  const changes=[];const seen=new Set();let removedDuplicates=0;
  const cleaned=[];
  source.forEach((row,rowIndex)=>{
    const next=row.map((raw,colIndex)=>{
      let value=raw??'';const before=value;
      if(typeof value==='string'&&trim)value=value.trim();
      if(typeof value==='string'&&width)value=value.normalize('NFKC');
      if(String(before)!==String(value))changes.push({source_row:headerRow+rowIndex+2,column:header[colIndex]||('column_'+(colIndex+1)),before,after:value});
      return value;
    });
    const key=stableRow(next);
    if(removeExactDuplicates&&seen.has(key)){removedDuplicates++;return;}
    seen.add(key);cleaned.push(next);
  });
  return {header,rows:cleaned,changes,removedDuplicates,inputRows:source.length,outputRows:cleaned.length};
}
