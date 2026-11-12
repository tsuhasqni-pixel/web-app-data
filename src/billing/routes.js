import {googleConfig} from '../auth/google.js';
import {readSession} from '../auth/session.js';
import {getUserIdentity,getStripeCustomerLink,getUserIdByStripeCustomer,upsertStripeCustomerLink,upsertStripeEntitlement} from '../auth/store.js';
import {LEGAL_VERSION} from '../legal.js';
import {
  billingConfig,billingMissing,billingMode,expectedLivemode,
  createCheckoutSession,createPortalSession,tierBillingConfig,
  verifyStripeWebhook,verifyTierPrice,verifyStripeAccount
} from './stripe.js';

function json(body,status=200,headers={}){
  const h=new Headers({
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff',
    'referrer-policy':'no-referrer'
  });
  for(const [k,v] of Object.entries(headers))h.set(k,v);
  return new Response(JSON.stringify(body),{status,headers:h});
}
function sameOriginMutation(request,origin){
  try{
    if(!origin||new URL(request.url).origin!==origin)return false;
    const h=request.headers.get('Origin');
    if(h)return new URL(h).origin===origin;
    const r=request.headers.get('Referer');
    return !!r&&new URL(r).origin===origin;
  }catch{return false}
}
async function authenticatedUser(request,env){
  const c=googleConfig(env);
  if(!c.sessionSecretConfigured)return null;
  const session=await readSession(request,c.sessionSecret);
  if(!session)return null;
  const identity=await getUserIdentity(env,session.user_id);
  return identity?{userId:identity.user_id,email:identity.email||''}:null;
}
async function ensureCommercialTables(env){
  if(!env?.DB?.prepare)throw new Error('db_not_bound');
  const ddl=[
    "CREATE TABLE IF NOT EXISTS stripe_webhook_events (event_id TEXT PRIMARY KEY,event_type TEXT NOT NULL,stripe_created INTEGER,livemode INTEGER NOT NULL,received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,processed_at TEXT,last_error TEXT)",
    "CREATE INDEX IF NOT EXISTS stripe_webhook_events_unprocessed ON stripe_webhook_events(processed_at, received_at)",
    "CREATE TABLE IF NOT EXISTS checkout_acceptances (stripe_checkout_session_id TEXT PRIMARY KEY,stripe_customer_id TEXT,stripe_subscription_id TEXT,user_id TEXT NOT NULL,product_key TEXT NOT NULL,tier TEXT NOT NULL,legal_version TEXT NOT NULL,accepted_at INTEGER NOT NULL,livemode INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY (user_id) REFERENCES users(id))",
    "CREATE INDEX IF NOT EXISTS checkout_acceptances_user ON checkout_acceptances(user_id, accepted_at)"
  ];
  for(const sql of ddl)await env.DB.prepare(sql).run();
}
async function commercialDbStatus(env){
  if(!env?.DB?.prepare)return {schema_ready:false,webhook_backlog:null};
  try{
    await ensureCommercialTables(env);
    const row=await env.DB.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('users','oauth_identities','stripe_customer_links','stripe_entitlements','stripe_webhook_events','checkout_acceptances')").first();
    const schemaReady=Number(row?.n)===6;
    if(!schemaReady)return {schema_ready:false,webhook_backlog:null};
    const backlog=await env.DB.prepare('SELECT COUNT(*) AS n FROM stripe_webhook_events WHERE processed_at IS NULL').first();
    return {schema_ready:true,webhook_backlog:Number(backlog?.n)||0};
  }catch{return {schema_ready:false,webhook_backlog:null}}
}
async function safeLiveVerification(env){
  const c=billingConfig(env);
  const result={
    pro:{checked:false,verified:false,reason:null},
    lite:{checked:false,verified:false,reason:null},
    account:{checked:false,charges_enabled:false,payouts_enabled:false,details_submitted:false}
  };
  if(!c.live||!c.secretConfigured)return result;
  for(const tier of ['pro','lite']){
    const plan=tierBillingConfig(env,tier);
    if(!plan.priceConfigured){result[tier]={checked:false,verified:false,reason:'missing'};continue;}
    try{
      const v=await verifyTierPrice(env,tier);
      result[tier]={checked:true,verified:v.ok===true,reason:v.reason||null};
    }catch{result[tier]={checked:true,verified:false,reason:'stripe_error'}}
  }
  try{result.account=await verifyStripeAccount(env);}catch{result.account={checked:true,charges_enabled:false,payouts_enabled:false,details_submitted:false}}
  return result;
}
export async function handleBillingStatus(_request,env){
  const c=billingConfig(env),mode=billingMode(env);
  const proMissing=billingMissing(env,'pro'),liteMissing=billingMissing(env,'lite');
  const db=await commercialDbStatus(env);
  const live=await safeLiveVerification(env);
  const liveExternalReady=!c.live||(
    live.pro.verified&&live.lite.verified&&
    live.account.charges_enabled&&live.account.payouts_enabled&&live.account.details_submitted
  );
  const readyTest=!c.live&&c.enabled&&proMissing.length===0;
  const proReady=c.enabled&&proMissing.length===0&&liveExternalReady&&db.schema_ready;
  const liteReady=c.enabled&&liteMissing.length===0&&liveExternalReady&&db.schema_ready;
  const saleGateReady=c.live&&proReady&&liteReady&&db.webhook_backlog===0;
  return json({
    provider:'stripe',mode,
    billing_enabled:c.enabled,
    tax_display_confirmed:c.taxDisplayConfirmed,
    refund_policy_confirmed:c.refundPolicyConfirmed,
    live_sale_approved:c.liveSaleApproved,
    stripe_secret_configured:c.secretConfigured,
    pro_price_configured:c.proPriceConfigured,
    lite_price_configured:c.litePriceConfigured,
    webhook_secret_configured:c.webhookConfigured,
    portal_configured:c.portalConfigured,
    identity_store_bound:!!env?.DB?.prepare,
    commercial_schema_ready:db.schema_ready,
    webhook_backlog:db.webhook_backlog,
    ready_for_test:readyTest,
    ready_for_live:saleGateReady,
    pro_ready:proReady,
    lite_ready:liteReady,
    pro_ready_for_test:!c.live&&proReady,
    lite_ready_for_test:!c.live&&liteReady,
    sale_gate_ready:saleGateReady,
    live_verification:live,
    missing:proMissing,
    pro_missing:proMissing,
    lite_missing:liteMissing
  });
}
export async function handleCheckout(request,env,deps={}){
  const c=billingConfig(env);
  if(!sameOriginMutation(request,c.origin))return json({error:'invalid_origin'},403);
  if(!c.enabled)return json({error:'billing_disabled'},503);
  let body={};
  try{body=await request.json()}catch{}
  const tier=body?.tier==='lite'?'lite':'pro';
  if(body?.accept_terms!==true)return json({error:'legal_consent_required',legal_version:LEGAL_VERSION},400);
  const missing=billingMissing(env,tier);
  if(missing.length)return json({error:'billing_not_configured',tier,mode:c.mode,missing},503);
  const user=await authenticatedUser(request,env);
  if(!user)return json({error:'authentication_required'},401);
  const customer=await getStripeCustomerLink(env,user.userId);
  try{
    const session=await createCheckoutSession({
      env,userId:user.userId,email:user.email,customerId:customer?.stripe_customer_id||'',tier,
      legalVersion:LEGAL_VERSION,acceptedAt:Math.floor(Date.now()/1000),
      fetchImpl:deps.fetchImpl||fetch
    });
    return json(session);
  }catch(e){
    const reason=String(e?.message||e).slice(0,160);
    return json({error:'stripe_checkout_failed',tier,mode:c.mode,reason},502);
  }
}
export async function handlePortal(request,env,deps={}){
  const c=billingConfig(env);
  if(!sameOriginMutation(request,c.origin))return json({error:'invalid_origin'},403);
  const user=await authenticatedUser(request,env);
  if(!user)return json({error:'authentication_required'},401);
  const customer=await getStripeCustomerLink(env,user.userId);
  if(!customer?.stripe_customer_id)return json({error:'stripe_customer_not_linked'},409);
  try{
    const session=await createPortalSession({env,customerId:customer.stripe_customer_id,fetchImpl:deps.fetchImpl||fetch});
    return json(session);
  }catch{return json({error:'stripe_portal_failed'},502)}
}
export function subscriptionTierDataShaper(env,obj){
  const productKey=String(obj?.metadata?.product_key||'');
  const priceIds=Array.isArray(obj?.items?.data)?obj.items.data.map(item=>item?.price?.id).filter(Boolean):[];
  for(const tier of ['pro','lite']){
    const plan=tierBillingConfig(env,tier);
    if(productKey===plan.productKey&&plan.priceConfigured&&priceIds.includes(plan.priceId))return tier;
  }
  return '';
}
export function subscriptionMatchesDataShaper(env,obj){return !!subscriptionTierDataShaper(env,obj);}

async function persistCheckoutAcceptance(env,obj){
  const productKey=String(obj?.metadata?.product_key||'');
  const tier=String(obj?.metadata?.tier||'');
  if(!['data-shaper-lite','data-shaper-pro'].includes(productKey)||!['lite','pro'].includes(tier))return;
  const userId=String(obj.client_reference_id||obj.metadata?.data_shaper_user_id||'');
  const customerId=typeof obj.customer==='string'?obj.customer:obj.customer?.id;
  const sessionId=String(obj.id||'');
  const subscriptionId=typeof obj.subscription==='string'?obj.subscription:'';
  const legalVersion=String(obj.metadata?.legal_version||'');
  const acceptedAt=Number(obj.metadata?.legal_accepted_at);
  if(!/^usr_[0-9a-f-]{36}$/i.test(userId)||!/^cs_(?:test|live)_[A-Za-z0-9_]+$/.test(sessionId))return;
  if(!legalVersion||!Number.isInteger(acceptedAt)||acceptedAt<=0)return;
  await env.DB.prepare(`INSERT OR IGNORE INTO checkout_acceptances
    (stripe_checkout_session_id,stripe_customer_id,stripe_subscription_id,user_id,product_key,tier,legal_version,accepted_at,livemode)
    VALUES(?,?,?,?,?,?,?,?,?)`)
    .bind(sessionId,customerId||null,subscriptionId||null,userId,productKey,tier,legalVersion,acceptedAt,obj.livemode===true?1:0).run();
}
async function applyWebhookEvent(env,event){
  const obj=event?.data?.object||{};
  if(event?.type==='checkout.session.completed'){
    if(!['data-shaper-lite','data-shaper-pro'].includes(String(obj.metadata?.product_key||'')))return;
    const userId=String(obj.client_reference_id||obj.metadata?.data_shaper_user_id||'');
    const customerId=typeof obj.customer==='string'?obj.customer:obj.customer?.id;
    if(/^usr_[0-9a-f-]{36}$/i.test(userId)&&/^cus_[A-Za-z0-9]+$/.test(customerId||'')){
      await upsertStripeCustomerLink(env,userId,customerId);
    }
    await persistCheckoutAcceptance(env,obj);
    return;
  }
  if(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(event?.type)){
    const tier=subscriptionTierDataShaper(env,obj);
    if(!tier)return;
    const productKey='data-shaper-'+tier;
    const customerId=typeof obj.customer==='string'?obj.customer:obj.customer?.id;
    let userId=String(obj.metadata?.data_shaper_user_id||'');
    if(!/^usr_[0-9a-f-]{36}$/i.test(userId)&&customerId)userId=await getUserIdByStripeCustomer(env,customerId)||'';
    if(!/^usr_[0-9a-f-]{36}$/i.test(userId))return;
    const priceId=obj.items?.data?.[0]?.price?.id||null;
    const status=String(obj.status||'unknown');
    if(customerId)await upsertStripeCustomerLink(env,userId,customerId);
    if(obj.id&&customerId)await upsertStripeEntitlement(env,{subscriptionId:obj.id,userId,customerId,productKey,priceId,status});
  }
}
async function startWebhookEvent(env,event){
  const existing=await env.DB.prepare('SELECT processed_at FROM stripe_webhook_events WHERE event_id=?').bind(event.id).first();
  if(existing?.processed_at)return {duplicate:true};
  await env.DB.prepare('INSERT OR IGNORE INTO stripe_webhook_events(event_id,event_type,stripe_created,livemode) VALUES(?,?,?,?)')
    .bind(event.id,event.type,Number.isInteger(event.created)?event.created:null,event.livemode===true?1:0).run();
  return {duplicate:false};
}
async function finishWebhookEvent(env,eventId,error=null){
  if(error){
    await env.DB.prepare('UPDATE stripe_webhook_events SET last_error=? WHERE event_id=?').bind(String(error).slice(0,500),eventId).run();
  }else{
    await env.DB.prepare('UPDATE stripe_webhook_events SET processed_at=CURRENT_TIMESTAMP,last_error=NULL WHERE event_id=?').bind(eventId).run();
  }
}
export async function handleWebhook(request,env,deps={}){
  const c=billingConfig(env);
  if(!c.webhookConfigured||!env?.DB?.prepare)return json({error:'webhook_not_configured'},503);
  try{await ensureCommercialTables(env)}catch{return json({error:'commercial_schema_unavailable'},503)}
  const raw=await request.text();
  if(raw.length>1024*1024)return json({error:'payload_too_large'},413);
  const sig=request.headers.get('Stripe-Signature')||'';
  const valid=await verifyStripeWebhook(raw,sig,c.webhookSecret,{now:deps.now});
  if(!valid)return json({error:'invalid_signature'},400);
  let event;
  try{event=JSON.parse(raw)}catch{return json({error:'invalid_payload'},400)}
  if(!/^evt_[A-Za-z0-9_]+$/.test(String(event?.id||''))||typeof event?.type!=='string'||event.livemode!==expectedLivemode(env)){
    return json({error:'invalid_stripe_event'},400);
  }
  try{
    const state=await startWebhookEvent(env,event);
    if(state.duplicate)return json({received:true,duplicate:true});
    await applyWebhookEvent(env,event);
    await finishWebhookEvent(env,event.id);
    return json({received:true,duplicate:false});
  }catch(e){
    try{await finishWebhookEvent(env,event.id,e?.message||e)}catch{}
    return json({error:'webhook_processing_failed'},503);
  }
}
export async function handleBillingRequest(request,env){
  const path=new URL(request.url).pathname;
  if(request.method==='GET'&&path==='/api/billing/status')return handleBillingStatus(request,env);
  if(request.method==='POST'&&path==='/api/billing/checkout')return handleCheckout(request,env);
  if(request.method==='POST'&&path==='/api/billing/portal')return handlePortal(request,env);
  if(request.method==='POST'&&path==='/api/billing/webhook')return handleWebhook(request,env);
  return json({error:'not_found'},404);
}
