import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import writeXlsxFile from 'write-excel-file/node';
import readXlsxFile from 'read-excel-file/node';

const rows=[
  ['商品名','店舗','金額'],
  ['商品A','那覇',100],
  ['商品A','那覇',250],
  ['商品A','浦添',400],
  ['商品B','那覇',300]
];

async function runAggregate(page,filePath){
  await page.goto('/');
  await page.getByRole('button',{name:'集計 · Free'}).click();
  const fileInput=page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(filePath);

  await expect(page.getByText(/選択中/)).toBeVisible();
  await page.getByRole('button',{name:'変換プレビューを実行'}).click();

  const setting=page.locator('section').filter({has:page.getByRole('heading',{name:'集計設定'})});
  const selects=setting.locator('select');
  await expect(selects).toHaveCount(3);
  await selects.nth(0).selectOption('sku_name');
  await selects.nth(1).selectOption('location_name');
  await selects.nth(2).selectOption('amount');

  await expect(setting.getByText(/sku_name × location_name/)).toBeVisible();
  const table=setting.locator('table').last();
  await expect(table).toContainText('商品A');
  await expect(table).toContainText('750');
  await expect(table).toContainText('1050');

  const extract=page.locator('section').filter({has:page.getByRole('heading',{name:'集計結果を抽出'})});
  return extract;
}

test('CSV: vertical × horizontal aggregation exports only calculated table as CSV',async({page},testInfo)=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ds-csv-'));
  const input=path.join(dir,'在庫売上.csv');
  await fs.writeFile(input,'商品名,店舗,金額\r\n商品A,那覇,100\r\n商品A,那覇,250\r\n商品A,浦添,400\r\n商品B,那覇,300\r\n','utf8');

  const extract=await runAggregate(page,input);
  const [download]=await Promise.all([
    page.waitForEvent('download'),
    extract.getByRole('button',{name:/CSV\/TSVで集計結果を抽出/}).click()
  ]);

  expect(download.suggestedFilename()).toBe('在庫売上-集計結果.csv');
  const out=await download.path();
  expect(out).toBeTruthy();
  const text=await fs.readFile(out,'utf8');
  expect(text.replace(/^\uFEFF/,'')).toContain('sku_name × location_name,那覇,浦添,合計');
  expect(text).toContain('商品A,350,400,750');
  expect(text).toContain('合計,650,400,1050');
  expect(text).not.toContain('商品A,那覇,100');
});

test('XLSX: vertical × horizontal aggregation returns an XLSX with the aggregation table',async({page})=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ds-xlsx-'));
  const input=path.join(dir,'在庫売上.xlsx');
  await writeXlsxFile(rows,{filePath:input,sheet:'入力'});

  const extract=await runAggregate(page,input);
  const [download]=await Promise.all([
    page.waitForEvent('download'),
    extract.getByRole('button',{name:/Excelで集計結果を抽出/}).click()
  ]);

  expect(download.suggestedFilename()).toBe('在庫売上-集計結果.xlsx');
  const out=await download.path();
  expect(out).toBeTruthy();
  const sheet=await readXlsxFile(out);
  expect(sheet).toEqual([
    ['sku_name × location_name','那覇','浦添','合計'],
    ['商品A',350,400,750],
    ['商品B',300,0,300],
    ['合計',650,400,1050]
  ]);
});
