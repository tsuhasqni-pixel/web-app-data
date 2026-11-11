const escapeHtml=value=>String(value??'')
  .replaceAll('&','&amp;')
  .replaceAll('<','&lt;')
  .replaceAll('>','&gt;')
  .replaceAll('"','&quot;')
  .replaceAll("'","&#39;");

export function objectRowsToRows(rows){
  const list=Array.isArray(rows)?rows:[];
  const keys=[...new Set(list.flatMap(row=>Object.keys(row||{})))];
  return [keys,...list.map(row=>keys.map(key=>row?.[key]??''))];
}

export function openPrintReport({title='Data Shaper Report',rows=[],note='' }={}){
  if(typeof window==='undefined'||typeof window.open!=='function')throw new Error('PDF出力はブラウザで実行してください');
  const safeRows=Array.isArray(rows)?rows:[];
  const popup=window.open('','_blank');
  if(!popup)throw new Error('PDF出力ウィンドウを開けません。ポップアップを許可してください');
  try{popup.opener=null}catch{}
  const table=safeRows.map((row,index)=>{
    const tag=index===0?'th':'td';
    const cells=(Array.isArray(row)?row:[row]).map(cell=>`<${tag}>${escapeHtml(cell)}</${tag}>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  popup.document.open();
  popup.document.write(`<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page{size:A4;margin:14mm}
*{box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Yu Gothic","YuGothic",Meiryo,sans-serif;color:#17212b;margin:0}
h1{font-size:20px;margin:0 0 12px}
p{font-size:11px;line-height:1.55;color:#4b5d6c;white-space:pre-wrap}
table{width:100%;border-collapse:collapse;font-size:10px}
th,td{border:1px solid #cfd7df;padding:5px 6px;text-align:left;vertical-align:top;overflow-wrap:anywhere}
th{background:#eef3f7;font-weight:700}
.footer{margin-top:14px;font-size:9px;color:#6b7785}
@media print{button{display:none}}
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${note?`<p>${escapeHtml(note)}</p>`:''}
<table><tbody>${table}</tbody></table>
<p class="footer">Data Shaper — Local First report export</p>
<script>
window.addEventListener('load',()=>{setTimeout(()=>window.print(),120);});
<\/script>
</body>
</html>`);
  popup.document.close();
  return true;
}
