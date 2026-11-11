export const templateSections=[
  ['current_assets','流動資産','debit'],
  ['noncurrent_assets','固定資産','debit'],
  ['current_liabilities','流動負債','credit'],
  ['noncurrent_liabilities','固定負債','credit'],
  ['equity','純資産','credit']
];

const starterRows=[
  ['cash_and_deposits','現金及び預金','current_assets','debit',['現金','現金預金','普通預金','当座預金','定期預金']],
  ['notes_and_accounts_receivable','受取手形及び売掛金','current_assets','debit',['受取手形','売掛金','電子記録債権']],
  ['inventories','棚卸資産','current_assets','debit',['商品','製品','半製品','仕掛品','原材料','貯蔵品','棚卸資産']],
  ['other_current_assets','その他流動資産','current_assets','debit',['前払費用','未収入金','未収収益','前渡金','仮払金','立替金','短期貸付金']],
  ['property_plant_equipment','有形固定資産','noncurrent_assets','debit',['建物','建物附属設備','構築物','機械装置','車両運搬具','工具器具備品','土地','建設仮勘定']],
  ['intangible_assets','無形固定資産','noncurrent_assets','debit',['ソフトウェア','のれん','特許権','商標権']],
  ['investments_other_assets','投資その他の資産','noncurrent_assets','debit',['投資有価証券','関係会社株式','長期貸付金','敷金','保証金','長期前払費用','繰延税金資産']],
  ['notes_and_accounts_payable','支払手形及び買掛金','current_liabilities','credit',['支払手形','買掛金','電子記録債務']],
  ['short_term_borrowings','短期借入金等','current_liabilities','credit',['短期借入金','1年内返済長期借入金','一年内返済長期借入金']],
  ['other_current_liabilities','その他流動負債','current_liabilities','credit',['未払金','未払費用','未払法人税等','未払消費税','前受金','預り金','仮受金','賞与引当金']],
  ['long_term_borrowings','長期借入金','noncurrent_liabilities','credit',['長期借入金','社債']],
  ['other_noncurrent_liabilities','その他固定負債','noncurrent_liabilities','credit',['長期未払金','退職給付引当金','役員退職慰労引当金','資産除去債務','繰延税金負債']],
  ['capital_stock','資本金','equity','credit',['資本金']],
  ['capital_surplus','資本剰余金','equity','credit',['資本準備金','資本剰余金']],
  ['retained_earnings','利益剰余金','equity','credit',['利益準備金','利益剰余金','繰越利益剰余金']],
  ['treasury_stock','自己株式','equity','debit',['自己株式']]
];

const norm=v=>String(v??'').trim().normalize('NFKC').toLowerCase().replace(/[\s　_\-・･]/g,'');
const num=v=>{
  if(v===null||v===undefined||v==='')return null;
  const n=Number(String(v).replace(/,/g,'').trim());
  return Number.isFinite(n)?n:null;
};
const sectionMeta=id=>{
  const found=templateSections.find(([x])=>x===id);
  return found?{label:found[1],normalBalance:found[2]}:{label:'未分類',normalBalance:'debit'};
};

export function createDefaultStatementTemplate(){
  return starterRows.map((row,index)=>({
    id:row[0],label:row[1],section:row[2],normal_balance:row[3],aliases:[...row[4]],order:index+1,source:'starter'
  }));
}

export function cloneTemplate(template){
  return (template||[]).map(x=>({...x,aliases:[...(x.aliases||[])]}));
}

export function parseStatementTemplateRows(rows){
  if(!Array.isArray(rows)||!rows.length)throw new Error('テンプレートに行がありません');
  const header=(rows[0]||[]).map(norm);
  const find=(...names)=>header.findIndex(h=>names.map(norm).includes(h));
  const sectionIdx=find('section','区分','表示区分');
  const labelIdx=find('account','account_name','科目','科目名','勘定科目');
  const aliasIdx=find('aliases','alias','別名','別名候補');
  const normalIdx=find('normal_balance','normalbalance','通常残高','残高側');
  const orderIdx=find('order','表示順','順序');
  if(labelIdx<0)throw new Error('テンプレートに科目名列が必要です');
  const validSections=new Set(templateSections.map(([id])=>id));
  const out=[];
  for(let i=1;i<rows.length;i++){
    const r=rows[i]||[];
    const label=String(r[labelIdx]??'').trim();
    if(!label)continue;
    const sectionRaw=sectionIdx>=0?String(r[sectionIdx]??'').trim():'';
    let section=sectionRaw;
    if(!validSections.has(section)){
      const byLabel=templateSections.find(([,jp])=>norm(jp)===norm(sectionRaw));
      section=byLabel?.[0]||'';
    }
    if(!section)throw new Error('区分が未設定の科目があります: '+label);
    const meta=sectionMeta(section);
    const normalRaw=normalIdx>=0?String(r[normalIdx]??'').trim().toLowerCase():'';
    const normal=['debit','credit'].includes(normalRaw)?normalRaw:meta.normalBalance;
    const aliases=aliasIdx>=0?String(r[aliasIdx]??'').split(/[|｜,、]/).map(x=>x.trim()).filter(Boolean):[];
    const order=orderIdx>=0&&Number.isFinite(Number(r[orderIdx]))?Number(r[orderIdx]):out.length+1;
    out.push({
      id:'tpl_'+String(i)+'_'+norm(label).slice(0,40),
      label,section,normal_balance:normal,aliases,order,source:'imported'
    });
  }
  if(!out.length)throw new Error('有効なテンプレート科目がありません');
  return out.sort((a,b)=>a.order-b.order);
}

function sourceAccountTotals(records,{accountField,amountField,debitField,creditField}){
  const grouped=new Map();
  for(const row of records||[]){
    const account=String(row?.[accountField]??'').trim();
    if(!account)continue;
    if(!grouped.has(account))grouped.set(account,{account,amount:0,debit:0,credit:0,rows:0});
    const g=grouped.get(account);g.rows+=1;
    const a=amountField?num(row?.[amountField]):null;
    const d=debitField?num(row?.[debitField]):null;
    const c=creditField?num(row?.[creditField]):null;
    if(a!==null)g.amount+=a;
    if(d!==null)g.debit+=d;
    if(c!==null)g.credit+=c;
  }
  return [...grouped.values()];
}

function templateMatcher(template){
  const index=new Map();
  for(const item of template||[]){
    const labels=[item.label,...(item.aliases||[])];
    for(const label of labels){
      const key=norm(label);
      if(!key)continue;
      if(!index.has(key))index.set(key,[]);
      index.get(key).push(item.id);
    }
  }
  return index;
}

function naturalAmount(source,item,useAmount){
  if(useAmount)return source.amount;
  return item.normal_balance==='credit' ? source.credit-source.debit : source.debit-source.credit;
}

export function mapTrialBalanceToTemplate(records,template,{
  accountField='account_name',
  amountField='amount',
  debitField='debit',
  creditField='credit',
  manualMappings={}
}={}){
  const tpl=cloneTemplate(template).sort((a,b)=>a.order-b.order);
  const byId=new Map(tpl.map(x=>[x.id,x]));
  const matcher=templateMatcher(tpl);
  const sources=sourceAccountTotals(records,{accountField,amountField,debitField,creditField});
  const mapped=new Map(tpl.map(x=>[x.id,{...x,amount:0,source_accounts:[],source_rows:0}]));
  const unresolved=[],ambiguous=[];
  const useAmount=!!amountField;

  for(const src of sources){
    const manual=manualMappings[src.account]||manualMappings[norm(src.account)]||'';
    let targetIds=[];
    let matchSource='unmapped';
    if(manual&&byId.has(manual)){
      targetIds=[manual];matchSource='manual';
    }else{
      targetIds=[...new Set(matcher.get(norm(src.account))||[])];
      if(targetIds.length===1)matchSource='exact_alias';
      if(targetIds.length>1)matchSource='ambiguous';
    }
    if(targetIds.length!==1){
      const rec={...src,candidate_template_ids:targetIds};
      unresolved.push(rec);
      if(targetIds.length>1)ambiguous.push(rec);
      continue;
    }
    const target=byId.get(targetIds[0]);
    const out=mapped.get(target.id);
    out.amount+=naturalAmount(src,target,useAmount);
    out.source_accounts.push(src.account);
    out.source_rows+=src.rows;
    out.match_sources=out.match_sources||[];
    out.match_sources.push(matchSource);
  }

  const rows=[...mapped.values()];
  const sectionTotals=Object.fromEntries(templateSections.map(([id,label])=>[id,{id,label,total:0}]));
  for(const row of rows){
    if(sectionTotals[row.section])sectionTotals[row.section].total+=row.amount;
  }
  const assets=sectionTotals.current_assets.total+sectionTotals.noncurrent_assets.total;
  const liabilities=sectionTotals.current_liabilities.total+sectionTotals.noncurrent_liabilities.total;
  const equity=sectionTotals.equity.total;
  const difference=assets-(liabilities+equity);
  const isBalanced=Math.abs(difference)<=1e-8&&unresolved.length===0;

  return {
    rows,unresolved,ambiguous,sectionTotals,
    totals:{assets,liabilities,equity,difference,isBalanced},
    sourceAccountCount:sources.length,
    mappedSourceCount:sources.length-unresolved.length
  };
}

export function templateToRows(template){
  return [
    ['order','section','account','aliases','normal_balance'],
    ...(template||[]).sort((a,b)=>a.order-b.order).map(x=>[
      x.order,x.section,x.label,(x.aliases||[]).join('|'),x.normal_balance
    ])
  ];
}

export function aggregationToRows(result){
  return [
    ['order','section','template_account','amount','source_accounts','source_rows'],
    ...(result?.rows||[]).sort((a,b)=>a.order-b.order).map(x=>[
      x.order,sectionMeta(x.section).label,x.label,x.amount,(x.source_accounts||[]).join('|'),x.source_rows
    ]),
    ['','','資産合計',result?.totals?.assets??0,'',''],
    ['','','負債合計',result?.totals?.liabilities??0,'',''],
    ['','','純資産合計',result?.totals?.equity??0,'',''],
    ['','','貸借差額',result?.totals?.difference??0,'',''],
    ['','','貸借一致',result?.totals?.isBalanced?'一致':'不一致','','']
  ];
}
