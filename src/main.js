import {readWorkbook} from './parser/index.js';
import {detect,fields} from './detector/index.js';
import {transform} from './transform/index.js';
import {validate} from './validator/index.js';
import {diagnoseCleaning,cleanRawTable} from './cleaner/index.js';
import {cleanWorkbook,BATCH_LIMITS} from './batch/index.js';
import {aggregateRecords,buildBalanceSheet,balanceSheetSections} from './aggregate/index.js';
import {exportCSV,exportObjectRows,exportBalanceSheet,saveText} from './exporter/index.js';
import {buildCleaningZip,saveBlob} from './exporter/batch.js';
import {buildRecipe,validateRecipe} from './recipe/index.js';
import './style.css';

const app=document.querySelector('#app');
let sheets=[],selected=null,analysis=null,result=null,report=null;
let workspaceTab='free';
let profile='demand',orientation='auto',wideValueField='demand_qty';
let options={trim:true,width:true,dates:true};
let aggregateConfig={group1:'',group2:'',valueField:'amount',method:'sum'};
let bsConfig={accountField:'account_name',amountField:'amount',assignments:{}};
let selectedBatchSheets=new Set(),batchResults=[];
let batchOptions={trim:true,width:true,removeExactDuplicates:false};

function el(tag,text,parent,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;(parent||app).appendChild(e);return e;}
function button(text,onClick,parent,cls){const b=el('button',text,parent,cls);b.type='button';b.addEventListener('click',onClick);return b;}
function select(values,value,onChange,parent){const e=el('select',undefined,parent);for(const [v,t] of values){const o=el('option',t,e);o.value=v;}e.value=value;e.addEventListener('change',()=>onChange(e.value));return e;}
function section(title,parent=app){const s=el('section',undefined,parent);el('h2',title,s);return s;}
function clearResult(){result=null;report=null;}
function setSelected(i){selected=sheets[Number(i)]||sheets[0];analysis=selected?detect(selected.rows):null;clearResult();bsConfig.assignments={};}
function recordFields(){if(!result)return [];return [...new Set(result.records.flatMap(r=>Object.keys(r)))].filter(x=>!['source_file','source_sheet','source_row'].includes(x));}
function renderTable(parent,rows,limit=15){
 if(!rows?.length){el('p','表示できるデータがありません。',parent,'status');return;}
 const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];
 const wrap=el('div',undefined,parent,'preview');const tbl=el('table',undefined,wrap);const hr=el('tr',undefined,tbl);keys.forEach(k=>el('th',k,hr));
 rows.slice(0,limit).forEach(rec=>{const row=el('tr',undefined,tbl);keys.forEach(k=>el('td',String(rec[k]??''),row));});
}
function checkbox(parent,label,checked,onChange){
 const l=el('label',undefined,parent,'check');const c=el('input',undefined,l);c.type='checkbox';c.checked=checked;c.addEventListener('change',()=>onChange(c.checked));el('span',label,l);return c;
}
function renderTabs(){
 const nav=el('div',undefined,app,'workspace-tabs');
 [
  ['free','無料診断'],
  ['pro','Proクリーニング'],
  ['aggregate','集計'],
  ['balance','決算書レイアウト']
 ].forEach(([id,label])=>{
   const b=button(label,()=>{workspaceTab=id;clearResult();render();},nav,'tab-button'+(workspaceTab===id?' active':''));
   b.setAttribute('aria-selected',String(workspaceTab===id));
 });
}
function renderUpload(parent){
 const s=section('ファイル',parent);
 const input=el('input',undefined,s);input.type='file';input.accept='.csv,.tsv,.xlsx';input.addEventListener('change',async()=>{
   try{
     sheets=await readWorkbook(input.files[0]);setSelected(0);selectedBatchSheets=new Set(sheets.map((_,i)=>i));batchResults=[];render();
   }catch(err){alert('読み込み失敗: '+err.message);}
 });
 if(!sheets.length){el('p','UTF-8 CSV / TSV、XLSXをブラウザ内で処理します。最大15 MB。',s,'status');return false;}
 el('span','シート: ',s);
 select(sheets.map((x,i)=>[String(i),x.name]),String(sheets.indexOf(selected)),v=>{setSelected(v);render();},s);
 el('p',sheets.length+' シート / 選択中「'+selected.name+'」 '+selected.rows.length+' 行',s,'status');
 return true;
}
function renderFree(){
 const wrap=el('div',undefined,app,'workspace-panel');
 el('p','無料版は「どこに問題があり、何を安全に直せるか」を診断して、クリーニング工程を見せるためのモードです。元データの意味が不明な変更は行いません。',wrap,'lead');
 if(!renderUpload(wrap))return;
 const d=diagnoseCleaning(selected.rows,{headerRow:analysis.headerRow});
 const s=section('無料クリーニング診断',wrap);
 const stats=el('div',undefined,s,'metric-grid');
 [['データ行',d.rows],['列',d.columns],['空欄',d.blanks],['前後空白',d.outerWhitespace],['全角/半角候補',d.fullWidth],['完全重複候補',d.duplicateRows]].forEach(([k,v])=>{const card=el('div',undefined,stats,'metric-card');el('strong',String(v),card);el('span',k,card);});
 const typeRows=(analysis.columnProfiles||[]).map(x=>({column:x.name||('column_'+(x.index+1)),type:x.inferredType,numeric_rate:Math.round(x.numericRate*100)+'%',date_rate:Math.round(x.dateRate*100)+'%',non_null_rate:Math.round(x.nonNullRate*100)+'%'}));
 el('h3','列型の推定',s);renderTable(s,typeRows,30);
 if(!d.suggestions.length)el('p','主要なクリーニング候補は検出されませんでした。',s,'status');
 d.suggestions.forEach(x=>{const card=el('div',undefined,s,'diagnostic-card '+(x.kind==='safe'?'safe':'review'));el('strong',x.title+'（'+x.count+'件）',card);el('p',x.reason,card);el('small',x.kind==='safe'?'安全寄りの候補：Before/Afterで確認':'要確認：意味を推測して自動変更しない',card);});
 const demo=cleanRawTable(selected.rows,{headerRow:analysis.headerRow,trim:true,width:true,removeExactDuplicates:false});
 const p=section('クリーニング工程プレビュー',wrap);
 el('p','無料版では「前後空白除去」「文字幅統一」の安全寄り処理だけを仮適用し、変更箇所を見せます。空欄補完・重複削除はしません。',p,'status');
 renderTable(p,demo.changes,20);
 if(!demo.changes.length)el('p','安全寄りルールで変更されるセルはありません。',p,'status');
 el('p','実ファイルへの一括適用・複数シート処理・出力はPro側の作業領域です。',p,'pro-note');
}
function renderBatchPro(parent){
 const s=section('Pro：複数シート一括クリーニング',parent);
 el('p','最大 '+BATCH_LIMITS.maxSheets+' シート、合計 '+BATCH_LIMITS.maxTotalRows.toLocaleString()+' 行までを1回のバッチとして処理します。原ファイルはアップロードしません。',s,'status');
 const list=el('div',undefined,s,'sheet-list');
 sheets.forEach((sheet,i)=>{
   const row=el('div',undefined,list,'sheet-row');
   const c=el('input',undefined,row);c.type='checkbox';c.checked=selectedBatchSheets.has(i);c.addEventListener('change',()=>{c.checked?selectedBatchSheets.add(i):selectedBatchSheets.delete(i);batchResults=[];});
   el('span',sheet.name+' — '+Math.max(0,sheet.rows.length-1)+' 行',row);
 });
 const opts=el('div',undefined,s,'option-row');
 checkbox(opts,'前後空白を除去',batchOptions.trim,v=>{batchOptions.trim=v;batchResults=[];});
 checkbox(opts,'全角/半角を統一',batchOptions.width,v=>{batchOptions.width=v;batchResults=[];});
 checkbox(opts,'完全重複行を削除（要確認）',batchOptions.removeExactDuplicates,v=>{batchOptions.removeExactDuplicates=v;batchResults=[];});
 if(batchOptions.removeExactDuplicates)el('p','完全一致でも正当な複数取引の可能性があります。削除ONは明示選択した場合だけ適用します。',s,'warning');
 button('選択シートを一括クリーニング',()=>{try{batchResults=cleanWorkbook(sheets,[...selectedBatchSheets],batchOptions);render();}catch(e){alert(e.message);}},s);
 if(batchResults.length){
   const summary=el('div',undefined,s,'batch-summary');
   batchResults.forEach(item=>{
     const card=el('div',undefined,summary,'batch-card');el('h4',item.name,card);
     el('p','入力 '+item.cleaned.inputRows+' → 出力 '+item.cleaned.outputRows+' 行 / 変更 '+item.cleaned.changes.length+' セル / 重複削除 '+item.cleaned.removedDuplicates+' 行',card);
     if(item.diagnosis.blanks)el('small','空欄 '+item.diagnosis.blanks+' 件は値を推測せず保持',card);
   });
   button('シート別CSV＋レポートをZIPで出力',()=>saveBlob('data-shaper-cleaned-tabs.zip',buildCleaningZip(batchResults)),s);
 }
}
function runTransform(){
 result=transform(analysis,analysis.mapping,{...options,sourceFile:selected.sourceFile||'',sourceSheet:selected.name||'',orientation,wideValueField});
 report=validate(analysis,result,workspaceTab==='pro'?profile:'generic');
}
function renderMappingWorkspace(parent){
 const s=section('選択シートの標準化設定',parent);
 const label=el('label','ヘッダー行（1始まり） ',s);const header=el('input',undefined,label);header.type='number';header.min='1';header.max=String(selected.rows.length);header.value=String(analysis.headerRow+1);
 button('ヘッダー位置を適用',()=>{const i=Number(header.value)-1;if(!Number.isInteger(i)||i<0||i>=selected.rows.length)return;analysis=detect(selected.rows.slice(i));analysis.headerRow+=i;analysis.data=selected.rows.slice(i+1).filter(r=>r.some(v=>String(v??'').trim()!==''));clearResult();render();},s);
 el('span','形式: ',s);select([['auto','自動判定'],['long','縦持ち'],['wide','横持ち']],orientation,v=>{orientation=v;clearResult();render();},s);
 const effective=orientation==='auto'?analysis.orientation:orientation;
 el('p','自動判定 '+(analysis.orientation==='wide'?'横持ち':'縦持ち')+' / 使用 '+(effective==='wide'?'横持ち':'縦持ち'),s,'status');
 if(effective==='wide'){el('span','横持ちの値: ',s);select([['demand_qty','需要・販売数量'],['inventory_on_hand','在庫'],['inbound_qty','入庫'],['outbound_qty','出庫'],['amount','金額']],wideValueField,v=>{wideValueField=v;clearResult();render();},s);}
 const table=el('table',undefined,s);const tr=el('tr',undefined,table);['元の列名','推定型','出力フィールド','Mapping推定'].forEach(t=>el('th',t,tr));
 analysis.header.forEach((h,i)=>{const row=el('tr',undefined,table);el('td',String(h??'(空欄)'),row);el('td',analysis.columnProfiles?.[i]?.inferredType||'unknown',row);const cell=el('td',undefined,row);select([['','使用しない'],...fields.map(x=>[x,x])],analysis.mapping[i]||'',v=>{analysis.mapping[i]=v;clearResult();},cell);el('td',analysis.confidence[i]?Math.round(analysis.confidence[i]*100)+'%':'手動',row);});
 checkbox(s,'前後空白を除く',options.trim,v=>{options.trim=v;clearResult();});
 checkbox(s,'文字幅を統一',options.width,v=>{options.width=v;clearResult();});
 checkbox(s,'日付表記を統一',options.dates,v=>{options.dates=v;clearResult();});
 button('変換プレビューを実行',()=>{try{runTransform();render();}catch(e){alert('変換失敗: '+e.message);}},s);
}
function renderPreview(parent){
 if(!result)return;
 const s=section('変換プレビュー',parent);
 el('p','入力 '+report.stats.inputRows+' 行 / 変換後 '+report.stats.outputRows+' 行 / 変更 '+report.stats.changedCells+' セル',s,'status');
 const guard=[
   {metric:'SKU数',before:report.stats.inputUniqueSku??'未検出',after:report.stats.outputUniqueSku??'未検出'},
   {metric:'数量合計',before:report.stats.originalSum??'未検出',after:report.stats.transformedSum??'未検出'},
   {metric:'Null数',before:report.stats.inputNullCount??'未検出',after:report.stats.outputNullCount??'未検出'},
   {metric:'日付最小',before:report.stats.inputDateMin??'未検出',after:report.stats.outputDateMin??'未検出'},
   {metric:'日付最大',before:report.stats.inputDateMax??'未検出',after:report.stats.outputDateMax??'未検出'}
 ];
 el('h3','Data Loss Guard',s);renderTable(s,guard,10);
 [...report.errors.map(x=>'エラー: '+x),...report.warnings.map(x=>'注意: '+x)].forEach(t=>el('p',t,s,t.startsWith('エラー')?'error':'warning'));
 renderTable(s,result.records,15);
 if(result.changes.length){el('h3','Before / After',s);renderTable(s,result.changes,15);}
}
function renderPro(){
 const wrap=el('div',undefined,app,'workspace-panel');
 el('p','Proは複数シートの実クリーニングと、選択シートの標準形式変換を行う作業領域です。現在は課金接続前の開発プレビューです。',wrap,'lead');
 if(!renderUpload(wrap))return;
 renderBatchPro(wrap);
 renderMappingWorkspace(wrap);renderPreview(wrap);
 const out=section('標準形式出力',wrap);
 select([['demand','DemandScope'],['inventory','Inventory Manager'],['generic','Generic Clean CSV']],profile,v=>{profile=v;if(result)report=validate(analysis,result,profile);render();},out);
 if(result){[...report.errors.map(x=>'エラー: '+x),...report.warnings.map(x=>'注意: '+x)].forEach(t=>el('p',t,out,t.startsWith('エラー')?'error':'warning'));const b=button('CSVを出力',()=>saveText('data-shaper-'+profile+'.csv',exportCSV(result.records,profile),'text/csv;charset=utf-8'),out);b.disabled=report.errors.length>0;}
}
function renderAggregate(){
 const wrap=el('div',undefined,app,'workspace-panel');el('p','クリーニング後データを、指定キーで合計・平均・件数・最小・最大に集計します。',wrap,'lead');
 if(!renderUpload(wrap))return;renderMappingWorkspace(wrap);renderPreview(wrap);
 const s=section('集計設定',wrap);if(!result)return el('p','変換プレビューを実行してください。',s,'status');
 const available=recordFields();if(!aggregateConfig.group1||!available.includes(aggregateConfig.group1))aggregateConfig.group1=available[0]||'';if(!available.includes(aggregateConfig.valueField))aggregateConfig.valueField=available.find(x=>['amount','demand_qty','inventory_on_hand','debit','credit'].includes(x))||available[0]||'';
 el('span','キー1: ',s);select(available.map(x=>[x,x]),aggregateConfig.group1,v=>{aggregateConfig.group1=v;render();},s);el('span','キー2: ',s);select([['','なし'],...available.filter(x=>x!==aggregateConfig.group1).map(x=>[x,x])],aggregateConfig.group2,v=>{aggregateConfig.group2=v;render();},s);el('span','数値列: ',s);select(available.map(x=>[x,x]),aggregateConfig.valueField,v=>{aggregateConfig.valueField=v;render();},s);select([['sum','合計'],['avg','平均'],['count','件数'],['min','最小'],['max','最大']],aggregateConfig.method,v=>{aggregateConfig.method=v;render();},s);
 try{const rows=aggregateRecords(result.records,{groupBy:[aggregateConfig.group1,aggregateConfig.group2].filter(Boolean),valueField:aggregateConfig.valueField,method:aggregateConfig.method});renderTable(s,rows,30);button('集計CSVを出力',()=>saveText('data-shaper-aggregate.csv',exportObjectRows(rows),'text/csv;charset=utf-8'),s);}catch(e){el('p',e.message,s,'error');}
}
function renderBalance(){
 const wrap=el('div',undefined,app,'workspace-panel');el('p','決算書レイアウトは表示支援です。会計分類を推測で確定せず、科目をユーザーが指定した欄へ並べます。',wrap,'lead');
 if(!renderUpload(wrap))return;renderMappingWorkspace(wrap);renderPreview(wrap);
 const s=section('貸借対照表プレビュー',wrap);if(!result)return el('p','変換プレビューを実行してください。',s,'status');
 const available=recordFields();if(!available.includes(bsConfig.accountField))bsConfig.accountField=available.includes('account_name')?'account_name':available[0]||'';if(!available.includes(bsConfig.amountField))bsConfig.amountField=available.includes('amount')?'amount':available.find(x=>['debit','credit'].includes(x))||available[0]||'';
 el('span','科目列: ',s);select(available.map(x=>[x,x]),bsConfig.accountField,v=>{bsConfig.accountField=v;bsConfig.assignments={};render();},s);el('span','金額列: ',s);select(available.map(x=>[x,x]),bsConfig.amountField,v=>{bsConfig.amountField=v;render();},s);
 const accounts=[...new Set(result.records.map(r=>String(r[bsConfig.accountField]??'')).filter(Boolean))];const mapBox=el('div',undefined,s,'mapping-grid');accounts.slice(0,100).forEach(account=>{const line=el('div',undefined,mapBox,'mapping-row');el('span',account,line);select([['','未分類'],...balanceSheetSections],bsConfig.assignments[account]||'',v=>{bsConfig.assignments[account]=v;render();},line);});
 const sheet=buildBalanceSheet(result.records,bsConfig);const grid=el('div',undefined,s,'statement-grid');for(const [id,label] of balanceSheetSections){const card=el('div',undefined,grid,'statement-card');el('h4',label,card);sheet.sections[id].items.forEach(x=>el('div',x.account+'　'+x.amount.toLocaleString(),card,'statement-line'));el('strong','合計 '+sheet.sections[id].total.toLocaleString(),card);}
 if(sheet.unclassified.length){const card=el('div',undefined,grid,'statement-card');el('h4','未分類',card);sheet.unclassified.slice(0,30).forEach(x=>el('div',x.account+'　'+x.amount.toLocaleString(),card,'statement-line'));}
 el('p','資産 '+sheet.totals.assets.toLocaleString()+' / 負債 '+sheet.totals.liabilities.toLocaleString()+' / 純資産 '+sheet.totals.equity.toLocaleString()+' / 貸借差額 '+sheet.totals.difference.toLocaleString(),s,Math.abs(sheet.totals.difference)>1e-8?'warning':'status');button('プレビューCSVを出力',()=>saveText('data-shaper-balance-sheet.csv',exportBalanceSheet(sheet),'text/csv;charset=utf-8'),s);
}
function renderRecipe(){
 if(!sheets.length||workspaceTab==='free')return;
 const s=section('Recipe / 再利用');
 button('現在の設定をRecipe保存',()=>{
   const out=buildRecipe({sheets,analysis,options,profile,orientation,wideValueField,aggregateConfig,bsConfig,batchOptions});
   saveText('data-shaper-recipe.json',JSON.stringify(out,null,2),'application/json');
 },s);
 const input=el('input',undefined,s);input.type='file';input.accept='.json';input.setAttribute('aria-label','Recipe JSONを読み込む');
 input.addEventListener('change',async()=>{
   try{
     const recipe=JSON.parse(await input.files[0].text());
     validateRecipe(recipe,{sheets,analysis,allowedFields:fields});
     analysis.mapping={...recipe.mapping};
     if(recipe.header_row&&Number.isInteger(Number(recipe.header_row))&&Number(recipe.header_row)>=1&&Number(recipe.header_row)<=selected.rows.length){
       const h=Number(recipe.header_row)-1;
       if(h!==analysis.headerRow){analysis=detect(selected.rows.slice(h));analysis.headerRow+=h;analysis.data=selected.rows.slice(h+1).filter(r=>r.some(v=>String(v??'').trim()!==''));analysis.mapping={...recipe.mapping};}
     }
     options={...options,...(recipe.options||{})};
     profile=['demand','inventory','generic'].includes(recipe.profile)?recipe.profile:profile;
     orientation=['auto','long','wide'].includes(recipe.orientation)?recipe.orientation:orientation;
     wideValueField=recipe.wideValueField||wideValueField;
     aggregateConfig={...aggregateConfig,...(recipe.aggregateConfig||{})};
     bsConfig={...bsConfig,...(recipe.bsConfig||{}),assignments:{...(recipe.bsConfig?.assignments||{})}};
     batchOptions={...batchOptions,...(recipe.batchOptions||{})};
     clearResult();render();
   }catch(e){alert('Recipe適用不可: '+e.message);}
 });
}

function render(){
 app.replaceChildren();el('h1','Data Shaper',app);el('p','無料診断からPro一括クリーニング、集計、決算書レイアウトまでをLocal Firstで処理します。',app,'subtitle');renderTabs();
 if(workspaceTab==='free')renderFree();
 if(workspaceTab==='pro')renderPro();
 if(workspaceTab==='aggregate')renderAggregate();
 if(workspaceTab==='balance')renderBalance();
 renderRecipe();
}
render();
