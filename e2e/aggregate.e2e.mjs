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

  const table=setting.locator('table').last();
  await expect(table.locator('th').first()).toHaveText('sku_name × location_name');
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
  await writeXlsxFile(rows,{sheet:'入力'}).toFile(input);

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


test('PDF renderer creates a printable Japanese report page',async({page,context})=>{
  await context.addInitScript(()=>{
    window.print=()=>{document.documentElement.dataset.printCalled='yes';};
  });
  await page.goto('/');
  await page.evaluate(async()=>{
    const {openPrintReport}=await import('/src/exporter/report.js');
    window.__openDsPdf=()=>openPrintReport({
      title:'Data Shaper 集計レポート',
      rows:[['分類','金額'],['商品A',750],['商品B',300],['合計',1050]],
      note:'ブラウザ内で生成したPDF保存用レポート'
    });
    const b=document.createElement('button');
    b.id='e2e-open-pdf';
    b.textContent='PDF E2E';
    b.addEventListener('click',()=>window.__openDsPdf());
    document.body.appendChild(b);
  });
  const popupPromise=context.waitForEvent('page');
  await page.locator('#e2e-open-pdf').click();
  const popup=await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  await expect(popup).toHaveTitle('Data Shaper 集計レポート');
  await expect(popup.locator('body')).toContainText('商品A');
  await expect(popup.locator('body')).toContainText('1050');
  await expect(popup.locator('body')).toContainText('ブラウザ内で生成したPDF保存用レポート');
  await expect.poll(()=>popup.evaluate(()=>document.documentElement.dataset.printCalled||'')).toBe('yes');
});


test('English UI is fully generic and does not expose Japan-specific blue/white filing modes',async({page})=>{
  await page.goto('/');
  await page.locator('.language-control select').selectOption('en');
  await expect(page.getByRole('button',{name:'Aggregation · Free'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Accounting & Reports · Free / Lite / Pro'})).toBeVisible();

  await page.getByRole('button',{name:'Aggregation · Free'}).click();
  await expect(page.getByText('Choose file')).toBeVisible();
  await expect(page.getByText('No file selected')).toBeVisible();
  await expect(page.getByText(/ファイルの選択|ファイルが選択されていません/)).toHaveCount(0);

  await page.getByRole('button',{name:'Accounting & Reports · Free / Lite / Pro'}).click();
  await expect(page.getByRole('heading',{name:'Report purpose'})).toBeVisible();
  const purposeSection=page.locator('section').filter({has:page.getByRole('heading',{name:'Report purpose'})});
  const purpose=purposeSection.locator('select');
  await expect(purpose.locator('option')).toHaveText(['Company','Self-employed / Freelancer','Household / personal','Custom']);
  await expect(page.getByText(/blue return|white return/i)).toHaveCount(0);
  await expect(page.getByText(/English display does not imply U\.S\. tax rules/i)).toBeVisible();

  await purpose.selectOption('self_employed');
  await expect(purposeSection).toContainText('Self-employed / Freelancer');
  await expect(page.getByRole('heading',{name:'Usage guide / sample'})).toBeVisible();
  await expect(page.getByText('Account (optional)')).toHaveCount(0);
  await expect(page.getByText(/青色|白色/)).toHaveCount(0);

  await purpose.selectOption('corporate');
  await expect(page.getByRole('heading',{name:'Tax calculation helper · Pro'})).toBeVisible();
  await expect(page.getByText(/tax calculations by business, tax category, and effective period are Pro features/i)).toBeVisible();
});


test('paid UI keeps checkout disabled until explicit legal consent',async({page})=>{
  await page.route('**/api/auth/session',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    authenticated:true,user:{name:'Test User',email:'test@example.com'},entitlement:{tier:'free',pro:false,source:'stripe'}
  })}));
  await page.route('**/api/billing/status',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    billing_enabled:true,mode:'test',ready_for_test:true,pro_ready:true,lite_ready:true,pro_ready_for_test:true,lite_ready_for_test:true,sale_gate_ready:false,
    missing:[],pro_missing:[],lite_missing:[]
  })}));
  await page.goto('/');
  await page.getByRole('button',{name:'データ整形 · Lite'}).click();
  const gate=page.locator('section').filter({has:page.getByRole('heading',{name:'Lite：詳細機能'})});
  const buy=gate.getByRole('button',{name:'TEST Liteを開始（¥480 / 月）'});
  await expect(buy).toBeDisabled();
  const consent=gate.getByRole('checkbox');
  await expect(consent).not.toBeChecked();
  await consent.check();
  await expect(buy).toBeEnabled();
  await expect(gate.getByRole('link',{name:'利用規約'})).toHaveAttribute('href','/legal/terms/');
  await expect(gate.getByRole('link',{name:'課金・解約条件'})).toHaveAttribute('href','/legal/billing/');
});
