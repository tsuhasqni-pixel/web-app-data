import {googleConfig} from '../auth/google.js';
import {readSession} from '../auth/session.js';
import {getUserIdentity,getStripeCustomerLink,getUserIdByStripeCustomer,upsertStripeCustomerLink,upsertStripeEntitlement} from '../auth/store.js';
import {billingConfig,billingMissing,createCheckoutSession,createPortalSession,tierBillingConfig,verifyStripeWebhook} from './stripe.js';

function json(body,status=200){
  return new Response(JSON.stringify(body),{status,headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff',
    'referrer-policy':'no-referrer'
  }});
}
function sameOriginMutation(request,origin){
  try{
    if(new URL(request.url).origin!==origin)return false;
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
export async function handleBillingStatus(_request,env){
  const c=billingConfig(env),proMissing=billingMissing(env,'pro'),liteMissing=billingMissing(env,'lite');
  const taxDisplayConfirmed=env.DATA_SHAPER_TAX_DISPLAY_CONFIRMED==='true';
  return json({
    provider:'stripe',
    mode:'test',
    tax_display_confirmed:taxDisplayConfirmed,
    billing_enabled:c.enabled,
    stripe_secret_configured:c.secretConfigured,
    price_configured:c.proPriceConfigured,
    pro_price_configured:c.proPriceConfigured,
    lite_price_configured:c.litePriceConfigured,
    webhook_secret_configured:c.webhookConfigured,
    identity_store_bound:!!env?.DB?.prepare,
    ready_for_test:c.enabled&&proMissing.length===0,
    pro_ready_for_test:c.enabled&&proMissing.length===0,
    lite_ready_for_test:c.enabled&&liteMissing.length===0,
    sale_gate_ready:c.enabled&&proMissing.length===0&&liteMissing.length===0&&taxDisplayConfirmed,
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
  const missing=billingMissing(env,tier);
  if(missing.length)return json({error:'billing_not_configured',tier,missing},503);
  const user=await authenticatedUser(request,env);
  if(!user)return json({error:'authentication_required'},401);
  const customer=await getStripeCustomerLink(env,user.userId);
  try{
    const session=await createCheckoutSession({
      env,userId:user.userId,email:user.email,customerId:customer?.stripe_customer_id||'',tier,
      fetchImpl:deps.fetchImpl||fetch
    });
    return json(session);
  }catch{return json({error:'stripe_checkout_failed',tier},502)}
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
export function subscriptionMatchesDataShaper(env,obj){
  return !!subscriptionTierDataShaper(env,obj);
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
    return;
  }
  if(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(event?.type)){
    const tier=subscriptionTierDataShaper(env,obj);
    if(!tier)return;
    const productKey='data-shaper-'+tier;
    const customerId=typeof obj.customer==='string'?obj.customer:obj.customer?.id;
    let userId=String(obj.metadata?.data_shaper_user_id||'');
    if(!/^usr_[0-9a-f-]{36}$/i.test(userId)&&customerId){
      userId=await getUserIdByStripeCustomer(env,customerId)||'';
    }
    if(!/^usr_[0-9a-f-]{36}$/i.test(userId))return;
    const priceId=obj.items?.data?.[0]?.price?.id||null;
    const status=String(obj.status||'unknown');
    if(customerId)await upsertStripeCustomerLink(env,userId,customerId);
    if(obj.id&&customerId)await upsertStripeEntitlement(env,{
      subscriptionId:obj.id,userId,customerId,productKey,priceId,status
    });
  }
}
export async function handleWebhook(request,env,deps={}){
  const c=billingConfig(env);
  if(!c.webhookConfigured||!env?.DB?.prepare)return json({error:'webhook_not_configured'},503);
  const raw=await request.text();
  const sig=request.headers.get('Stripe-Signature')||'';
  const valid=await verifyStripeWebhook(raw,sig,c.webhookSecret,{now:deps.now});
  if(!valid)return json({error:'invalid_signature'},400);
  let event;
  try{event=JSON.parse(raw)}catch{return json({error:'invalid_payload'},400)}
  try{await applyWebhookEvent(env,event);return json({received:true});}
  catch{return json({error:'webhook_processing_failed'},500)}
}
export async function handleBillingRequest(request,env){
  const path=new URL(request.url).pathname;
  if(request.method==='GET'&&path==='/api/billing/status')return handleBillingStatus(request,env);
  if(request.method==='POST'&&path==='/api/billing/checkout')return handleCheckout(request,env);
  if(request.method==='POST'&&path==='/api/billing/portal')return handlePortal(request,env);
  if(request.method==='POST'&&path==='/api/billing/webhook')return handleWebhook(request,env);
  return json({error:'not_found'},404);
}
