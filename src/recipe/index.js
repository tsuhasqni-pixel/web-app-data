const stable=x=>JSON.stringify(x);
export function sourceSignature(sheets,analysis){
  const payload={
    sheet_count:sheets.length,
    headers:analysis.header.map(x=>String(x??'')),
    column_count:analysis.header.length,
    inferred_types:(analysis.columnProfiles||[]).map(x=>x.inferredType),
    orientation:analysis.orientation
  };
  let h=2166136261;
  for(const ch of stable(payload)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
  return 'sig-v1-'+(h>>>0).toString(16).padStart(8,'0');
}
export function buildRecipe({sheets,analysis,options,profile,orientation,wideValueField,aggregateConfig,reportConfig,taxConfig,bsConfig,batchOptions,statementTemplate,templateMappings,statementConfig}){
  return {
    schema_version:6,
    source_signature:sourceSignature(sheets,analysis),
    source_headers:analysis.header,
    header_row:analysis.headerRow+1,
    mapping:analysis.mapping,
    options,profile,orientation,wideValueField,aggregateConfig,reportConfig,taxConfig,bsConfig,batchOptions,statementTemplate,templateMappings,statementConfig
  };
}
export function validateRecipe(recipe,{sheets,analysis,allowedFields}){
  if(!recipe||![1,2,3,4,5,6].includes(recipe.schema_version))throw new Error('未対応のRecipe versionです');
  if(!Array.isArray(recipe.source_headers))throw new Error('Recipeにsource_headersがありません');
  if(!recipe.mapping||Object.values(recipe.mapping).some(v=>v&&!allowedFields.includes(v)))throw new Error('Recipeのmappingが不正です');
  const exactHeaders=stable(recipe.source_headers)===stable(analysis.header);
  const currentSig=sourceSignature(sheets,analysis);
  const signatureMatch=recipe.source_signature?recipe.source_signature===currentSig:false;
  if(!exactHeaders&&!signatureMatch)throw new Error('現在のファイル構造とRecipeが一致しません');
  return {exactHeaders,signatureMatch,currentSig};
}
