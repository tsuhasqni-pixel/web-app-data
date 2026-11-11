const n=v=>{
  if(v===null||v===undefined||v==='')return null;
  const x=Number(String(v).replace(/,/g,'').trim());
  return Number.isFinite(x)?x:null;
};
const norm=v=>String(v??'').trim().normalize('NFKC').toLowerCase();

export const reportPurposes=[
  {
    id:'corporate',
    label:'法人',
    freeLabel:'簡易決算サマリー',
    proLabel:'法人決算・申告準備レポート',
    description:'社内確認や法人税申告準備のために、勘定科目・残高・貸借一致を整理します。公式申告書そのものを自動作成する機能ではありません。',
    suggestedFields:['勘定科目','金額または残高','借方','貸方','日付または期間'],
    sample:[
      {勘定科目:'現金及び預金',金額:1200000,メモ:'貸借対照表へ集約する例'},
      {勘定科目:'買掛金',金額:420000,メモ:'負債科目の例'},
      {勘定科目:'資本金',金額:780000,メモ:'純資産科目の例'}
    ]
  },
  {
    id:'sole_blue',
    label:'個人事業主（青色）',
    freeLabel:'簡易事業収支サマリー',
    proLabel:'青色申告決算書 入力準備レポート',
    description:'売上・経費・資産負債を整理し、本人または専門家が公式様式へ確認・転記しやすくする準備資料です。',
    suggestedFields:['日付','摘要','勘定科目または費目','金額','収支区分'],
    sample:[
      {日付:'2026-01-10',費目:'売上',金額:120000,収支区分:'収入'},
      {日付:'2026-01-12',費目:'通信費',金額:8000,収支区分:'支出'},
      {日付:'2026-01-15',費目:'旅費交通費',金額:4500,収支区分:'支出'}
    ]
  },
  {
    id:'sole_white',
    label:'個人事業主（白色）',
    freeLabel:'簡易収支サマリー',
    proLabel:'収支内訳書 入力準備レポート',
    description:'収入・必要経費の集計を整理する準備資料です。税務上の適否を自動判断せず、最終確認は利用者側で行います。',
    suggestedFields:['日付','摘要','費目','金額','収支区分'],
    sample:[
      {日付:'2026-02-01',費目:'売上',金額:85000,収支区分:'収入'},
      {日付:'2026-02-03',費目:'消耗品費',金額:6200,収支区分:'支出'},
      {日付:'2026-02-06',費目:'水道光熱費',金額:9100,収支区分:'支出'}
    ]
  },
  {
    id:'household',
    label:'家計・個人管理',
    freeLabel:'年間家計サマリー',
    proLabel:'詳細家計レポート',
    description:'提出義務を前提としない個人管理用レポートです。月別・費目別の収支や資産推移の確認に使います。',
    suggestedFields:['日付','費目','金額','収支区分','口座（任意）'],
    sample:[
      {日付:'2026-01-01',費目:'給与',金額:250000,収支区分:'収入'},
      {日付:'2026-01-02',費目:'食費',金額:4200,収支区分:'支出'},
      {日付:'2026-01-03',費目:'住居費',金額:70000,収支区分:'支出'}
    ]
  },
  {
    id:'custom',
    label:'自由形式',
    freeLabel:'簡易レポート',
    proLabel:'独自テンプレートレポート',
    description:'用途が決まっていない場合の汎用レポートです。分類項目と金額項目を選び、必要な指標を自分で組み立てます。',
    suggestedFields:['分類項目','金額','日付（任意）','メモ（任意）'],
    sample:[
      {分類:'商品A',金額:1200,メモ:'分類別合計の例'},
      {分類:'商品A',金額:800,メモ:'同じ分類へ加算'},
      {分類:'商品B',金額:1500,メモ:'別分類の例'}
    ]
  }
];

export const reportDisclaimer='Data Shaperは会計データの整理・集計を補助するサービスです。税務代理、個別の税務判断、税務書類の作成代行を行うものではありません。申告・提出前に利用者自身で内容を確認し、必要に応じて税理士または所轄機関へ確認してください。';

export function getReportPurpose(id){
  return reportPurposes.find(x=>x.id===id)||reportPurposes.find(x=>x.id==='household');
}

function flowKind(value){
  const s=norm(value).replace(/[\s　_-]/g,'');
  if(!s)return '';
  if(['収入','入金','売上','収益','income','revenue','inflow'].some(x=>s.includes(x)))return 'income';
  if(['支出','出金','経費','費用','expense','cost','outflow'].some(x=>s.includes(x)))return 'expense';
  return '';
}

export function buildSimpleReport(records,{categoryField,amountField,flowField=''}={}){
  if(!Array.isArray(records))throw new Error('レポート対象データがありません');
  if(!categoryField)throw new Error('分類に使う項目を選択してください');
  if(!amountField)throw new Error('金額項目を選択してください');
  const buckets=new Map();
  let validRows=0,total=0,income=0,expense=0,recognizedFlowRows=0,unknownFlowRows=0;
  for(const row of records){
    const amount=n(row?.[amountField]);
    if(amount===null)continue;
    validRows+=1;
    total+=amount;
    const category=String(row?.[categoryField]??'未分類').trim()||'未分類';
    buckets.set(category,(buckets.get(category)||0)+amount);
    if(flowField){
      const kind=flowKind(row?.[flowField]);
      if(kind==='income'){income+=Math.abs(amount);recognizedFlowRows+=1;}
      else if(kind==='expense'){expense+=Math.abs(amount);recognizedFlowRows+=1;}
      else unknownFlowRows+=1;
    }
  }
  const categories=[...buckets.entries()]
    .map(([category,amount])=>({category,amount}))
    .sort((a,b)=>Math.abs(b.amount)-Math.abs(a.amount));
  return {
    validRows,total,categories,
    cashflow:flowField?{
      available:recognizedFlowRows>0,
      income,expense,net:income-expense,
      recognizedFlowRows,unknownFlowRows
    }:null
  };
}

export function simpleReportToRows(report,purpose){
  const p=getReportPurpose(purpose);
  const rows=[
    ['Data Shaper '+p.freeLabel,''],
    ['用途',p.label],
    ['有効データ件数',report?.validRows??0],
    ['金額合計',report?.total??0]
  ];
  if(report?.cashflow?.available){
    rows.push(['収入合計',report.cashflow.income]);
    rows.push(['支出合計',report.cashflow.expense]);
    rows.push(['収支差額',report.cashflow.net]);
    rows.push(['収支区分未判定件数',report.cashflow.unknownFlowRows]);
  }
  rows.push(['','']);
  rows.push(['分類','金額']);
  for(const item of report?.categories||[])rows.push([item.category,item.amount]);
  rows.push(['','']);
  rows.push(['注意',reportDisclaimer]);
  return rows;
}
