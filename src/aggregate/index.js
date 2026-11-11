export const balanceSheetSections=[
  ['current_assets','流動資産'],
  ['noncurrent_assets','固定資産'],
  ['current_liabilities','流動負債'],
  ['noncurrent_liabilities','固定負債'],
  ['equity','純資産']
];

export const programmedBalanceRules=[
  {id:'current_assets',label:'流動資産',patterns:[
    '現金','普通預金','当座預金','定期預金','預金','受取手形','売掛金','電子記録債権',
    '有価証券','商品','製品','半製品','原材料','仕掛品','貯蔵品','棚卸資産',
    '前渡金','前払費用','未収入金','未収収益','短期貸付金','仮払金','立替金'
  ]},
  {id:'noncurrent_assets',label:'固定資産',patterns:[
    '建物','建物附属設備','構築物','機械装置','機械及び装置','車両運搬具','工具器具備品',
    '土地','建設仮勘定','減価償却累計額','ソフトウェア','のれん','特許権','商標権',
    '投資有価証券','関係会社株式','長期貸付金','敷金','保証金','長期前払費用','繰延税金資産'
  ]},
  {id:'current_liabilities',label:'流動負債',patterns:[
    '支払手形','買掛金','電子記録債務','短期借入金','1年内返済','一年内返済',
    '未払金','未払費用','未払法人税等','未払消費税','前受金','預り金','仮受金','賞与引当金'
  ]},
  {id:'noncurrent_liabilities',label:'固定負債',patterns:[
    '長期借入金','社債','長期未払金','退職給付引当金','役員退職慰労引当金','資産除去債務','繰延税金負債'
  ]},
  {id:'equity',label:'純資産',patterns:[
    '資本金','新株式申込証拠金','資本準備金','資本剰余金','利益準備金','利益剰余金',
    '繰越利益剰余金','自己株式','自己株式申込証拠金','新株予約権','評価換算差額','評価・換算差額'
  ]}
];

const numeric=v=>{
  if(v===null||v===undefined||v==='')return null;
  const n=Number(String(v).replace(/,/g,''));
  return Number.isFinite(n)?n:null;
};
const normalized=v=>String(v??'').trim().normalize('NFKC').replace(/[ 　]/g,'');
const sectionLabel=id=>balanceSheetSections.find(([x])=>x===id)?.[1]||'未分類';

export function aggregateRecords(records,{groupBy=[],valueField,method='sum'}={}){
  if(!Array.isArray(groupBy)||!groupBy.length)throw new Error('集計軸を1つ以上選択してください');
  if(!valueField&&method!=='count')throw new Error('集計対象の数値列を選択してください');
  const buckets=new Map();
  for(const row of records){
    const keyValues=groupBy.map(k=>row[k]??'');
    const key=JSON.stringify(keyValues);
    if(!buckets.has(key))buckets.set(key,{keyValues,values:[],source_count:0});
    const b=buckets.get(key); b.source_count++;
    const n=valueField?numeric(row[valueField]):null; if(n!==null)b.values.push(n);
  }
  return [...buckets.values()].map(b=>{
    let value=null;
    if(method==='sum')value=b.values.reduce((a,x)=>a+x,0);
    else if(method==='avg')value=b.values.length?b.values.reduce((a,x)=>a+x,0)/b.values.length:null;
    else if(method==='count')value=b.source_count;
    else if(method==='min')value=b.values.length?Math.min(...b.values):null;
    else if(method==='max')value=b.values.length?Math.max(...b.values):null;
    return Object.fromEntries([...groupBy.map((k,i)=>[k,b.keyValues[i]]),['source_count',b.source_count],[method+(valueField?'_'+valueField:''),value]]);
  });
}

export function buildPivotTable(records,{rowField,columnField='',valueField}={}){
  if(!Array.isArray(records))throw new Error('集計対象データがありません');
  if(!rowField)throw new Error('縦軸を選択してください');
  if(!valueField)throw new Error('集計する数値項目を選択してください');
  if(columnField&&columnField===rowField)throw new Error('縦軸と横軸には別の項目を選択してください');

  const rowOrder=[],columnOrder=[],rowSeen=new Set(),columnSeen=new Set();
  const cells=new Map(),rowTotals=new Map(),columnTotals=new Map();
  let grandTotal=0,validValueCount=0,skippedValueCount=0;

  for(const row of records){
    const value=numeric(row?.[valueField]);
    if(value===null){skippedValueCount++;continue;}
    const rowValue=String(row?.[rowField]??'');
    const columnValue=columnField?String(row?.[columnField]??''):'';
    if(!rowSeen.has(rowValue)){rowSeen.add(rowValue);rowOrder.push(rowValue);}
    if(columnField&&!columnSeen.has(columnValue)){columnSeen.add(columnValue);columnOrder.push(columnValue);}
    const key=JSON.stringify([rowValue,columnValue]);
    cells.set(key,(cells.get(key)||0)+value);
    rowTotals.set(rowValue,(rowTotals.get(rowValue)||0)+value);
    if(columnField)columnTotals.set(columnValue,(columnTotals.get(columnValue)||0)+value);
    grandTotal+=value;
    validValueCount++;
  }

  if(!columnField){
    return {
      rows:[
        [rowField,valueField+' 合計'],
        ...rowOrder.map(rowValue=>[rowValue,rowTotals.get(rowValue)||0])
      ],
      rowValues:rowOrder,columnValues:[],
      validValueCount,skippedValueCount,grandTotal
    };
  }

  const rows=[
    [rowField+' × '+columnField,...columnOrder,'合計'],
    ...rowOrder.map(rowValue=>[
      rowValue,
      ...columnOrder.map(columnValue=>cells.get(JSON.stringify([rowValue,columnValue]))||0),
      rowTotals.get(rowValue)||0
    ]),
    ['合計',...columnOrder.map(columnValue=>columnTotals.get(columnValue)||0),grandTotal]
  ];
  return {rows,rowValues:rowOrder,columnValues:columnOrder,validValueCount,skippedValueCount,grandTotal};
}

export function classifyBalanceAccount(account,{overrides={}}={}){
  const raw=String(account??'').trim();
  const name=normalized(raw);
  const override=overrides[raw]||overrides[name]||'';
  if(balanceSheetSections.some(([id])=>id===override)){
    return {sectionId:override,sectionLabel:sectionLabel(override),source:'override',matches:[override]};
  }
  const matches=programmedBalanceRules
    .filter(rule=>rule.patterns.some(p=>name.includes(normalized(p))))
    .map(rule=>rule.id);
  const unique=[...new Set(matches)];
  if(unique.length===1)return {sectionId:unique[0],sectionLabel:sectionLabel(unique[0]),source:'programmed_rule',matches:unique};
  if(unique.length>1)return {sectionId:'',sectionLabel:'未分類',source:'ambiguous',matches:unique};
  return {sectionId:'',sectionLabel:'未分類',source:'unclassified',matches:[]};
}

function naturalBalance(sectionId,{amount,debit,credit}){
  const explicit=numeric(amount);
  if(explicit!==null)return explicit;
  const d=numeric(debit)??0,c=numeric(credit)??0;
  if(['current_assets','noncurrent_assets'].includes(sectionId))return d-c;
  if(['current_liabilities','noncurrent_liabilities','equity'].includes(sectionId))return c-d;
  return d-c;
}

export function buildProgrammedBalanceSheet(records,{
  accountField='account_name',
  amountField='amount',
  debitField='debit',
  creditField='credit',
  overrides={},
  tolerance=1e-8
}={}){
  const grouped=new Map();
  for(const row of records){
    const account=String(row[accountField]??'').trim();
    if(!account)continue;
    if(!grouped.has(account))grouped.set(account,[]);
    grouped.get(account).push(row);
  }
  const sections=Object.fromEntries(balanceSheetSections.map(([id,label])=>[id,{id,label,items:[],total:0}]));
  const unclassified=[],ambiguous=[],classified=[];
  for(const [account,rows] of grouped){
    const cls=classifyBalanceAccount(account,{overrides});
    let amount=0;
    for(const row of rows){
      amount+=naturalBalance(cls.sectionId,{
        amount:amountField?row[amountField]:null,
        debit:debitField?row[debitField]:null,
        credit:creditField?row[creditField]:null
      });
    }
    const item={account,amount,section_id:cls.sectionId,section:cls.sectionLabel,classification_source:cls.source};
    if(!cls.sectionId){
      item.candidate_sections=cls.matches.map(sectionLabel);
      unclassified.push(item);
      if(cls.source==='ambiguous')ambiguous.push(item);
      continue;
    }
    sections[cls.sectionId].items.push({account,amount,classification_source:cls.source});
    sections[cls.sectionId].total+=amount;
    classified.push(item);
  }
  const assets=sections.current_assets.total+sections.noncurrent_assets.total;
  const liabilities=sections.current_liabilities.total+sections.noncurrent_liabilities.total;
  const equity=sections.equity.total;
  const difference=assets-(liabilities+equity);
  const isBalanced=Math.abs(difference)<=tolerance&&unclassified.length===0;
  return {
    sections,classified,unclassified,ambiguous,
    totals:{assets,liabilities,equity,difference,isBalanced},
    rule_version:1
  };
}

export function buildBalanceSheet(records,{accountField='account_name',amountField='amount',assignments={}}={}){
  const sheet=buildProgrammedBalanceSheet(records,{accountField,amountField,overrides:assignments});
  return {...sheet,unclassified:sheet.unclassified.map(({account,amount})=>({account,amount}))};
}
