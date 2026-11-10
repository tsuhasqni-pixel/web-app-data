export const balanceSheetSections=[
  ['current_assets','流動資産'],
  ['noncurrent_assets','固定資産'],
  ['current_liabilities','流動負債'],
  ['noncurrent_liabilities','固定負債'],
  ['equity','純資産']
];

const numeric=v=>{
  if(v===null||v===undefined||v==='')return null;
  const n=Number(String(v).replace(/,/g,''));
  return Number.isFinite(n)?n:null;
};

export function aggregateRecords(records,{groupBy=[],valueField,method='sum'}={}){
  if(!Array.isArray(groupBy)||!groupBy.length)throw new Error('集計キーを1つ以上選択してください');
  if(!valueField)throw new Error('集計対象の数値列を選択してください');
  const buckets=new Map();
  for(const row of records){
    const keyValues=groupBy.map(k=>row[k]??'');
    const key=JSON.stringify(keyValues);
    if(!buckets.has(key))buckets.set(key,{keyValues,values:[],source_count:0});
    const b=buckets.get(key); b.source_count++;
    const n=numeric(row[valueField]); if(n!==null)b.values.push(n);
  }
  return [...buckets.values()].map(b=>{
    let value=null;
    if(method==='sum')value=b.values.reduce((a,x)=>a+x,0);
    else if(method==='avg')value=b.values.length?b.values.reduce((a,x)=>a+x,0)/b.values.length:null;
    else if(method==='count')value=b.source_count;
    else if(method==='min')value=b.values.length?Math.min(...b.values):null;
    else if(method==='max')value=b.values.length?Math.max(...b.values):null;
    return Object.fromEntries([...groupBy.map((k,i)=>[k,b.keyValues[i]]),['source_count',b.source_count],[method+'_'+valueField,value]]);
  });
}

export function buildBalanceSheet(records,{accountField='account_name',amountField='amount',assignments={}}={}){
  const accountTotals=aggregateRecords(records,{groupBy:[accountField],valueField:amountField,method:'sum'});
  const sections=Object.fromEntries(balanceSheetSections.map(([id,label])=>[id,{id,label,items:[],total:0}]));
  const unclassified=[];
  for(const row of accountTotals){
    const account=String(row[accountField]??'');
    const amount=Number(row['sum_'+amountField]??0);
    const sectionId=assignments[account]||'';
    if(!sections[sectionId]){unclassified.push({account,amount});continue;}
    sections[sectionId].items.push({account,amount});
    sections[sectionId].total+=amount;
  }
  const assets=sections.current_assets.total+sections.noncurrent_assets.total;
  const liabilities=sections.current_liabilities.total+sections.noncurrent_liabilities.total;
  const equity=sections.equity.total;
  return {sections,unclassified,totals:{assets,liabilities,equity,difference:assets-(liabilities+equity)}};
}
