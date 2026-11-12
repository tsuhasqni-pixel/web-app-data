import {readWorkbook} from './parser/index.js';
import {detect,fields} from './detector/index.js';
import {transform} from './transform/index.js';
import {validate} from './validator/index.js';
import {diagnoseCleaning,cleanRawTable} from './cleaner/index.js';
import {cleanWorkbook,BATCH_LIMITS} from './batch/index.js';
import {aggregateRecords,buildPivotTable,balanceSheetSections} from './aggregate/index.js';
import {createDefaultStatementTemplate,parseStatementTemplateRows,mapTrialBalanceToTemplate,templateSections,templateToRows,aggregationToRows} from './accounting/template.js';
import {toCSV,toDelimited} from './parser/csv.js';
import {exportCSV,exportObjectRows,exportBalanceSheet,saveText,saveCsv} from './exporter/index.js';
import {buildCleaningZip,saveBlob} from './exporter/batch.js';
import {objectRowsToRows,openPrintReport} from './exporter/report.js';
import {saveXlsx} from './exporter/xlsx.js';
import {buildRecipe,validateRecipe} from './recipe/index.js';
import {reportPurposes,getReportPurpose,buildSimpleReport,simpleReportToRows,reportDisclaimer} from './reporting/index.js';
import {initLanguage,language,setLanguage,tr,languageOptions,applyTranslations} from './i18n.js';
import {validateTaxRules,applyTaxRules} from './tax/index.js';
import {buildDepreciationSchedule} from './depreciation/index.js';
import './style.css';

const app=document.querySelector('#app');
let sheets=[],selected=null,analysis=null,result=null,report=null;
let workspaceTab='free';
let profile='demand',orientation='auto',wideValueField='demand_qty';
let options={trim:true,width:true,dates:true};
let aggregateConfig={rowField:'',columnField:'',valueField:'amount'};
let reportConfig={purpose:'household',categoryField:'',amountField:'',flowField:''};
let taxConfig={dateField:'date',businessField:'business_unit',categoryField:'tax_category',amountField:'amount',basis:'exclusive',rounding:'floor',rules:[]};
let depreciationConfig={cost:'',residual:'0',lifeYears:'',method:'straight_line',decliningRate:'',result:null};
let bsConfig={accountField:'account_name',amountField:'amount',debitField:'debit',creditField:'credit',overrides:{}};
let statementTemplate=createDefaultStatementTemplate();
let templateMappings={};
let statementConfig={accountField:'account_name',amountField:'amount',debitField:'debit',creditField:'credit'};
let selectedBatchSheets=new Set(),batchResults=[];
let batchOptions={trim:true,width:true,removeExactDuplicates:false};
let authState={loaded:false,loading:false,authenticated:false,user:null,entitlement:{tier:'free',pro:false,source:'stripe',reason:'not_authenticated'}};
let billingState={loaded:false,loading:false,enabled:false,ready:false,proReady:false,liteReady:false,mode:'test',missing:[],proMissing:[],liteMissing:[]};

function el(tag,text,parent,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;(parent||app).appendChild(e);return e;}
function button(text,onClick,parent,cls){const b=el('button',tr(text),parent,cls);b.type='button';b.addEventListener('click',onClick);return b;}
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
   billingState={
     loaded:true,loading:false,enabled:data.billing_enabled===true,
     ready:data.ready_for_test===true,
     proReady:data.pro_ready_for_test===true,
     liteReady:data.lite_ready_for_test===true,
     mode:data.mode||'test',
     missing:Array.isArray(data.missing)?data.missing:[],
     proMissing:Array.isArray(data.pro_missing)?data.pro_missing:[],
     liteMissing:Array.isArray(data.lite_missing)?data.lite_missing:[]
   };
 }catch{
   billingState={loaded:true,loading:false,enabled:false,ready:false,proReady:false,liteReady:false,mode:'test',missing:['status_unavailable'],proMissing:['status_unavailable'],liteMissing:['status_unavailable']};
 }
 render();
}
async function startTestCheckout(tier='pro'){
 try{
   const res=await fetch('/api/billing/checkout',{
     method:'POST',
     credentials:'same-origin',
     headers:{accept:'application/json','content-type':'application/json'},
     body:JSON.stringify({tier})
   });
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
   const tier=currentTier();
   const badge=el('span',tier==='pro'?'Pro':tier==='lite'?'Lite':'Free',left,'auth-badge '+tier);
   badge.title='Googleログインは本人認証のみ。有料権限はStripe entitlementで判定します。';
   button('ログアウト',logoutAuth,bar,'secondary-button');
 }else{
   el('span',' Free機能はログイン不要です。',left,'status');
   const login=el('a','Googleでログイン',bar,'login-link');
   login.href='/api/auth/google/start';
   login.rel='nofollow';
 }
}
const planRank={free:0,lite:1,pro:2};
function currentTier(){
 const tier=String(authState.entitlement?.tier||'free').toLowerCase();
 if(authState.entitlement?.pro===true)return 'pro';
 return planRank[tier]!==undefined?tier:'free';
}
function hasTier(required){return authState.loaded&&authState.authenticated&&planRank[currentTier()]>=planRank[required];}
function liteAuthorized(){return hasTier('lite');}
function proAuthorized(){return hasTier('pro');}
function renderPlanOverview(){
 const s=section('料金プラン');
 const grid=el('div',undefined,s,'plan-grid');
 const plans=[
   {name:'Free',price:'¥0',className:'free',copy:'軽量集計、無料診断、簡易レポート。集計は縦軸×横軸の交差集計と数値合計まで無料。'},
   {name:'Lite',price:'月額 ¥480',className:'lite',copy:'データ整形、全分類の汎用レポート、Recipe再利用。'},
   {name:'Pro',price:'月額 ¥980',className:'pro',copy:'Liteの全機能＋法人・個人事業の決算/申告準備、勘定科目テンプレート、貸借一致確認。'}
 ];
 plans.forEach(plan=>{
   const card=el('div',undefined,grid,'plan-card '+plan.className);
   el('strong',plan.name,card);
   el('span',plan.price,card,'plan-price');
   el('p',plan.copy,card);
 });
 el('p','価格本体は Free ¥0 / Lite 月額¥480 / Pro 月額¥980 で固定します。税の扱いと最終支払額表示は販売開始前に事業者判断で確定し、Stripe TESTでは接続済みのTierだけ購入ボタンを有効化します。',s,'status');
}
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
      button('TEST Proを開始（月額 ¥980）',()=>startTestCheckout('pro'),s);
    }else{
      el('p','Stripe TEST決済は準備中です。',s,'status');
    }
 }
}
function select(values,value,onChange,parent){const e=el('select',undefined,parent);for(const [v,t] of values){const o=el('option',tr(t),e);o.value=v;}e.value=value;e.addEventListener('change',()=>onChange(e.value));return e;}
function section(title,parent=app){const s=el('section',undefined,parent);el('h2',tr(title),s);return s;}
function renderLanguageControl(){
 const bar=el('div',undefined,app,'language-control');
 el('span',language()==='en'?'Language':'言語',bar);
 select(languageOptions(),language(),v=>{setLanguage(v);render();},bar);
}
function renderOutputChoice(parent,{title,filenameBase,rows,note='' }){
 const box=el('div',undefined,parent,'export-choice');
 el('span','出力形式: ',box);
 let format='csv';
 select([['csv','CSV（Excelで開く）'],['pdf','PDF']],format,v=>{format=v;},box);
 button('この形式で出力',()=>{
   try{
     if(format==='csv')saveCsv(filenameBase+'.csv',toCSV(rows));
     else openPrintReport({title,rows,note});
   }catch(e){alert('出力失敗: '+e.message);}
 },box);
}
function inputFileInfo(){
 const name=String(selected?.sourceFile||'data-shaper.csv');
 const match=name.match(/\.([^.]+)$/);
 const ext=String(match?.[1]||'csv').toLowerCase();
 const safeExt=['csv','tsv','xlsx'].includes(ext)?ext:'csv';
 const base=name.replace(/\.[^.]+$/,'')||'data-shaper';
 return {name,ext:safeExt,base};
}
async function saveRowsLikeInput(rows,suffix='集計結果'){
 const {ext,base}=inputFileInfo();
 const filename=base+'-'+suffix+'.'+ext;
 if(ext==='xlsx'){
   await saveXlsx(filename,rows,{sheet:'集計結果'});
   return;
 }
 if(ext==='tsv'){
   const text='\ufeff'+toDelimited(rows,'\t');
   saveText(filename,text,'text/tab-separated-values;charset=utf-8');
   return;
 }
 saveCsv(filename,toCSV(rows));
}
function matrixToObjects(rows){
 const [header,...data]=Array.isArray(rows)?rows:[];
 if(!Array.isArray(header))return [];
 return data.map(row=>Object.fromEntries(header.map((key,i)=>[String(key??''),row?.[i]??''])));
}
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
  ['free','無料診断 · Free'],
  ['aggregate','集計 · Free'],
  ['balance','決算・レポート · Free / Lite / Pro'],
  ['pro','データ整形 · Lite']
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
 el('p','無料版は「どこに問題があり、何を安全に直せるか」を診断して、データ整形工程を見せるためのモードです。元データの意味が不明な変更は行いません。',wrap,'lead');
 if(!renderUpload(wrap))return;
 const d=diagnoseCleaning(selected.rows,{headerRow:analysis.headerRow});
 const s=section('無料データ整形診断',wrap);
 const stats=el('div',undefined,s,'metric-grid');
 [['データ行',d.rows],['列',d.columns],['空欄',d.blanks],['前後空白',d.outerWhitespace],['全角/半角候補',d.fullWidth],['完全重複候補',d.duplicateRows]].forEach(([k,v])=>{const card=el('div',undefined,stats,'metric-card');el('strong',String(v),card);el('span',k,card);});
 const typeRows=(analysis.columnProfiles||[]).map(x=>({column:x.name||('column_'+(x.index+1)),type:x.inferredType,numeric_rate:Math.round(x.numericRate*100)+'%',date_rate:Math.round(x.dateRate*100)+'%',non_null_rate:Math.round(x.nonNullRate*100)+'%'}));
 el('h3','列型の推定',s);renderTable(s,typeRows,30);
 if(!d.suggestions.length)el('p','主要なデータ整形候補は検出されませんでした。',s,'status');
 d.suggestions.forEach(x=>{const card=el('div',undefined,s,'diagnostic-card '+(x.kind==='safe'?'safe':'review'));el('strong',x.title+'（'+x.count+'件）',card);el('p',x.reason,card);el('small',x.kind==='safe'?'安全寄りの候補：Before/Afterで確認':'要確認：意味を推測して自動変更しない',card);});
 const demo=cleanRawTable(selected.rows,{headerRow:analysis.headerRow,trim:true,width:true,removeExactDuplicates:false});
 const p=section('データ整形工程プレビュー',wrap);
 el('p','無料版では「前後空白除去」「文字幅統一」の安全寄り処理だけを仮適用し、変更箇所を見せます。空欄補完・重複削除はしません。',p,'status');
 renderTable(p,demo.changes,20);
 if(!demo.changes.length)el('p','安全寄りルールで変更されるセルはありません。',p,'status');
 el('p','実ファイルへの一括適用・複数シート処理・出力はLite以上の作業領域です。',p,'pro-note');
}
function renderBatchPro(parent){
 const s=section('Lite：複数シート一括データ整形',parent);
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
 button('選択シートを一括データ整形',()=>{try{batchResults=cleanWorkbook(sheets,[...selectedBatchSheets],batchOptions);render();}catch(e){alert(e.message);}},s);
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
 el('p','Lite以上では複数シートのデータ整形と、選択シートの標準形式変換を行います。処理はLocal Firstです。',wrap,'lead');
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
 button('現在のテンプレートをCSV保存',()=>saveCsv('data-shaper-statement-template.csv',toCSV(templateToRows(statementTemplate))),s,'secondary-button');
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
 if(!available.includes(statementConfig.accountField))statementConfig.accountField=available.includes('account_name')?'account_name':'';
 if(!available.includes(statementConfig.amountField))statementConfig.amountField=available.includes('amount')?'amount':'';
 if(!available.includes(statementConfig.debitField))statementConfig.debitField=available.includes('debit')?'debit':'';
 if(!available.includes(statementConfig.creditField))statementConfig.creditField=available.includes('credit')?'credit':'';
 return available;
}
function renderSourceColumnConfig(parent){
 const s=section('入力試算表の列',parent);
 const available=ensureStatementConfig();
 if(!available.length)return el('p','入力列がありません。標準化設定で列をMappingしてください。',s,'warning');
 el('span','勘定科目列: ',s);select([['','選択してください'],...available.map(x=>[x,x])],statementConfig.accountField,v=>{statementConfig.accountField=v;templateMappings={};render();},s);
 if(!statementConfig.accountField)el('p','勘定科目列を明示的にMappingしてください。別の列を勘定科目として推測しません。',s,'warning');
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
 el('p','縦軸と横軸を指定して、その交点ごとに数値を合計するクロス集計です。横軸を使わない1方向集計もできます。',wrap,'lead');
 if(!renderUpload(wrap))return;
 renderMappingWorkspace(wrap);renderPreview(wrap);
 const s=section('集計設定',wrap);
 if(!result)return el('p','変換プレビューを実行してください。',s,'status');
 const available=recordFields();
 const numericFields=numericRecordFields();
 if(!aggregateConfig.rowField&&aggregateConfig.group1)aggregateConfig.rowField=aggregateConfig.group1;
 if(!aggregateConfig.rowField||!available.includes(aggregateConfig.rowField)){
   aggregateConfig.rowField=available.find(x=>!numericFields.includes(x))||available[0]||'';
 }
 if(aggregateConfig.columnField&&!available.includes(aggregateConfig.columnField))aggregateConfig.columnField='';
 if(!aggregateConfig.valueField||!numericFields.includes(aggregateConfig.valueField)){
   aggregateConfig.valueField=numericFields[0]||'';
 }
 el('span','縦軸: ',s);
 select(available.map(x=>[x,x]),aggregateConfig.rowField,v=>{aggregateConfig.rowField=v;if(aggregateConfig.columnField===v)aggregateConfig.columnField='';render();},s);
 el('span','横軸: ',s);
 select([['','使わない（1方向集計）'],...available.filter(x=>x!==aggregateConfig.rowField).map(x=>[x,x])],aggregateConfig.columnField,v=>{aggregateConfig.columnField=v;render();},s);
 el('span','合計する数値項目: ',s);
 select(numericFields.map(x=>[x,x]),aggregateConfig.valueField,v=>{aggregateConfig.valueField=v;render();},s);
 if(!aggregateConfig.rowField||!aggregateConfig.valueField){
   return el('p','縦軸と数値項目を選択してください。',s,'warning');
 }
 try{
   const pivot=buildPivotTable(result.records,{
     rowField:aggregateConfig.rowField,
     columnField:aggregateConfig.columnField,
     valueField:aggregateConfig.valueField
   });
   const mode=aggregateConfig.columnField
     ?aggregateConfig.rowField+' × '+aggregateConfig.columnField
     :aggregateConfig.rowField;
   el('p',mode+' を基準に '+aggregateConfig.valueField+' を合計しています。',s,'status');
   renderTable(s,matrixToObjects(pivot.rows),200);
   if(pivot.skippedValueCount)el('p','数値として読めなかった '+pivot.skippedValueCount+' 行は合計から除外しました。元データ自体は変更していません。',s,'warning');
   const out=section('集計結果を抽出',wrap);
   const info=inputFileInfo();
   el('p','入力形式に合わせて集計表だけを返します。CSV→CSV、Excel→Excel'+(info.ext==='tsv'?'、TSV→TSV':'')+'。元ファイルは上書きしません。',out,'status');
   button((info.ext==='xlsx'?'Excel':'CSV/TSV')+'で集計結果を抽出',async()=>{
     try{await saveRowsLikeInput(pivot.rows,'集計結果');}
     catch(e){alert('集計結果の出力失敗: '+e.message);}
   },out);
   el('p','出力ファイルには集計された表だけを入れ、入力データの明細は複製しません。処理はブラウザ内で完結します。',out,'status');
 }catch(e){el('p',e.message,s,'error');}
}
function renderReportPurposeGuide(parent,purpose){
 const s=section('使い方ガイド / サンプル',parent);
 el('p','前年データや既存テンプレートがなくても開始できます。架空の前年値は補完せず、まず下記のような列を用意すると集計しやすくなります。',s,'status');
 const fields=el('div',undefined,s,'guide-fields');
 purpose.suggestedFields.forEach(x=>el('span',x,fields,'guide-chip'));
 el('h3','入力例',s);
 renderTable(s,purpose.sample,10);
 button('この入力例をサンプルCSVで保存',()=>saveCsv('data-shaper-'+purpose.id+'-sample.csv',exportObjectRows(purpose.sample)),s,'secondary-button');
 el('p','サンプル値は使い方説明用であり、利用者の実績値・税務判断・推奨値ではありません。',s,'status');
}

function ensureReportConfig(){
 const available=recordFields();
 const numeric=numericRecordFields();
 const preferredCategory=['category','account_name','sku_name','location_name'].find(x=>available.includes(x));
 if(!reportConfig.categoryField||!available.includes(reportConfig.categoryField))reportConfig.categoryField=preferredCategory||available.find(x=>!numeric.includes(x))||available[0]||'';
 if(!reportConfig.amountField||!numeric.includes(reportConfig.amountField))reportConfig.amountField=available.includes('amount')?'amount':numeric[0]||'';
 if(reportConfig.flowField&&!available.includes(reportConfig.flowField))reportConfig.flowField='';
 if(!reportConfig.flowField&&available.includes('flow_type'))reportConfig.flowField='flow_type';
 return {available,numeric};
}

function addTaxRule(){
 taxConfig.rules=[...taxConfig.rules,{id:crypto.randomUUID(),label:'',business:'',category:'',from:'',to:'',rate:''}];
 render();
}
function removeTaxRule(id){taxConfig.rules=taxConfig.rules.filter(r=>r.id!==id);render();}
function renderTaxSettings(parent){
 const s=section('税率設定',parent);
 el('p','税率はData Shaperが業種から推測せず、登録されたルールだけを使用します。事業区分・税区分・適用期間・税率を設定してください。同じ条件で適用期間が重複すると計算を停止します。',s,'status');
 el('p','税務申告の判定ではなく計算補助です。税率・課税区分・適用期間は利用者自身で確認してください。',s,'legal-note');
 if(!taxConfig.rules.length)el('p','税率ルールはまだ登録されていません。必要な場合だけ追加してください。',s,'status');
 taxConfig.rules.forEach((rule,index)=>{
   const row=el('div',undefined,s,'tax-rule-row');
   const label=el('input',undefined,row);label.placeholder=tr('税率ルール')+' '+(index+1);label.value=rule.label||'';label.addEventListener('change',()=>{rule.label=label.value.trim();render();});
   const business=el('input',undefined,row);business.placeholder=tr('事業区分');business.value=rule.business||'';business.addEventListener('change',()=>{rule.business=business.value.trim();render();});
   const category=el('input',undefined,row);category.placeholder=tr('税区分');category.value=rule.category||'';category.addEventListener('change',()=>{rule.category=category.value.trim();render();});
   const from=el('input',undefined,row);from.type='date';from.value=rule.from||'';from.title=tr('適用開始');from.addEventListener('change',()=>{rule.from=from.value;render();});
   const to=el('input',undefined,row);to.type='date';to.value=rule.to||'';to.title=tr('適用終了');to.addEventListener('change',()=>{rule.to=to.value;render();});
   const rate=el('input',undefined,row);rate.type='number';rate.min='0';rate.max='100';rate.step='0.01';rate.placeholder=tr('税率 (%)');rate.value=rule.rate??'';rate.addEventListener('change',()=>{rule.rate=rate.value;render();});
   button('税率ルールを削除',()=>removeTaxRule(rule.id),row,'secondary-button');
 });
 button('税率ルールを追加',addTaxRule,s);
 try{validateTaxRules(taxConfig.rules);if(taxConfig.rules.length)el('p','税率ルールの期間重複・入力形式チェック：OK',s,'status');}
 catch(e){el('p','税率ルールエラー: '+e.message,s,'error');}
 if(!result||!taxConfig.rules.length)return;
 const available=recordFields(),numeric=numericRecordFields();
 if(taxConfig.dateField&&!available.includes(taxConfig.dateField))taxConfig.dateField=available.includes('date')?'date':'';
 if(taxConfig.businessField&&!available.includes(taxConfig.businessField))taxConfig.businessField=available.includes('business_unit')?'business_unit':'';
 if(taxConfig.categoryField&&!available.includes(taxConfig.categoryField))taxConfig.categoryField=available.includes('tax_category')?'tax_category':'';
 if(taxConfig.amountField&&!numeric.includes(taxConfig.amountField))taxConfig.amountField=numeric.includes('amount')?'amount':numeric[0]||'';
 el('span','取引日列: ',s);select([['','選択してください'],...available.map(x=>[x,x])],taxConfig.dateField,v=>{taxConfig.dateField=v;render();},s);
 el('span','事業区分列（任意）: ',s);select([['','なし'],...available.map(x=>[x,x])],taxConfig.businessField,v=>{taxConfig.businessField=v;render();},s);
 el('span','税区分列（任意）: ',s);select([['','なし'],...available.map(x=>[x,x])],taxConfig.categoryField,v=>{taxConfig.categoryField=v;render();},s);
 el('span','税計算対象金額列: ',s);select(numeric.map(x=>[x,x]),taxConfig.amountField,v=>{taxConfig.amountField=v;render();},s);
 el('span','金額の扱い: ',s);select([['exclusive','税抜金額'],['inclusive','税込金額']],taxConfig.basis,v=>{taxConfig.basis=v;render();},s);
 el('span','端数処理: ',s);select([['floor','切り捨て'],['round','四捨五入'],['ceil','切り上げ']],taxConfig.rounding,v=>{taxConfig.rounding=v;render();},s);
 if(!taxConfig.dateField||!taxConfig.amountField)return el('p','取引日列と金額列を選択してください。',s,'warning');
 try{
   const out=applyTaxRules(result.records,taxConfig);
   el('p','適用 '+out.matched+' 件 / ルールなし '+out.unmatched+' 件 / 日付不正 '+out.invalidDate+' 件 / 曖昧 '+out.ambiguous+' 件',s,(out.unmatched||out.invalidDate||out.ambiguous)?'warning':'status');
   const preview=out.rows.slice(0,100).map(row=>({
     [taxConfig.dateField]:row[taxConfig.dateField],
     [taxConfig.businessField||'business']:taxConfig.businessField?row[taxConfig.businessField]:'',
     [taxConfig.categoryField||'category']:taxConfig.categoryField?row[taxConfig.categoryField]:'',
     [taxConfig.amountField]:row[taxConfig.amountField],
     tax_rate:row.tax_rate,tax_amount:row.tax_amount,amount_ex_tax:row.amount_ex_tax,amount_in_tax:row.amount_in_tax,tax_rule:row.tax_rule,tax_status:row.tax_status
   }));
   el('h3',tr('税率計算プレビュー'),s);renderTable(s,preview,100);
   renderOutputChoice(s,{title:'Data Shaper Tax Calculation Helper',filenameBase:'data-shaper-tax-helper',rows:objectRowsToRows(out.rows),note:tr(reportDisclaimer)});
 }catch(e){el('p','税率計算を停止しました: '+e.message,s,'error');}
}
function renderDepreciationHelper(parent){
 const s=section('減価償却計算補助',parent);
 el('p','税務上の法定償却率・保証率・改定償却率をData Shaperが自動決定する機能ではありません。定率法は確認済みの年率を入力して参考計算します。期中取得の月割り、資産区分ごとの法定耐用年数、税務上の償却保証額への切替は自動判定しません。',s,'legal-note');
 const grid=el('div',undefined,s,'depreciation-grid');
 const addNumber=(label,key,min='0')=>{const box=el('label',undefined,grid);el('span',label,box);const i=el('input',undefined,box);i.type='number';i.min=min;i.step='0.01';i.value=depreciationConfig[key]??'';i.addEventListener('change',()=>{depreciationConfig[key]=i.value;depreciationConfig.result=null;});return i;};
 addNumber(tr('取得価額'),'cost');
 addNumber(tr('残存価額'),'residual');
 addNumber(tr('耐用年数（年）'),'lifeYears','1');
 const methodBox=el('label',undefined,grid);el('span',tr('計算方法'),methodBox);select([['straight_line','定額法'],['declining_custom','定率法（率を指定）']],depreciationConfig.method,v=>{depreciationConfig.method=v;depreciationConfig.result=null;render();},methodBox);
 if(depreciationConfig.method==='declining_custom')addNumber(tr('定率法の年率 (%)'),'decliningRate','0.01');
 button('計算',()=>{try{depreciationConfig.result=buildDepreciationSchedule(depreciationConfig);render();}catch(e){alert('減価償却計算: '+e.message);}},s);
 if(depreciationConfig.result){
   const rows=depreciationConfig.result.rows.map(x=>({[tr('年')]:x.year,[tr('期首簿価')]:x.opening_book_value,[tr('減価償却費')]:x.depreciation,[tr('期末簿価')]:x.closing_book_value}));
   renderTable(s,rows,100);
   renderOutputChoice(s,{title:'Data Shaper Depreciation Helper',filenameBase:'data-shaper-depreciation-helper',rows:objectRowsToRows(rows),note:tr(reportDisclaimer)});
 }
}

function renderInlinePaidGate(parent,requiredTier){
 const isPro=requiredTier==='pro';
 const label=isPro?'Pro':'Lite';
 const price=isPro?'¥980 / 月':'¥480 / 月';
 const s=section(label+'：詳細機能',parent);
 el('span',label,s,'plan-badge '+(isPro?'pro':'lite'));
 if(!authState.loaded)return el('p','ログイン状態を確認しています。',s,'status');
 if(!authState.authenticated){
   el('p','Freeでは簡易レポートまで利用できます。'+label+'では詳細出力・再利用機能を開放します。',s,'pro-note');
   const login=el('a','Googleでログイン',s,'login-link');login.href='/api/auth/google/start';return;
 }
 if(isPro){
   el('p','決算・勘定科目対応はPro機能です。Googleログインだけでは開放せず、Stripe entitlementを確認します。',s,'pro-note');
   if(billingState.ready){
     el('p','現在はStripe TEST環境です。実際の請求は発生しません。',s,'status');
     button('TEST Proを開始（月額 ¥980）',()=>startTestCheckout('pro'),s);
   }
 }else{
   if(billingState.liteReady){
     el('p','現在はStripe TEST環境です。実際の請求は発生しません。',s,'status');
     button('TEST Liteを開始（月額 ¥480）',()=>startTestCheckout('lite'),s);
   }else{
     el('p','Liteの価格は月額¥480で確定済みです。Stripe TEST Priceが未接続の間は購入ボタンを開放しません。現在のPro契約者はLite機能も利用できます。',s,'pro-note');
   }
 }
}

function renderStatementPreview(parent,agg,purpose){
 const s=section('Pro：'+purpose.proLabel,parent);
 el('span','Pro',s,'plan-badge pro');
 el('p','公式申告書そのものではなく、勘定科目の対応・集約・貸借確認を行う入力準備資料です。',s,'status');
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
 renderOutputChoice(s,{
   title:'Data Shaper '+tr(purpose.proLabel),
   filenameBase:'data-shaper-'+purpose.id+'-statement-prep',
   rows:aggregationToRows(agg),
   note:tr(reportDisclaimer)
 });
 el('p',reportDisclaimer,s,'legal-note');
}

function renderBalance(){
 const wrap=el('div',undefined,app,'workspace-panel');
 el('p','法人・個人事業・家計を同じ入口から整理します。Freeは簡易サマリー、Liteは家計・自由形式の詳細レポート、Proは法人・個人事業の決算・申告準備を扱います。',wrap,'lead');
 const purposeSection=section('レポートの目的',wrap);
 el('span','Free / Lite / Pro',purposeSection,'plan-badge mixed');
 select(reportPurposes.map(x=>[x.id,x.label]),reportConfig.purpose,v=>{reportConfig.purpose=v;reportConfig.categoryField='';reportConfig.amountField='';reportConfig.flowField='';render();},purposeSection);
 const purpose=getReportPurpose(reportConfig.purpose);
 el('p',purpose.description,purposeSection,'status');
 renderReportPurposeGuide(wrap,purpose);
 el('p',reportDisclaimer,wrap,'legal-note');
 renderTaxSettings(wrap);

 if(!renderUpload(wrap))return;
 renderMappingWorkspace(wrap);renderPreview(wrap);
 const s=section('Free：'+purpose.freeLabel,wrap);
 el('span','Free',s,'plan-badge free');
 if(!result)return el('p','列のMappingを確認して「変換プレビューを実行」してください。',s,'status');
 const {available,numeric}=ensureReportConfig();
 if(!available.length||!numeric.length)return el('p','分類項目と数値項目を確認してください。',s,'warning');
 el('span','分類に使う項目: ',s);
 select(available.map(x=>[x,x]),reportConfig.categoryField,v=>{reportConfig.categoryField=v;render();},s);
 el('span','金額項目: ',s);
 select(numeric.map(x=>[x,x]),reportConfig.amountField,v=>{reportConfig.amountField=v;render();},s);
 el('span','収支区分（任意）: ',s);
 select([['','使わない'],...available.map(x=>[x,x])],reportConfig.flowField,v=>{reportConfig.flowField=v;render();},s);
 try{
   const simple=buildSimpleReport(result.records,reportConfig);
   const metrics=el('div',undefined,s,'metric-grid');
   [['有効行',simple.validRows],['金額合計',simple.total.toLocaleString()]].forEach(([k,v])=>{const card=el('div',undefined,metrics,'metric-card');el('strong',String(v),card);el('span',k,card);});
   if(simple.cashflow?.available){
     [['収入',simple.cashflow.income],['支出',simple.cashflow.expense],['収支差額',simple.cashflow.net]].forEach(([k,v])=>{const card=el('div',undefined,metrics,'metric-card');el('strong',Number(v).toLocaleString(),card);el('span',k,card);});
     if(simple.cashflow.unknownFlowRows)el('p','収支区分を判定できない行が '+simple.cashflow.unknownFlowRows+' 件あります。勝手に収入・支出へ分類しません。',s,'warning');
   }else if(reportConfig.flowField){
     el('p','収支区分列を選択しましたが「収入 / 支出」等を判定できませんでした。金額合計と分類別集計のみ表示します。',s,'warning');
   }
   el('h3','分類別 上位5項目',s);
   renderTable(s,simple.categories.slice(0,5).map(x=>({分類:x.category,金額:x.amount})),5);
   const freeReport={...simple,categories:simple.categories.slice(0,5)};
   renderOutputChoice(s,{
     title:'Data Shaper '+tr(purpose.freeLabel),
     filenameBase:'data-shaper-'+purpose.id+'-free-report',
     rows:simpleReportToRows(freeReport,purpose.id,{language:language()}),
     note:tr(reportDisclaimer)
   });
   el('p','Freeでは上位5分類までを簡易出力します。法人・個人事業の正式な決算整理はProです。元ファイルはWorkerへ保存しません。',s,'status');

   const requiredTier=['corporate','sole_blue','sole_white'].includes(purpose.id)?'pro':'lite';
   if(!hasTier(requiredTier)){renderInlinePaidGate(wrap,requiredTier);return;}

   const detail=section((requiredTier==='pro'?'Pro':'Lite')+'：詳細内訳',wrap);
   el('span',requiredTier==='pro'?'Pro':'Lite',detail,'plan-badge '+requiredTier);
   renderTable(detail,simple.categories.map(x=>({分類:x.category,金額:x.amount})),200);
   renderOutputChoice(detail,{
     title:'Data Shaper '+tr(purpose.proLabel),
     filenameBase:'data-shaper-'+purpose.id+'-'+requiredTier+'-report',
     rows:simpleReportToRows(simple,purpose.id,{language:language()}),
     note:tr(reportDisclaimer)
   });
   el('p','前年データがない場合、比較率や前年比を推測して作りません。前年ファイルを追加できた場合だけ比較指標を計算する方針です。',detail,'status');

   if(['corporate','sole_blue'].includes(purpose.id)){
     renderTemplateEditor(wrap);
     renderSourceColumnConfig(wrap);
     const agg=currentStatementAggregation();
     if(agg){
       renderAccountMapping(wrap,agg);
       renderStatementPreview(wrap,agg,purpose);
     }
     renderDepreciationHelper(wrap);
   }else if(purpose.id==='sole_white'){
     const note=section('Pro：白色申告向け整理',wrap);
     el('p','収入・費目別の詳細集計を入力準備資料として出します。税務上の必要経費該当性や申告書の完成判断は行いません。',note,'status');
   }else if(purpose.id==='household'){
     const note=section('Lite：家計の詳細利用',wrap);
     el('p','提出書類ではなく、家計管理・相談用の詳細内訳として利用します。過去データが追加された場合だけ期間比較を行う設計にします。',note,'status');
   }
 }catch(e){el('p',e.message,s,'error');}
}
function renderRecipe(){
 if(!sheets.length||workspaceTab==='free')return;
 const s=section('Recipe / 再利用');
 button('現在の設定をRecipe保存',()=>{
   const out=buildRecipe({sheets,analysis,options,profile,orientation,wideValueField,aggregateConfig,reportConfig,taxConfig,bsConfig,batchOptions,statementTemplate,templateMappings,statementConfig});
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
     reportConfig={...reportConfig,...(recipe.reportConfig||{})};
     taxConfig={...taxConfig,...(recipe.taxConfig||{}),rules:Array.isArray(recipe.taxConfig?.rules)?recipe.taxConfig.rules:taxConfig.rules};
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
 app.replaceChildren();el('h1','Data Shaper',app);renderLanguageControl();el('p','軽量集計はFree、データ整形はLite、決算・勘定科目対応はProとしてLocal Firstで処理します。',app,'subtitle');renderAuthBar();renderPlanOverview();renderTabs();
 if(workspaceTab==='free')renderFree();
 if(workspaceTab==='pro')(liteAuthorized()?renderPro():renderInlinePaidGate(app,'lite'));
 if(workspaceTab==='aggregate')renderAggregate();
 if(workspaceTab==='balance')renderBalance();
 if(liteAuthorized())renderRecipe();
 const footer=el('footer',undefined,app,'app-footer');
 const privacy=el('a','プライバシー',footer);privacy.href='/legal/privacy/';
 const terms=el('a','利用規約',footer);terms.href='/legal/terms/';
 const disclosure=el('a','運営者情報・情報開示',footer);
 disclosure.href='/api/legal/disclosure';
 disclosure.rel='noreferrer';
 applyTranslations(app);
}
initLanguage();
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
