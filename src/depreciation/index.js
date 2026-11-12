const money=v=>{
  const n=Number(String(v??'').replace(/,/g,'').trim());
  return Number.isFinite(n)?n:null;
};
export function buildDepreciationSchedule({cost,residual=0,lifeYears,method='straight_line',decliningRate=null}={}){
  const c=money(cost),r=money(residual),life=Number(lifeYears),rate=decliningRate===null?null:Number(decliningRate);
  if(c===null||c<0)throw new Error('depreciation_cost_invalid');
  if(r===null||r<0||r>c)throw new Error('depreciation_residual_invalid');
  if(!Number.isInteger(life)||life<1||life>100)throw new Error('depreciation_life_invalid');
  if(!['straight_line','declining_custom'].includes(method))throw new Error('depreciation_method_invalid');
  if(method==='declining_custom'&&(!Number.isFinite(rate)||rate<=0||rate>100))throw new Error('depreciation_rate_invalid');

  const rows=[];let book=c,total=0;
  const depreciable=c-r;
  const straightAnnual=depreciable/life;
  for(let year=1;year<=life&&book>r;year++){
    const opening=book;
    let depreciation;
    if(method==='straight_line')depreciation=year===life?opening-r:Math.min(straightAnnual,opening-r);
    else depreciation=Math.min(opening*(rate/100),opening-r);
    depreciation=Math.max(0,Math.round(depreciation));
    if(year===life&&opening-depreciation>r)depreciation=opening-r;
    book=Math.max(r,opening-depreciation);
    total+=depreciation;
    rows.push({year,opening_book_value:opening,depreciation,closing_book_value:book});
  }
  return {rows,cost:c,residual:r,lifeYears:life,method,decliningRate:rate,totalDepreciation:total};
}
