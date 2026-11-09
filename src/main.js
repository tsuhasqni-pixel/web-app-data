import {readWorkbook} from './parser/index.js';
import {detect,fields} from './detector/index.js';
import {transform} from './transform/index.js';
import {validate} from './validator/index.js';
import {aggregateRecords,buildBalanceSheet,balanceSheetSections} from './aggregate/index.js';
import {exportCSV,exportObjectRows,exportBalanceSheet,saveText} from './exporter/index.js';
import './style.css';

const app=document.querySelector('#app');
let sheets=[],selected=null,analysis=null,result=null,report=null;
let profile='demand',mode='normalize',orientation='auto',wideValueField='demand_qty';
let options={trim:true,width:true,dates:true};
let aggregateConfig={group1:'',group2:'',valueField:'amount',method:'sum'};
let bsConfig={accountField:'account_name',amountField:'amount',assignments:{}};

function el(tag,text,parent,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;(parent||app).appendChild(e);return e;}
function button(text,onClick,parent){const b=el('button',text,parent);b.type='button';b.addEventListener('click',onClick);return b;}
function select(values,value,onChange,parent){const e=el('select',undefined,parent);for(const [v,t] of values){const o=el('option',t,e);o.value=v;}e.value=value;e.addEventListener('change',()=>onChange(e.value));return e;}
function section(title){const s=el('section');el('h2',title,s);return s;}
function status(text){return el('p',text,app,'status');}
function clearResult(){result=null;report=null;}
function recordFields(){
  if(!result)return [];
  return [...new Set(result.records.flatMap(r=>Object.keys(r)))].filter(x=>!['source_file','source_sheet','source_row'].includes(x));
}
function renderTable(parent,rows,limit=15){
  if(!rows.length){el('p','表示できるデータがありません。',parent,'status');return;}
  const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];
  const wrap=el('div',undefined,parent,'preview');const tbl=el('table',undefined,wrap);const hr=el('tr',undefined,tbl);
  keys.forEach(k=>el('th',k,hr));
  rows.slice(0,limit).forEach(rec=>{const row=el('tr',undefined,tbl);keys.forEach(k=>el('td',String(rec[k]??''),row));});
}

function runTransform(){
  result=transform(analysis,analysis.mapping,{
    ...options,
    sourceFile:selected.sourceFile||'',
    sourceSheet:selected.name||'',
    orientation,
    wideValueField
  });
  report=validate(analysis,result,mode==='normalize'?profile:'generic');
}

function renderNormalize(parent){
  el('h3','通常整形・出力',parent);
  select([['demand','DemandScope (long CSV)'],['inventory','Inventory Manager CSV'],['generic','Generic Clean CSV']],profile,v=>{profile=v;if(result)report=validate(analysis,result,profile);render();},parent);
  if(!result)return el('p','変換プレビューを実行すると、出力前の品質検査を確認できます。',parent,'status');
  [...report.errors.map(x=>'エラー: '+x),...report.warnings.map(x=>'注意: '+x)].forEach(t=>el('p',t,parent,t.startsWith('エラー')?'error':'warning'));
  const exportButton=button('品質検査済みCSVを出力',()=>saveText('data-shaper-'+profile+'.csv',exportCSV(result.records,profile),'text/csv;charset=utf-8'),parent);
  exportButton.disabled=report.errors.length>0;
  if(exportButton.disabled)el('p','安全検査が未通過です。列マッピングまたは値を確認してください。',parent,'error');
}

function renderAggregate(parent){
  el('h3','集計モード',parent);
  if(!result)return el('p','先に変換プレビューを実行してください。',parent,'status');
  const available=recordFields(); if(!available.length)return;
  if(!aggregateConfig.group1||!available.includes(aggregateConfig.group1))aggregateConfig.group1=available[0]||'';
  if(!available.includes(aggregateConfig.valueField))aggregateConfig.valueField=available.find(x=>['amount','demand_qty','inventory_on_hand','inbound_qty','outbound_qty','debit','credit'].includes(x))||available[0]||'';
  el('span','集計キー1: ',parent);
  select(available.map(x=>[x,x]),aggregateConfig.group1,v=>{aggregateConfig.group1=v;render();},parent);
  el('span','集計キー2: ',parent);
  select([['','なし'],...available.filter(x=>x!==aggregateConfig.group1).map(x=>[x,x])],aggregateConfig.group2,v=>{aggregateConfig.group2=v;render();},parent);
  el('span','数値列: ',parent);
  select(available.map(x=>[x,x]),aggregateConfig.valueField,v=>{aggregateConfig.valueField=v;render();},parent);
  el('span','方法: ',parent);
  select([['sum','合計'],['avg','平均'],['count','件数'],['min','最小'],['max','最大']],aggregateConfig.method,v=>{aggregateConfig.method=v;render();},parent);
  try{
    const groupBy=[aggregateConfig.group1,aggregateConfig.group2].filter(Boolean);
    const rows=aggregateRecords(result.records,{groupBy,valueField:aggregateConfig.valueField,method:aggregateConfig.method});
    el('p','集計結果 '+rows.length+' 行（元データ '+result.records.length+' 行）',parent);
    renderTable(parent,rows,30);
    button('集計結果CSVを出力',()=>saveText('data-shaper-aggregate.csv',exportObjectRows(rows),'text/csv;charset=utf-8'),parent);
  }catch(e){el('p','集計設定: '+e.message,parent,'error');}
}

function renderBalanceSheet(parent){
  el('h3','貸借対照表レイアウト支援',parent);
  el('p','勘定科目と金額を集計し、指定した表示区分へ並べます。自動で会計判断や仕訳修正は行いません。',parent,'status');
  if(!result)return el('p','先に変換プレビューを実行してください。',parent,'status');
  const available=recordFields();
  if(!available.includes(bsConfig.accountField))bsConfig.accountField=available.includes('account_name')?'account_name':available[0]||'';
  if(!available.includes(bsConfig.amountField))bsConfig.amountField=available.includes('amount')?'amount':available.find(x=>['debit','credit','demand_qty'].includes(x))||available[0]||'';
  el('span','勘定科目列: ',parent);
  select(available.map(x=>[x,x]),bsConfig.accountField,v=>{bsConfig.accountField=v;bsConfig.assignments={};render();},parent);
  el('span','金額列: ',parent);
  select(available.map(x=>[x,x]),bsConfig.amountField,v=>{bsConfig.amountField=v;render();},parent);
  let sheet;
  try{sheet=buildBalanceSheet(result.records,bsConfig);}catch(e){el('p','貸借対照表プレビュー: '+e.message,parent,'error');return;}
  const accounts=[...new Set(result.records.map(r=>String(r[bsConfig.accountField]??'')).filter(Boolean))];
  const mapBox=el('div',undefined,parent,'mapping-grid');
  accounts.slice(0,100).forEach(account=>{
    const line=el('div',undefined,mapBox,'mapping-row');el('span',account,line);
    select([['','未分類'],...balanceSheetSections],bsConfig.assignments[account]||'',v=>{bsConfig.assignments[account]=v;render();},line);
  });
  if(accounts.length>100)el('p','科目が100件を超えるため、先頭100件のみ画面で分類できます。Recipe拡張で対応予定です。',parent,'warning');
  sheet=buildBalanceSheet(result.records,bsConfig);
  const grid=el('div',undefined,parent,'statement-grid');
  for(const [id,label] of balanceSheetSections){
    const card=el('div',undefined,grid,'statement-card');el('h4',label,card);
    for(const item of sheet.sections[id].items)el('div',item.account+'　'+item.amount.toLocaleString(),card,'statement-line');
    el('strong','合計 '+sheet.sections[id].total.toLocaleString(),card);
  }
  if(sheet.unclassified.length){
    const u=el('div',undefined,grid,'statement-card');el('h4','未分類',u);
    sheet.unclassified.slice(0,30).forEach(item=>el('div',item.account+'　'+item.amount.toLocaleString(),u,'statement-line'));
  }
  const t=sheet.totals;
  el('p','資産 '+t.assets.toLocaleString()+' / 負債 '+t.liabilities.toLocaleString()+' / 純資産 '+t.equity.toLocaleString()+' / 貸借差額 '+t.difference.toLocaleString(),parent,Math.abs(t.difference)>1e-8?'warning':'status');
  if(Math.abs(t.difference)>1e-8)el('p','貸借が一致していません。未分類科目・符号・入力金額を確認してください。アプリは自動補正しません。',parent,'warning');
  button('貸借対照表プレビューCSVを出力',()=>saveText('data-shaper-balance-sheet.csv',exportBalanceSheet(sheet),'text/csv;charset=utf-8'),parent);
}

function render(){
 app.replaceChildren();
 el('h1','Data Shaper',app);
 el('p','企業のCSV / XLSXを、ファイルを送信せずブラウザ内で診断・整形・集計します。',app,'subtitle');

 const f=section('1. ファイル選択 / Inspect');
 const input=el('input',undefined,f);input.type='file';input.accept='.csv,.tsv,.xlsx';input.addEventListener('change',async()=>{
   try{sheets=await readWorkbook(input.files[0]);selected=sheets[0];analysis=detect(selected.rows);clearResult();bsConfig.assignments={};render();}
   catch(err){alert('読み込み失敗: '+err.message);}
 });
 if(!sheets.length){status('処理対象のファイルを選択してください。最大15 MB。UTF-8 CSV / TSV、XLSXに対応。');return;}
 el('span','シート: ',f);
 select(sheets.map((s,i)=>[String(i),s.name]),String(sheets.indexOf(selected)),i=>{selected=sheets[Number(i)];analysis=detect(selected.rows);clearResult();bsConfig.assignments={};render();},f);
 el('p',selected.rows.length+' 行 / '+Math.max(0,...selected.rows.map(r=>r.length))+' 列',f);

 const s=section('2. 構造診断 / Detect');
 const label=el('label','ヘッダー行（1始まり） ',s);
 const header=el('input',undefined,label);header.type='number';header.min='1';header.max=String(selected.rows.length);header.value=String(analysis.headerRow+1);
 button('ヘッダー位置を適用',()=>{
   const i=Number(header.value)-1;if(!Number.isInteger(i)||i<0||i>=selected.rows.length)return alert('無効な行番号です');
   analysis=detect(selected.rows.slice(i));analysis.headerRow+=i;analysis.data=selected.rows.slice(i+1).filter(r=>r.some(v=>String(v??'').trim()!==''));clearResult();render();
 },s);
 el('span',' データ形式: ',s);
 select([['auto','自動判定'],['long','縦持ち'],['wide','横持ち']],orientation,v=>{orientation=v;clearResult();render();},s);
 const effective=orientation==='auto'?analysis.orientation:orientation;
 el('p','自動判定: '+(analysis.orientation==='wide'?'横持ち':'縦持ち')+' / 実際に使用: '+(effective==='wide'?'横持ち':'縦持ち')+' / データ行数: '+analysis.data.length,s);
 if(effective==='wide'){
   el('span','横持ちの日付列を展開した値の意味: ',s);
   select([['demand_qty','需要・販売数量'],['inventory_on_hand','在庫'],['inbound_qty','入庫'],['outbound_qty','出庫'],['amount','金額']],wideValueField,v=>{wideValueField=v;clearResult();render();},s);
 }
 for(const w of analysis.warnings)el('p','注意: '+w,s,'warning');

 const m=section('3. 列の対応 / Map & Confirm');
 const table=el('table',undefined,m);const tr=el('tr',undefined,table);['元の列名','出力フィールド','推定信頼度'].forEach(t=>el('th',t,tr));
 analysis.header.forEach((h,i)=>{
   const row=el('tr',undefined,table);el('td',String(h??'(空欄)'),row);const cell=el('td',undefined,row);
   select([['','使用しない'],...fields.map(x=>[x,x])],analysis.mapping[i]||'',v=>{analysis.mapping[i]=v;clearResult();},cell);
   el('td',analysis.confidence[i]?Math.round(analysis.confidence[i]*100)+'%':'手動確認',row);
 });

 const r=section('4. 整形・処理モード / Transform');
 [['trim','前後空白を除く'],['width','文字幅を統一 (NFKC)'],['dates','日付表記を統一']].forEach(([key,text])=>{
   const label=el('label',undefined,r,'check');const c=el('input',undefined,label);c.type='checkbox';c.checked=options[key];
   c.addEventListener('change',()=>{options[key]=c.checked;clearResult();});el('span',text,label);
 });
 el('div',undefined,r,'mode-row');
 select([['normalize','通常整形'],['aggregate','集計'],['balance_sheet','貸借対照表レイアウト']],mode,v=>{mode=v;clearResult();render();},r);
 button('変換プレビューと品質検査を実行',()=>{try{runTransform();render();}catch(e){alert('変換失敗: '+e.message);}},r);

 const p=section('5. プレビュー / Validate & Export');
 if(result){
   el('p','入力 '+report.stats.inputRows+' 行 / 変換後 '+report.stats.outputRows+' 行 / 変更セル '+report.stats.changedCells+' 件',p);
   renderTable(p,result.records,15);
   if(result.changes.length){
     el('p','Before / After 変更例（最大15件）',p);
     renderTable(p,result.changes,15);
   }
 }else el('p','上のボタンでプレビューを生成してください。',p,'status');
 if(mode==='normalize')renderNormalize(p);
 if(mode==='aggregate')renderAggregate(p);
 if(mode==='balance_sheet')renderBalanceSheet(p);

 const rec=section('6. Recipe / 再利用');
 button('現在の変換ルールをRecipe JSONで保存',()=>{
   const out={schema_version:2,header_row:analysis.headerRow+1,source_headers:analysis.header,mapping:analysis.mapping,options,profile,mode,orientation,wideValueField,aggregateConfig,bsConfig};
   saveText('data-shaper-recipe.json',JSON.stringify(out,null,2),'application/json');
 },rec);
 const recInput=el('input',undefined,rec);recInput.type='file';recInput.accept='.json';recInput.addEventListener('change',async()=>{
   try{
     const x=JSON.parse(await recInput.files[0].text());
     if(![1,2].includes(x.schema_version)||!Array.isArray(x.source_headers)||JSON.stringify(x.source_headers)!==JSON.stringify(analysis.header))throw new Error('列構造が一致しないためRecipeを適用しません');
     if(!x.mapping||Object.values(x.mapping).some(v=>v&&!fields.includes(v)))throw new Error('Invalid mapping');
     analysis.mapping={...x.mapping};options={trim:!!x.options?.trim,width:!!x.options?.width,dates:!!x.options?.dates};
     profile=['demand','inventory','generic'].includes(x.profile)?x.profile:'demand';
     mode=['normalize','aggregate','balance_sheet'].includes(x.mode)?x.mode:'normalize';
     orientation=['auto','long','wide'].includes(x.orientation)?x.orientation:'auto';
     wideValueField=x.wideValueField||'demand_qty';
     aggregateConfig={...aggregateConfig,...(x.aggregateConfig||{})};
     bsConfig={...bsConfig,...(x.bsConfig||{}),assignments:{...(x.bsConfig?.assignments||{})}};
     clearResult();render();
   }catch(e){alert('Recipe適用不可: '+e.message);}
 });
}
render();
