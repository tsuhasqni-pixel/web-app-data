import {readWorkbook} from './parser/index.js';
import {detect,fields} from './detector/index.js';
import {transform} from './transform/index.js';
import {validate} from './validator/index.js';
import {exportCSV,saveText} from './exporter/index.js';
import './style.css';

const app=document.querySelector('#app');
let sheets=[],selected=null,analysis=null,result=null,report=null;
let recipe=null, profile='demand', options={trim:true,width:true,dates:true};
function el(tag,text,parent,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;(parent||app).appendChild(e);return e;}
function button(text,onClick,parent){const b=el('button',text,parent);b.type='button';b.addEventListener('click',onClick);return b;}
function select(values,value,onChange,parent){const e=el('select',undefined,parent);for(const [v,t] of values){const o=el('option',t,e);o.value=v;}e.value=value;e.addEventListener('change',()=>onChange(e.value));return e;}
function section(title){const s=el('section');el('h2',title,s);return s;}
function status(text){const s=el('p',text,app,'status');return s;}
function render(){
 app.replaceChildren();el('h1','Data Shaper',app);el('p','企業のCSV / XLSXを、ファイルを送信せずブラウザ内で診断・整形します。',app,'subtitle');
 const f=section('1. ファイル選択 / Inspect');
 const input=el('input',undefined,f);input.type='file';input.accept='.csv,.tsv,.xlsx';input.addEventListener('change',async()=>{
 try{sheets=await readWorkbook(input.files[0]);selected=sheets[0];analysis=detect(selected.rows);result=null;report=null;recipe=null;render();}
 catch(err){alert('読み込み失敗: '+err.message);}
 });
 if(!sheets.length){status('処理対象のファイルを選択してください。最大15 MB。UTF-8 CSV / TSV、XLSXに対応。');return;}
 el('span','シート: ',f);
 select(sheets.map((s,i)=>[String(i),s.name]),String(sheets.indexOf(selected)),i=>{selected=sheets[Number(i)];analysis=detect(selected.rows);result=null;report=null;render();},f);
 el('p',selected.rows.length+' 行 / '+Math.max(0,...selected.rows.map(r=>r.length))+' 列',f);
 const s=section('2. 構造診断 / Detect');
 const label=el('label','ヘッダー行（1始まり）',s);
 const header=el('input',undefined,label);header.type='number';header.min='1';header.max=String(selected.rows.length);header.value=String(analysis.headerRow+1);
 button('ヘッダー位置を適用',()=>{const i=Number(header.value)-1;if(!Number.isInteger(i)||i<0||i>=selected.rows.length)return alert('無効な行番号です');analysis=detect(selected.rows.slice(i));analysis.headerRow+=i;analysis.data=selected.rows.slice(i+1).filter(r=>r.some(v=>String(v??'').trim()!==''));result=null;report=null;render();},s);
 el('p','推定形式: '+(analysis.orientation==='wide'?'横持ち（自動変換不可）':'縦持ち')+' / データ行数: '+analysis.data.length,s);
 for(const w of analysis.warnings)el('p','注意: '+w,s,'warning');
 const m=section('3. 列の対応 / Map & Confirm');
 const table=el('table',undefined,m);const tr=el('tr',undefined,table);['元の列名','出力フィールド','推定信頼度'].forEach(t=>el('th',t,tr));
 analysis.header.forEach((h,i)=>{const row=el('tr',undefined,table);el('td',String(h??'(空欄)'),row);const cell=el('td',undefined,row);
 select([['','使用しない'],...fields.map(x=>[x,x])],analysis.mapping[i]||'',v=>{analysis.mapping[i]=v;result=null;report=null;},cell);
 el('td',analysis.confidence[i]?Math.round(analysis.confidence[i]*100)+'%':'手動確認',row);});
 const r=section('4. 整形ルール / Transform');
 [['trim','前後空白を除く'],['width','文字幅を統一 (NFKC)'],['dates','日付表記を統一']].forEach(([key,text])=>{const label=el('label',undefined,r,'check');const c=el('input',undefined,label);c.type='checkbox';c.checked=options[key];c.addEventListener('change',()=>{options[key]=c.checked;result=null;report=null;});el('span',text,label);});
 button('変換プレビューと品質検査を実行',()=>{result=transform(analysis,analysis.mapping,options);report=validate(analysis,result,profile);render();},r);
 const p=section('5. 出力形式 / Validate & Export');
 select([['demand','DemandScope (long CSV)'],['inventory','Inventory Manager CSV'],['generic','Generic Clean CSV']],profile,v=>{profile=v;if(result)report=validate(analysis,result,profile);render();},p);
 if(!result){el('p','上のボタンで確認用プレビューを生成してください。',p);return;}
 el('p','入力 '+report.stats.inputRows+' 行 / 出力 '+report.stats.outputRows+' 行 / 変更セル '+report.stats.changedCells+' 件',p);
 el('p','数量合計（変換前 / 後）: '+String(report.stats.originalSum??'未検出')+' / '+report.stats.transformedSum,p);
 [...report.errors.map(x=>'エラー: '+x),...report.warnings.map(x=>'注意: '+x)].forEach(t=>el('p',t,p,t.startsWith('エラー')?'error':'warning'));
 const preview=el('div',undefined,p,'preview');const tbl=el('table',undefined,preview);
 const headers=['source_row',...new Set(result.records.flatMap(x=>Object.keys(x)))].filter((x,i,a)=>a.indexOf(x)===i);
 const hr=el('tr',undefined,tbl);headers.forEach(x=>el('th',x,hr));
 result.records.slice(0,15).forEach(rec=>{const row=el('tr',undefined,tbl);headers.forEach(h=>el('td',String(rec[h]??''),row));});
 el('p','Before / After 変更例（最大15件）',p);
 const diff=el('table',undefined,p);const head=el('tr',undefined,diff);['行','フィールド','Before','After'].forEach(t=>el('th',t,head));
 result.changes.slice(0,15).forEach(c=>{const row=el('tr',undefined,diff);[c.row,c.field,c.before,c.after].forEach(v=>el('td',String(v??''),row));});
 button('変換ルール Recipe JSON を保存',()=>{
 const out={schema_version:1,header_row:analysis.headerRow+1,source_headers:analysis.header,mapping:analysis.mapping,options,profile};
 saveText('data-shaper-recipe.json',JSON.stringify(out,null,2),'application/json');
 },p);
 const recInput=el('input',undefined,p);recInput.type='file';recInput.accept='.json';recInput.setAttribute('aria-label','Recipe JSONを読み込む');recInput.addEventListener('change',async()=>{
 try{const x=JSON.parse(await recInput.files[0].text());if(x.schema_version!==1||!Array.isArray(x.source_headers)||JSON.stringify(x.source_headers)!==JSON.stringify(analysis.header))throw new Error('列構造が一致しないためRecipeを適用しません');
 if(!x.mapping||Object.values(x.mapping).some(v=>v&&!fields.includes(v)))throw new Error('Invalid mapping');
 analysis.mapping={...x.mapping};options={trim:!!x.options?.trim,width:!!x.options?.width,dates:!!x.options?.dates};profile=['demand','inventory','generic'].includes(x.profile)?x.profile:'demand';result=null;report=null;render();
 }catch(e){alert('Recipe適用不可: '+e.message);}
 });
 const exportButton=button('品質検査済みCSVを出力',()=>saveText('data-shaper-'+profile+'.csv',exportCSV(result.records,profile),'text/csv;charset=utf-8'),p);
 exportButton.disabled=report.errors.length>0||analysis.orientation==='wide';
 if(exportButton.disabled)el('p','安全検査が未通過です。列マッピングとデータを確認してください。',p,'error');
 else if(report.warnings.length)el('p','警告を確認したうえで出力してください。',p,'warning');
}
render();
