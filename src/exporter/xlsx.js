import writeExcelFile from 'write-excel-file/browser';

export async function saveXlsx(filename,rows,{sheet='集計結果'}={}){
  const safeRows=(Array.isArray(rows)?rows:[]).map(row=>
    (Array.isArray(row)?row:[row]).map(value=>{
      if(value===null||value===undefined)return null;
      if(typeof value==='number'||typeof value==='boolean'||value instanceof Date)return value;
      return String(value);
    })
  );
  if(!safeRows.length)throw new Error('Excelへ出力するデータがありません');
  await writeExcelFile(safeRows,{sheet}).toFile(filename);
}
