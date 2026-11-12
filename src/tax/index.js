const num=v=>{
  if(v===null||v===undefined||v==='')return null;
  const n=Number(String(v).replace(/,/g,'').trim());
  return Number.isFinite(n)?n:null;
};
const iso=v=>{
  const s=String(v??'').trim();
  if(!s)return '';
  const d=new Date(s);
  if(Number.isNaN(d.getTime()))return '';
  return d.toISOString().slice(0,10);
};
const norm=v=>String(v??'').trim().normalize('NFKC').toLowerCase();
const endValue=v=>v||'9999-12-31';
const startValue=v=>v||'0001-01-01';

export function validateTaxRules(rules=[]){
  if(!Array.isArray(rules))throw new Error('tax_rules_invalid');
  const normalized=rules.map((r,i)=>{
    const rate=num(r?.rate);
    const from=iso(r?.from),to=iso(r?.to);
    if(!String(r?.label??'').trim())throw new Error('tax_rule_label_required:'+i);
    if(rate===null||rate<0||rate>100)throw new Error('tax_rule_rate_invalid:'+i);
    if(r?.from&&!from)throw new Error('tax_rule_from_invalid:'+i);
    if(r?.to&&!to)throw new Error('tax_rule_to_invalid:'+i);
    if(from&&to&&from>to)throw new Error('tax_rule_period_invalid:'+i);
    return {
      id:String(r.id||crypto.randomUUID()),
      label:String(r.label).trim(),
      business:norm(r.business),
      category:norm(r.category),
      rate,
      from,
      to
    };
  });
  for(let i=0;i<normalized.length;i++){
    for(let j=i+1;j<normalized.length;j++){
      const a=normalized[i],b=normalized[j];
      if(a.business!==b.business||a.category!==b.category)continue;
      if(startValue(a.from)<=endValue(b.to)&&startValue(b.from)<=endValue(a.to)){
        throw new Error('tax_rule_overlap:'+a.label+':'+b.label);
      }
    }
  }
  return normalized;
}

function specificity(rule,business,category){
  let score=0;
  if(rule.business){
    if(rule.business!==business)return -1;
    score+=2;
  }
  if(rule.category){
    if(rule.category!==category)return -1;
    score+=1;
  }
  return score;
}

export function resolveTaxRule({date,business='',category=''}={},rules=[]){
  const d=iso(date);
  if(!d)return {rule:null,status:'invalid_date'};
  const bs=norm(business),cs=norm(category);
  const valid=validateTaxRules(rules).filter(r=>{
    if(r.from&&d<r.from)return false;
    if(r.to&&d>r.to)return false;
    return specificity(r,bs,cs)>=0;
  });
  if(!valid.length)return {rule:null,status:'no_rule'};
  const scored=valid.map(rule=>({rule,score:specificity(rule,bs,cs)}));
  const best=Math.max(...scored.map(x=>x.score));
  const top=scored.filter(x=>x.score===best);
  if(top.length!==1)return {rule:null,status:'ambiguous_rule'};
  return {rule:top[0].rule,status:'ok'};
}

function roundTax(value,mode){
  if(mode==='ceil')return Math.ceil(value);
  if(mode==='round')return Math.round(value);
  return Math.floor(value);
}

export function calculateTaxAmount(amount,rate,{basis='exclusive',rounding='floor'}={}){
  const a=num(amount),r=num(rate);
  if(a===null||r===null)throw new Error('tax_amount_invalid');
  const ratio=r/100;
  let tax,net,gross;
  if(basis==='inclusive'){
    gross=a;
    tax=ratio===0?0:roundTax(gross-(gross/(1+ratio)),rounding);
    net=gross-tax;
  }else{
    net=a;
    tax=roundTax(net*ratio,rounding);
    gross=net+tax;
  }
  return {net,tax,gross,rate:r};
}

export function applyTaxRules(records,{dateField='date',businessField='',categoryField='',amountField='amount',basis='exclusive',rounding='floor',rules=[]}={}){
  const validated=validateTaxRules(rules);
  const out=[];
  let matched=0,unmatched=0,invalidDate=0,ambiguous=0;
  for(const row of records||[]){
    const resolved=resolveTaxRule({
      date:row?.[dateField],
      business:businessField?row?.[businessField]:'',
      category:categoryField?row?.[categoryField]:''
    },validated);
    if(resolved.status!=='ok'){
      if(resolved.status==='invalid_date')invalidDate++;
      else if(resolved.status==='ambiguous_rule')ambiguous++;
      else unmatched++;
      out.push({...row,tax_status:resolved.status,tax_rate:'',tax_amount:'',amount_ex_tax:'',amount_in_tax:'',tax_rule:''});
      continue;
    }
    const calc=calculateTaxAmount(row?.[amountField],resolved.rule.rate,{basis,rounding});
    matched++;
    out.push({...row,tax_status:'ok',tax_rate:calc.rate,tax_amount:calc.tax,amount_ex_tax:calc.net,amount_in_tax:calc.gross,tax_rule:resolved.rule.label});
  }
  return {rows:out,matched,unmatched,invalidDate,ambiguous};
}
