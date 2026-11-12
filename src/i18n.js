const EN={
'Data Shaper':'Data Shaper',
'アカウント':'Account','ログイン状態を確認中…':'Checking sign-in…','Googleユーザー':'Google user','ログアウト':'Sign out','Free機能はログイン不要です。':'Free features do not require sign-in.','Googleでログイン':'Sign in with Google',
'料金プラン':'Plans','月額 ¥480':'¥480 / month','月額 ¥980':'¥980 / month',
'軽量集計、無料診断、簡易レポート。集計は縦軸×横軸の交差集計と数値合計まで無料。':'Free diagnostics, simple reports, and vertical × horizontal sum aggregation.',
'データ整形、全分類の汎用レポート、Recipe再利用。':'Data shaping, full general-purpose reports, and reusable Recipes.',
'Liteの全機能＋法人・個人事業の決算/申告準備、勘定科目テンプレート、貸借一致確認。':'Everything in Lite plus accounting preparation, account templates, and balance checks for companies and sole proprietors.',
'無料診断 · Free':'Diagnostics · Free','集計 · Free':'Aggregation · Free','決算・レポート · Free / Lite / Pro':'Accounting & Reports · Free / Lite / Pro','データ整形 · Lite':'Data Shaping · Lite',
'ファイル':'File','ファイルを選択':'Choose file','ファイルが選択されていません':'No file selected','データファイルを選択':'Choose data file','決算書テンプレートを読み込む':'Choose statement template','Recipe JSONを読み込む':'Choose Recipe JSON','シート: ':'Sheet: ','UTF-8 CSV / TSV、XLSXをブラウザ内で処理します。最大15 MB。':'CSV / TSV / XLSX are processed locally in your browser. Maximum 15 MB.',
'無料データ整形診断':'Free data-shaping diagnosis','データ行':'Data rows','列':'Columns','空欄':'Blanks','前後空白':'Outer whitespace','全角/半角候補':'Width-normalization candidates','完全重複候補':'Exact duplicate candidates',
'列型の推定':'Column type inference','データ整形工程プレビュー':'Data-shaping preview','前後空白を除去':'Trim outer whitespace','全角/半角を統一':'Normalize character width','完全重複行を削除（要確認）':'Remove exact duplicate rows (review required)',
'選択シートを一括データ整形':'Shape selected sheets','シート別CSV＋レポートをZIPで出力':'Export per-sheet CSV + report ZIP',
'選択シートの標準化設定':'Selected-sheet mapping','ヘッダー行（1始まり） ':'Header row (1-based) ','ヘッダー位置を適用':'Apply header row','形式: ':'Layout: ','自動判定':'Auto detect','縦持ち':'Long','横持ち':'Wide',
'横持ちの値: ':'Wide-layout value: ','需要・販売数量':'Demand / sales quantity','在庫':'Inventory','入庫':'Inbound','出庫':'Outbound','金額':'Amount',
'元の列名':'Source column','推定型':'Inferred type','出力フィールド':'Output field','Mapping推定':'Mapping confidence','使用しない':'Do not use','手動':'Manual',
'前後空白を除く':'Trim whitespace','文字幅を統一':'Normalize character width','日付表記を統一':'Normalize dates','変換プレビューを実行':'Run transform preview',
'変換プレビュー':'Transform preview','Data Loss Guard':'Data Loss Guard','SKU数':'SKU count','数量合計':'Quantity total','Null数':'Null count','日付最小':'Earliest date','日付最大':'Latest date','Before / After':'Before / After',
'標準形式出力':'Canonical export','CSVを出力':'Export CSV','Generic Clean CSV':'Generic clean CSV',
'集計設定':'Aggregation settings','縦軸: ':'Vertical axis: ','横軸: ':'Horizontal axis: ','使わない（1方向集計）':'None (one-axis aggregation)','合計する数値項目: ':'Numeric field to sum: ','集計結果を抽出':'Extract aggregation result',
'Excelで集計結果を抽出':'Extract result as Excel','CSV/TSVで集計結果を抽出':'Extract result as CSV/TSV',
'レポートの目的':'Report purpose','Free / Lite / Pro':'Free / Lite / Pro','使い方ガイド / サンプル':'Usage guide / sample','入力例':'Sample input','この入力例をサンプルCSVで保存':'Save sample as CSV',
'分類に使う項目: ':'Category field: ','金額項目: ':'Amount field: ','収支区分（任意）: ':'Income/expense field (optional): ','使わない':'Do not use',
'出力形式: ':'Output format: ','CSV（Excelで開く）':'CSV (opens in Excel)','この形式で出力':'Export in this format',
'法人':'Company','法人・会社':'Company','個人事業主（青色）':'Self-employed / Freelancer','個人事業主（白色）':'Self-employed / Freelancer','個人事業・フリーランス':'Self-employed / Freelancer','家計・個人管理':'Household / personal','自由形式':'Custom',
'会社向け財務・会計整理レポート':'Company financial & accounting report','事業収支・会計整理レポート':'Business income & expense / accounting report',
'会社の社内確認・会計整理のために、勘定科目・残高・貸借一致を整理します。特定の国の公式申告書を自動作成する機能ではありません。':'Organize accounts, balances, and balance checks for company reporting and internal review. It does not automatically create an official tax form for any country.',
'個人事業・フリーランスの売上、経費、資産・負債を整理する汎用レポートです。特定の国の申告様式への自動転記や税務判断は行いません。':'A general report for self-employed people and freelancers to organize revenue, expenses, assets, and liabilities. It does not auto-fill a country-specific tax form or make tax judgments.',
'勘定科目':'Account','金額または残高':'Amount or balance','借方':'Debit','貸方':'Credit','日付または期間':'Date or period','費目または勘定科目':'Category or account','口座（任意）':'Account (optional)','分類項目':'Category field','日付（任意）':'Date (optional)','メモ（任意）':'Memo (optional)',
'現金及び預金':'Cash and deposits','買掛金':'Accounts payable','資本金':'Capital','資産科目の集約例':'Asset account example','負債科目の例':'Liability account example','純資産科目の例':'Equity account example',

'決算書テンプレート（集計先）':'Statement template (aggregation target)','現在のテンプレートをCSV保存':'Save current template as CSV','順':'Order','区分':'Section','勘定科目':'Account','別名（|区切り）':'Aliases (| separated)','残高側':'Normal balance','操作':'Actions','借方':'Debit','貸方':'Credit','削除':'Delete','勘定科目を追加':'Add account',
'入力試算表の列':'Trial-balance columns','選択してください':'Select','勘定科目列: ':'Account field: ','残高列: ':'Balance field: ','借方・貸方から計算':'Calculate from debit / credit','借方列: ':'Debit field: ','貸方列: ':'Credit field: ','なし':'None',
'入力科目 → テンプレート科目':'Source account → template account','未対応':'Unmapped',
'税率設定':'Tax rate rules','税率計算補助 · Pro':'Tax calculation helper · Pro','事業区分・税区分・適用期間ごとの税率設定と税額計算はPro機能です。Freeでは税率を推測・適用しません。':'Tax rules and tax calculations by business, tax category, and effective period are Pro features. Free never guesses or applies a tax rate.','税率ルール':'Tax rules','税率計算プレビュー':'Tax calculation preview','税率ルールを追加':'Add tax rule','税率ルールを削除':'Delete tax rule','事業区分':'Business','税区分':'Tax category','適用開始':'Effective from','適用終了':'Effective to','税率 (%)':'Rate (%)','金額の扱い':'Amount basis','税抜金額':'Tax-exclusive amount','税込金額':'Tax-inclusive amount','端数処理':'Rounding','切り捨て':'Floor','四捨五入':'Round','切り上げ':'Ceil','取引日列':'Transaction-date field','事業区分列（任意）':'Business field (optional)','税区分列（任意）':'Tax-category field (optional)','税計算対象金額列':'Taxable amount field','税額':'Tax amount','税率':'Tax rate','税抜':'Excl. tax','税込':'Incl. tax','適用ルール':'Applied rule',
'減価償却計算補助':'Depreciation helper','取得価額':'Acquisition cost','残存価額':'Residual value','耐用年数（年）':'Useful life (years)','計算方法':'Method','定額法':'Straight-line','定率法（率を指定）':'Declining balance (custom rate)','定率法の年率 (%)':'Annual declining rate (%)','計算':'Calculate','年':'Year','期首簿価':'Opening book value','減価償却費':'Depreciation','期末簿価':'Closing book value',
'プライバシー':'Privacy','利用規約':'Terms','課金・解約条件':'Billing & cancellation','販売条件':'Sales conditions','運営者情報・情報開示':'Operator / disclosure',
'購入前に ':'Before purchase, review ',' を確認し、月額自動更新条件に同意します。':' and agree to the monthly auto-renewal conditions.','購入前に利用規約・プライバシー・課金/解約条件への同意が必要です。':'You must accept the Terms, Privacy Policy, and Billing/Cancellation conditions before purchase.','決済を開始できませんでした: ':'Unable to start payment: ','TEST決済を開始できませんでした: ':'Unable to start TEST checkout: ',
'Recipe / 再利用':'Recipe / reuse','現在の設定をRecipe保存':'Save current Recipe',
'Lite：複数シート一括データ整形':'Lite: batch data shaping','Pro：詳細機能':'Pro: advanced features','Lite：詳細機能':'Lite: advanced features',
'法人決算・申告準備レポート':'Company accounting / filing-preparation report','青色申告決算書 入力準備レポート':'Blue-return statement input-preparation report','収支内訳書 入力準備レポート':'Income/expense statement input-preparation report','年間家計サマリー':'Annual household summary','詳細家計レポート':'Detailed household report','簡易レポート':'Simple report','独自テンプレートレポート':'Custom template report',
'日付':'Date','摘要':'Description','費目':'Category','収支区分':'Flow type','収入':'Income','支出':'Expense','売上':'Sales','通信費':'Communications','旅費交通費':'Travel & transport','消耗品費':'Supplies','水道光熱費':'Utilities','給与':'Salary','食費':'Food','住居費':'Housing','分類':'Category','メモ':'Memo','商品A':'Product A','商品B':'Product B',
'軽量集計はFree、データ整形はLite、決算・勘定科目対応はProとしてLocal Firstで処理します。':'Light aggregation is Free, data shaping is Lite, and accounting / account mapping is Pro. Processing stays Local First.',
'価格本体は Free ¥0 / Lite 月額¥480 / Pro 月額¥980 で固定します。税の扱いと最終支払額表示は販売開始前に事業者判断で確定し、Stripe TESTでは接続済みのTierだけ購入ボタンを有効化します。':'Nominal prices are fixed at Free ¥0 / Lite ¥480 per month / Pro ¥980 per month. Tax treatment and final customer-facing totals remain owner-confirmed launch settings.',
'縦軸と横軸を指定して、その交点ごとに数値を合計するクロス集計です。横軸を使わない1方向集計もできます。':'Choose vertical and horizontal axes to sum values at each intersection. You can also run a one-axis aggregation.',
'法人・個人事業・家計を同じ入口から整理します。Freeは簡易サマリー、Liteは家計・自由形式の詳細レポート、Proは法人・個人事業の決算・申告準備を扱います。':'Use one report workspace for companies, sole proprietors, and households. Free provides summaries, Lite provides detailed household/custom reports, and Pro provides accounting preparation.',
'税率はData Shaperが業種から推測せず、登録されたルールだけを使用します。事業区分・税区分・適用期間・税率を設定してください。同じ条件で適用期間が重複すると計算を停止します。':'Data Shaper never guesses tax rates from business type. It uses only rules you register. Set business, tax category, effective period, and rate. Overlapping periods for the same scope stop the calculation.',
'税務申告の判定ではなく計算補助です。税率・課税区分・適用期間は利用者自身で確認してください。':'This is a calculation aid, not a tax-filing determination. Confirm tax rates, categories, and effective periods yourself or with a qualified professional.',
'税率ルールはまだ登録されていません。必要な場合だけ追加してください。':'No tax rules are registered yet. Add rules only when needed.',
'税率ルールの期間重複・入力形式チェック：OK':'Tax-rule period and format validation: OK',
'取引日列と金額列を選択してください。':'Select the transaction-date and amount fields.',
'税務上の法定償却率・保証率・改定償却率をData Shaperが自動決定する機能ではありません。定率法は確認済みの年率を入力して参考計算します。':'Data Shaper does not determine statutory depreciation rates, guarantee rates, or revised rates. For declining balance, enter a rate you have already confirmed and use the result as a calculation aid.',
'税務上の法定償却率・保証率・改定償却率をData Shaperが自動決定する機能ではありません。定率法は確認済みの年率を入力して参考計算します。期中取得の月割り、資産区分ごとの法定耐用年数、税務上の償却保証額への切替は自動判定しません。':'Data Shaper does not determine statutory depreciation rates, guarantee rates, or revised rates. Enter a confirmed declining-balance rate for reference calculations. It does not automatically determine partial-year proration, statutory useful life by asset class, or tax-guarantee switching.',
'社内確認や法人税申告準備のために、勘定科目・残高・貸借一致を整理します。公式申告書そのものを自動作成する機能ではありません。':'Organize accounts, balances, and balance checks for internal review and filing preparation. This does not automatically create an official tax return.',
'売上・経費・資産負債を整理し、本人または専門家が公式様式へ確認・転記しやすくする準備資料です。':'Organize sales, expenses, assets, and liabilities into preparation material for review or transfer into official forms.',
'収入・必要経費の集計を整理する準備資料です。税務上の適否を自動判断せず、最終確認は利用者側で行います。':'Prepare income and expense summaries without automatically deciding tax treatment. Final review remains with the user.',
'提出義務を前提としない個人管理用レポートです。月別・費目別の収支や資産推移の確認に使います。':'A personal-management report with no filing assumption. Use it to review monthly/category cash flow and asset changes.',
'用途が決まっていない場合の汎用レポートです。分類項目と金額項目を選び、必要な指標を自分で組み立てます。':'A general-purpose report for custom use. Choose category and amount fields to build the metrics you need.',
'前年データや既存テンプレートがなくても開始できます。架空の前年値は補完せず、まず下記のような列を用意すると集計しやすくなります。':'You can start without prior-year data or an existing template. Data Shaper never fabricates prior-year values; start with columns like the examples below.',
'サンプル値は使い方説明用であり、利用者の実績値・税務判断・推奨値ではありません。':'Sample values are for usage guidance only. They are not your actual results, tax judgments, or recommendations.',
'入力例':'Sample input','この入力例をサンプルCSVで保存':'Save this sample as CSV',
'売上':'Sales','通信費':'Communications','旅費交通費':'Travel & transport','収入':'Income','支出':'Expense',
'給与':'Salary','食費':'Food','住居費':'Housing',
'分類別合計の例':'Category-total example','同じ分類へ加算':'Adds to the same category','別分類の例':'Different-category example',
'英語表示は米国税制を意味しません。税務制度・提出様式は言語とは別に扱います。':'English display does not imply U.S. tax rules. Tax regimes and filing forms are separate from UI language.',
'Data Shaperは会計データの整理・集計を補助するサービスです。税務代理、個別の税務判断、税務書類の作成代行を行うものではありません。申告・提出前に利用者自身で内容を確認し、必要に応じて税理士または所轄機関へ確認してください。':'Data Shaper assists with organizing and aggregating accounting data. It does not provide tax representation, individualized tax judgments, or tax-return preparation services. Review all outputs before filing and consult a qualified tax professional or authority when necessary.'
};
let current='ja';
export function initLanguage(){
  let saved=null;
  try{saved=localStorage.getItem('data_shaper_lang')}catch{}
  current=['ja','en'].includes(saved)?saved:'ja';
  document.documentElement.lang=current;
  return current;
}
export function language(){return current;}
export function setLanguage(lang){
  current=lang==='en'?'en':'ja';
  document.documentElement.lang=current;
  try{localStorage.setItem('data_shaper_lang',current)}catch{}
}
export function tr(value){
  if(value===undefined||value===null)return value;
  const s=String(value);
  if(current!=='en')return s;
  const lead=s.match(/^\s*/)?.[0]||'',trail=s.match(/\s*$/)?.[0]||'',core=s.trim();
  if(EN[core])return lead+EN[core]+trail;
  let m=core.match(/^(\d+) シート \/ 選択中「(.+)」 (\d+) 行$/);
  if(m)return lead+`${m[1]} sheets / Selected “${m[2]}” / ${m[3]} rows`+trail;
  m=core.match(/^入力 (\d+) 行 \/ 変換後 (\d+) 行 \/ 変更 (\d+) セル$/);
  if(m)return lead+`Input ${m[1]} rows / Output ${m[2]} rows / ${m[3]} changed cells`+trail;
  m=core.match(/^数値として読めなかった (\d+) 行は合計から除外しました。元データ自体は変更していません。$/);
  if(m)return lead+`${m[1]} rows with non-numeric values were excluded from the sum. Source data was not modified.`+trail;
  return s;
}
export const languageOptions=()=>[['ja','日本語'],['en','English']];

export function applyTranslations(root=document.body){
  document.documentElement.lang=current;
  if(!root||current!=='en')return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode())){
    const parent=node.parentElement;
    if(!parent||parent.closest('script,style,textarea,pre,td'))continue;
    const next=tr(node.textContent);
    if(next!==node.textContent)node.textContent=next;
  }
  for(const el of root.querySelectorAll?.('[placeholder],[aria-label],[title]')||[]){
    for(const attr of ['placeholder','aria-label','title']){
      if(!el.hasAttribute(attr))continue;
      const currentValue=el.getAttribute(attr);
      const next=tr(currentValue);
      if(next!==currentValue)el.setAttribute(attr,next);
    }
  }
}
