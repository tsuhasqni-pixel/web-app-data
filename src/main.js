import {readWorkbook} from './parser/index.js';
import {detect,fields} from './detector/index.js';
import {transform} from './transform/index.js';
import {validate} from './validator/index.js';
import {diagnoseCleaning,cleanRawTable} from './cleaner/index.js';
import {cleanWorkbook,BATCH_LIMITS} from './batch/index.js';
import {aggregateRecords,balanceSheetSections} from './aggregate/index.js';
import {createDefaultStatementTemplate,parseStatementTemplateRows,mapTrialBalanceToTemplate,templateSections,templateToRows,aggregationToRows} from './accounting/template.js';
import {toCSV} from './parser/csv.js';
import {exportCSV,exportObjectRows,exportBalanceSheet,saveText} from './exporter/index.js';
import {buildCleaningZip,saveBlob} from './exporter/batch.js';
import {buildRecipe,validateRecipe} from './recipe/index.js';
import './style.css';

const app=document.querySelector('#app');
let sheets=[],selected=null,analysis=null,result=null,report=null;
let workspaceTab='free';
let profile='demand',orientation='auto',wideValueField='demand_qty';
let options={trim:true,width:true,dates:true};
let aggregateConfig={group1:'',valueField:'amount'};
let bsConfig={accountField:'account_name',amountField:'amount',debitField:'debit',creditField:'credit',overrides:{}};
let statementTemplate=createDefaultStatementTemplate();
let templateMappings={};
let statementConfig={accountField:'account_name',amountField:'amount',debitField:'debit',creditField:'credit'};
let selectedBatchSheets=new Set(),batchResults=[];
let batchOptions={trim:true,width:true,removeExactDuplicates:false};
let authState={loaded:false,loading:false,authenticated:false,user:null,entitlement:{tier:'free',pro:false,source:'stripe',reason:'not_authenticated'}};
let billingState={loaded:false,loading:false,enabled:false,ready:false,mode:'test',missing:[]};

function el(tag,text,parent,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;(parent||app).appendChild(e);return e;}
function button(text,onClick,parent,cls){const b=el('button',text,parent,cls);b.type='button';b.addEventListener('click',onClick);return b;}
async function refreshAuth(){
 if(authState.loading)return;
 authState={...authState,loading:true};
 try{
   const res=await fetch('/api/auth/session',{credentials:'same-origin',headers:{accept:'application/json'}});
   const data=await res.json();
   authState={loaded:true,loading:false,authenticated:data.authenticated===true,user:data.user||null,entitlement:data.entitlement||{tier:'unknown',pro:false,source:'stripe',reason:'unknown'}};
 }catch{
   authState={loaded:true,loading:false,authenticated:false,user:null,entitlement:{tier:'unknown',pro:false,source:'stripe',reason:'session_unavailable'}};
 }
 render();
}
async function refreshBilling(){
 if(billingState.loading)return;
 billingState={...billingState,loading:true};
 try{
   const res=await fetch('/api/billing/status',{credentials:'same-origin',headers:{accept:'application/json'}});
   const data=await res.json();
   billingState={loaded:true,loading:false,enabled:data.billing_enabled===true,ready:data.ready_for_test===true,mode:data.mode||'test',missing:Array.isArray(data.missing)?data.missing:[]};
 }catch{
   billingState={loaded:true,loading:false,enabled:false,ready:false,mode:'test',missing:['status_unavailable']};
 }
 render();
}
async function startTestCheckout(){
 try{
   const res=await fetch('/api/billing/checkout',{method:'POST',credentials:'same-origin',headers:{accept:'application/json'}});
   const data=await res.json();
   if(!res.ok||!data?.url)throw new Error(data?.error||'checkout_failed');
   location.assign(data.url);
 }catch(e){alert('TEST決済を開始できませんでした: '+e.message);}
}
async function logoutAuth(){
 try{await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin',headers:{accept:'application/json'}});}catch{}
 authState={loaded:false,loading:false,authenticated:false,user:null,entitlement:{tier:'free',pro:false,source:'stripe',reason:'not_authenticated'}};
 await refreshAuth();
}
function renderAuthBar(){
 const bar=el('section',undefined,app,'auth-bar');
 const left=el('div',undefined,bar,'auth-copy');
 el('strong','アカウント',left);
 if(!authState.loaded){
   el('span',' ログイン状態を確認中…',left,'status');
   return;
 }
 if(authState.authenticated){
   const name=authState.user?.name||authState.user?.email||'Googleユーザー';
   el('span',' '+name,left);
   if(authState.user?.email)el('small',authState.user.email,left);
   const badge=el('span',authState.entitlement?.pro?'Pro':'Free',left,'auth-badge '+(authState.entitlement?.pro?'pro':'free'));
   badge.title='Googleログインは本人認証のみ。Pro権限はStripe entitlementで判定します。';
   button('ログアウト',logoutAuth,bar,'secondary-button');
 }else{
   el('span',' Free機能はログイン不要です。',left,'status');
   const login=el('a','Googleでログイン',bar,'login-link');
   login.href='/api/auth/google/start';
   login.rel='nofollow';
 }
}
function proAuthorized(){return authState.loaded&&authState.authenticated&&authState.entitlement?.pro===true;}
function renderProLocked(){
 const wrap=el('div',undefined,app,'workspace-panel');
 const s=section('Proアクセス',wrap);
 if(!authState.loaded){el('p','ログイン状態を確認しています。',s,'status');return;}
 if(!authState.authenticated){
   el('p','Pro機能はGoogleで本人認証した後、StripeのData Shaper専用契約を別途確認して開放します。',s,'warning');
   const login=el('a','Googleでログイン',s,'login-link');login.href='/api/auth/google/start';
 }else{
   el('p','Google本人認証は完了しています。ただし現在、有効なData Shaper ProのStripe entitlementを確認できないためPro機能は開放しません。',s,'warning');
   el('p','Googleログイン成功だけでPro権限を付与しない設計です。',s,'status');
    if(!billingState.loaded){
      el('p','Stripe TEST接続状態を確認しています。',s,'status');
    }else if(billingState.ready){
      el('p','現在はStripe TEST環境です。実際の請求は発生しません。',s,'status');
      button('TEST Proを開始（月額 ¥980）',startTestCheckout,s);
    }else{
      el('p','Stripe TEST決済は準備中です。',s,'status');
    }
 }
}
function select(values,value,onChange,parent){const e=el('select',undefined,parent);for(const [v,t] of values){const o=el('option',t,e);o.value=v;}e.value=value;e.addEventListener('change',()=>onChange(e.value));return e;}
function section(title,parent=app){const s=el('section',undefined,parent);el('h2',title,s);return s;}
function clearResult(){result=null;report=null;}
function setSelected(i){selected=sheets[Number(i)]||sheets[0];analysis=selected?detect(selected.rows):null;clearResult();bsConfig.overrides={};}
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
 el('p','Proは複数シートの実クリーニングと、選択シートの標準形式変換を行う契約者向け作業領域です。処理はLocal Firstで行います。',wrap,'lead');
 if(!renderUpload(wrap))return;
 renderBatchPro(wrap);
 renderMappingWorkspace(wrap);renderPreview(wrap);
 const out=section('標準形式出力',wrap);
 select([['demand','DemandScope'],['inventory','Inventory Manager'],['generic','Generic Clean CSV']],profile,v=>{profile=v;if(result)report=validate(analysis,result,profile);render();},out);
 if(result){[...report.errors.map(x=>'エラー: '+x),...report.warnings.map(x=>'注意: '+x)].forEach(t=>el('p',t,out,t.startsWith('エラー')?'error':'warning'));const b=button('CSVを出力',()=>saveText('data-shaper-'+profile+'.csv',exportCSV(result.records,profile),'text/csv;charset=utf-8'),out);b.disabled=report.errors.length>0;}
}
function templateRowOptions(){
 return statementTemplate.slice().sort((a,b)=>a.order-b.order).map(x=>[x.id,x.label]);
}
function reindexTemplate(){
 statementTemplate=statementTemplate.map((x,i)=>({...x,order:i+1}));
}
function moveTemplateRow(index,delta){
 const next=index+delta;if(next<0||next>=statementTemplate.length)return;
 const rows=[...statementTemplate];[rows[index],rows[next]]=[rows[next],rows[index]];
 statementTemplate=rows;reindexTemplate();render();
}
function removeTemplateRow(index){
 statementTemplate=statementTemplate.filter((_,i)=>i!==index);reindexTemplate();render();
}
function addTemplateRow(){
 statementTemplate=[...statementTemplate,{
   id:'custom_'+crypto.randomUUID(),
   label:'新規勘定科目',
   section:'current_assets',
   normal_balance:'debit',
   aliases:[],
   order:statementTemplate.length+1,
   source:'manual'
 }];render();
}
function renderTemplateEditor(parent){
 const s=section('決算書テンプレート（集計先）',parent);
 el('p','先に決算書の型を持ち、その科目へ入力試算表の科目を対応付けます。1つのテンプレート科目へ複数の入力科目を集約できます。',s,'status');
 el('p','初期値は日本基準の貸借対照表向けスターターテンプレートです。EDINET/XBRLやPDF→OCRで抽出した科目表も、同じテンプレート形式へ変換して差し替えられる設計です。',s,'status');
 const file=el('input',undefined,s);file.type='file';file.accept='.csv,.tsv,.xlsx';
 file.setAttribute('aria-label','決算書テンプレートを読み込む');
 file.addEventListener('change',async()=>{
   try{
     const books=await readWorkbook(file.files[0]);
     statementTemplate=parseStatementTemplateRows(books[0]?.rows||[]);
     templateMappings={};
     render();
   }catch(e){alert('テンプレート読込失敗: '+e.message);}
 });
 button('現在のテンプレートをCSV保存',()=>saveText('data-shaper-statement-template.csv',toCSV(templateToRows(statementTemplate)),'text/csv;charset=utf-8'),s,'secondary-button');
 const table=el('table',undefined,s);const head=el('tr',undefined,table);
 ['順','区分','勘定科目','別名（|区切り）','残高側','操作'].forEach(x=>el('th',x,head));
 statementTemplate.slice().sort((a,b)=>a.order-b.order).forEach((item,index)=>{
   const tr=el('tr',undefined,table);
   el('td',String(index+1),tr);
   const sec=el('td',undefined,tr);
   select(templateSections.map(([id,label])=>[id,label]),item.section,v=>{
     item.section=v;
     const meta=templateSections.find(([id])=>id===v);if(meta)item.normal_balance=meta[2];
   },sec);
   const nameCell=el('td',undefined,tr);const name=el('input',undefined,nameCell);name.value=item.label;
   name.addEventListener('change',()=>{item.label=name.value.trim()||item.label;render();});
   const aliasCell=el('td',undefined,tr);const aliases=el('input',undefined,aliasCell);aliases.value=(item.aliases||[]).join('|');
   aliases.addEventListener('change',()=>{item.aliases=aliases.value.split(/[|｜]/).map(x=>x.trim()).filter(Boolean);render();});
   const normal=el('td',undefined,tr);
   select([['debit','借方'],['credit','貸方']],item.normal_balance,v=>{item.normal_balance=v;render();},normal);
   const ops=el('td',undefined,tr);
   button('↑',()=>moveTemplateRow(index,-1),ops,'secondary-button');
   button('↓',()=>moveTemplateRow(index,1),ops,'secondary-button');
   button('削除',()=>removeTemplateRow(index),ops,'secondary-button');
 });
 button('勘定科目を追加',addTemplateRow,s);
}
function ensureStatementConfig(){
 const available=recordFields();
 if(!available.includes(statementConfig.accountField))statementConfig.accountField=available.includes('account_name')?'account_name':available[0]||'';
 if(!available.includes(statementConfig.amountField))statementConfig.amountField=available.includes('amount')?'amount':'';
 if(!available.includes(statementConfig.debitField))statementConfig.debitField=available.includes('debit')?'debit':'';
 if(!available.includes(statementConfig.creditField))statementConfig.creditField=available.includes('credit')?'credit':'';
 return available;
}
function renderSourceColumnConfig(parent){
 const s=section('入力試算表の列',parent);
 const available=ensureStatementConfig();
 if(!available.length)return el('p','入力列がありません。標準化設定で列をMappingしてください。',s,'warning');
 el('span','勘定科目列: ',s);select(available.map(x=>[x,x]),statementConfig.accountField,v=>{statementConfig.accountField=v;templateMappings={};render();},s);
 el('span','残高列: ',s);select([['','借方・貸方から計算'],...available.map(x=>[x,x])],statementConfig.amountField,v=>{statementConfig.amountField=v;render();},s);
 if(!statementConfig.amountField){
   el('span','借方列: ',s);select([['','なし'],...available.map(x=>[x,x])],statementConfig.debitField,v=>{statementConfig.debitField=v;render();},s);
   el('span','貸方列: ',s);select([['','なし'],...available.map(x=>[x,x])],statementConfig.creditField,v=>{statementConfig.creditField=v;render();},s);
 }
}
function currentStatementAggregation(){
 if(!result)return null;
 ensureStatementConfig();
 if(!statementConfig.accountField)return null;
 return mapTrialBalanceToTemplate(result.records,statementTemplate,{...statementConfig,manualMappings:templateMappings});
}
function renderAccountMapping(parent,agg){
 const s=section('入力科目 → テンプレート科目',parent);
 el('p','入力科目 '+agg.sourceAccountCount+' / 対応済み '+agg.mappedSourceCount+' / 未対応 '+agg.unresolved.length,s,agg.unresolved.length?'warning':'status');
 const mapped=agg.rows.filter(x=>x.source_accounts.length).map(x=>({
   template_account:x.label,
   section:templateSections.find(([id])=>id===x.section)?.[1]||x.section,
   source_accounts:x.source_accounts.join(' / '),
   amount:x.amount
 }));
 renderTable(s,mapped,100);
 if(agg.unresolved.length){
   el('p','未対応科目は捨てません。対応先を選ぶと、そのテンプレート科目へ合算します。',s,'warning');
   const grid=el('div',undefined,s,'mapping-grid');
   agg.unresolved.forEach(src=>{
     const row=el('div',undefined,grid,'mapping-row');
     el('span',src.account+'（借方 '+src.debit.toLocaleString()+' / 貸方 '+src.credit.toLocaleString()+' / 残高 '+src.amount.toLocaleString()+'）',row);
     select([['','未対応'],...templateRowOptions()],templateMappings[src.account]||'',v=>{if(v)templateMappings[src.account]=v;else delete templateMappings[src.account];render();},row);
   });
 }
}
function numericRecordFields(){
 const available=recordFields();
 return available.filter(field=>result?.records?.some(row=>{
   const value=row[field];
   if(value===null||value===undefined||value==='')return false;
   return Number.isFinite(Number(String(value).replace(/,/g,'')));
 }));
}
function renderAggregate(){
 const wrap=el('div',undefined,app,'workspace-panel');
 el('p','入力データから「何を基準にまとめるか」と「どの数値を合計するか」の2項目を選ぶシンプルな集計です。',wrap,'lead');
 if(!renderUpload(wrap))return;
 renderMappingWorkspace(wrap);renderPreview(wrap);
 const s=section('集計設定',wrap);
 if(!result)return el('p','変換プレビューを実行してください。',s,'status');
 const available=recordFields();
 const numericFields=numericRecordFields();
 if(!aggregateConfig.group1||!available.includes(aggregateConfig.group1)){
   aggregateConfig.group1=available.find(x=>!numericFields.includes(x))||available[0]||'';
 }
 if(!aggregateConfig.valueField||!numericFields.includes(aggregateConfig.valueField)){
   aggregateConfig.valueField=numericFields[0]||'';
 }
 el('span','基準にする項目: ',s);
 select(available.map(x=>[x,x]),aggregateConfig.group1,v=>{aggregateConfig.group1=v;render();},s);
 el('span','合計する数値項目: ',s);
 select(numericFields.map(x=>[x,x]),aggregateConfig.valueField,v=>{aggregateConfig.valueField=v;render();},s);
 if(!aggregateConfig.group1||!aggregateConfig.valueField){
   return el('p','基準項目と数値項目を選択してください。',s,'warning');
 }
 try{
   const rows=aggregateRecords(result.records,{groupBy:[aggregateConfig.group1],valueField:aggregateConfig.valueField,method:'sum'});
   const totalKey='sum_'+aggregateConfig.valueField;
   const view=rows.map(row=>({
     [aggregateConfig.group1]:row[aggregateConfig.group1],
     [aggregateConfig.valueField+' 合計']:row[totalKey],
     '元データ件数':row.source_count
   }));
   el('p',aggregateConfig.group1+' ごとに '+aggregateConfig.valueField+' を合計しています。',s,'status');
   renderTable(s,view,100);
   button('集計結果CSVをすぐ返す',()=>saveText('data-shaper-aggregate.csv',exportObjectRows(view),'text/csv;charset=utf-8'),s);
   el('p','元ファイルはブラウザ内で処理し、サーバーへ保存しません。',s,'status');
 }catch(e){el('p',e.message,s,'error');}
}
function renderBalance(){
 const wrap=el('div',undefined,app,'workspace-panel');
 el('p','「勘定科目集計」で作ったテンプレートと対応関係を使って、試算表の数字を決算書の型へ流し込みます。',wrap,'lead');
 renderTemplateEditor(wrap);
 if(!renderUpload(wrap))return;
 renderMappingWorkspace(wrap);renderPreview(wrap);
 if(!result)return;
 renderSourceColumnConfig(wrap);
 const agg=currentStatementAggregation();if(!agg)return;
 renderAccountMapping(wrap,agg);
 const s=section('決算書プレビュー',wrap);
 for(const [sectionId,label] of templateSections){
   const card=el('div',undefined,s,'statement-card');el('h4',label,card);
   agg.rows.filter(x=>x.section===sectionId).forEach(x=>{
     const line=el('div',x.label+'　'+x.amount.toLocaleString(),card,'statement-line');
     if(x.source_accounts.length)line.title='集計元: '+x.source_accounts.join(' / ');
   });
   el('strong','合計 '+(agg.sectionTotals[sectionId]?.total??0).toLocaleString(),card);
 }
 const status=agg.totals.isBalanced
   ?'一致：資産＝負債＋純資産'
   :'要確認：貸借差額 '+agg.totals.difference.toLocaleString()+' / 未対応科目 '+agg.unresolved.length;
 el('p','資産 '+agg.totals.assets.toLocaleString()+' / 負債 '+agg.totals.liabilities.toLocaleString()+' / 純資産 '+agg.totals.equity.toLocaleString(),s,'status');
 el('p',status,s,agg.totals.isBalanced?'status':'warning');
 button('決算集計結果をCSVですぐ返す',()=>saveText('data-shaper-statement-result.csv',toCSV(aggregationToRows(agg)),'text/csv;charset=utf-8'),s);
 el('p','新しい勘定科目はテンプレートへ追加できます。会社固有の科目は入力科目から任意のテンプレート科目へ手動対応できます。',s,'status');
}
function renderRecipe(){
 if(!sheets.length||workspaceTab==='free')return;
 const s=section('Recipe / 再利用');
 button('現在の設定をRecipe保存',()=>{
   const out=buildRecipe({sheets,analysis,options,profile,orientation,wideValueField,aggregateConfig,bsConfig,batchOptions,statementTemplate,templateMappings,statementConfig});
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
     bsConfig={...bsConfig,...(recipe.bsConfig||{}),overrides:{...(recipe.bsConfig?.overrides||recipe.bsConfig?.assignments||{})}};
     batchOptions={...batchOptions,...(recipe.batchOptions||{})};
     if(Array.isArray(recipe.statementTemplate)&&recipe.statementTemplate.length)statementTemplate=recipe.statementTemplate.map(x=>({...x,aliases:[...(x.aliases||[])]}));
     templateMappings={...(recipe.templateMappings||{})};
     statementConfig={...statementConfig,...(recipe.statementConfig||{})};
     clearResult();render();
   }catch(e){alert('Recipe適用不可: '+e.message);}
 });
}

function render(){
 app.replaceChildren();el('h1','Data Shaper',app);el('p','無料診断からPro一括クリーニング、集計、決算書レイアウトまでをLocal Firstで処理します。',app,'subtitle');renderAuthBar();renderTabs();
 if(workspaceTab==='free')renderFree();
 if(workspaceTab==='pro')(proAuthorized()?renderPro():renderProLocked());
 if(workspaceTab==='aggregate')(proAuthorized()?renderAggregate():renderProLocked());
 if(workspaceTab==='balance')(proAuthorized()?renderBalance():renderProLocked());
 if(proAuthorized())renderRecipe();
 const footer=el('footer',undefined,app,'app-footer');
 const privacy=el('a','プライバシー',footer);privacy.href='/legal/privacy/';
 const terms=el('a','利用規約',footer);terms.href='/legal/terms/';
 const disclosure=el('a','運営者情報・情報開示',footer);
 disclosure.href='/api/legal/disclosure';
 disclosure.rel='noreferrer';
}
render();
refreshAuth();
refreshBilling();
if(new URLSearchParams(location.search).get('billing')==='success'){
  let attempts=0;
  const timer=setInterval(async()=>{
    attempts+=1;
    await refreshAuth();
    if(authState.entitlement?.pro===true||attempts>=5)clearInterval(timer);
  },1000);
}
