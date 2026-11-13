import {safeEqual,te} from '../auth/crypto.js';

const STRIPE_API='https://api.stripe.com/v1';
export const DATA_SHAPER_TIERS={
  lite:{productKey:'data-shaper-lite',monthlyJpy:480},
  pro:{productKey:'data-shaper-pro',monthlyJpy:980}
};

function clean(v){return typeof v==='string'?v.trim():''}
function isTestSecret(v){return /^(?:sk|rk)_test_[^\s=]+$/.test(v)}
function isLiveSecret(v){return /^(?:sk|rk)_live_[^\s=]+$/.test(v)}
function isKnownNonApiCredential(v){
  return /^(?:pk_|whsec_|price_|prod_|bpc_|cs_|pi_|sub_|cus_)/.test(v);
}
function isLiveCredentialCandidate(v){
  const x=clean(v);
  if(!x||x.includes('=')||/\s/.test(x))return false;
  if(/^(?:sk|rk)_test_/.test(x)||isKnownNonApiCredential(x))return false;
  return true;
}
function liveCredentialRank(v){
  const x=clean(v);
  if(isLiveSecret(x))return 3;
  if(isLiveCredentialCandidate(x))return 2;
  return 0;
}
export function stripeSecretIssue(value,{live=false}={}){
  const v=clean(value);
  if(!v)return 'missing';
  if(v.includes('=')||/^(?:STRIPE_[A-Z_]+|DATA_SHAPER_[A-Z_]+)=/.test(v))return 'pasted_assignment';
  if(/^pk_(?:live|test)_/.test(v))return 'publishable_key_not_secret';
  if(/^whsec_/.test(v))return 'webhook_secret_not_api_key';
  if(/^price_/.test(v))return 'price_id_not_api_key';
  if(/^prod_/.test(v))return 'product_id_not_api_key';
  if(/^bpc_/.test(v))return 'portal_config_not_api_key';
  if(live&&/^(?:sk|rk)_test_/.test(v))return 'test_key_in_live';
  if(!live&&/^(?:sk|rk)_live_/.test(v))return 'live_key_in_test';
  if(live&&isLiveSecret(v))return null;
  if(live&&isLiveCredentialCandidate(v))return 'unrecognized_format_verify_with_stripe';
  if(!live&&!isTestSecret(v))return 'invalid_test_secret_format';
  return null;
}
function isPrice(v){return /^price_[A-Za-z0-9]+$/.test(v)}
function isWebhookSecret(v){return /^whsec_[A-Za-z0-9]+$/.test(v)}
function isPortalConfig(v){return /^bpc_[A-Za-z0-9]+$/.test(v)}
function exactOrigin(value){
  const raw=clean(value);
  if(!raw)return '';
  try{
    const u=new URL(raw);
    const local=u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname);
    if(!(u.protocol==='https:'||local)||u.username||u.password||u.origin!==raw)return '';
    return u.origin;
  }catch{return ''}
}

export function billingMode(env={}){return env.DATA_SHAPER_LIVE_BILLING_ENABLED==='true'?'live':'test'}
export function expectedLivemode(env={}){return billingMode(env)==='live'}

function firstConfigured(entries){
  for(const [name,value] of entries){
    const cleaned=clean(value);
    if(cleaned)return {name,value:cleaned};
  }
  return {name:'',value:''};
}
function firstValid(entries,validator){
  let firstNonEmpty={name:'',value:''};
  for(const [name,value] of entries){
    const cleaned=clean(value);
    if(!cleaned)continue;
    if(!firstNonEmpty.value)firstNonEmpty={name,value:cleaned};
    if(validator(cleaned))return {name,value:cleaned};
  }
  return firstNonEmpty;
}
function bestLiveCredential(entries){
  let best={name:'',value:'',rank:0};
  for(const [name,value] of entries){
    const cleaned=clean(value);
    const rank=liveCredentialRank(cleaned);
    if(rank>best.rank)best={name,value:cleaned,rank};
  }
  if(best.rank>0)return {name:best.name,value:best.value};
  return firstConfigured(entries);
}
export function billingConfig(env={}){
  const mode=billingMode(env),live=mode==='live';
  const secretEntry=live
    ?bestLiveCredential([
      ['STRIPE_LIVE_SECRET_KEY',env.STRIPE_LIVE_SECRET_KEY],
      ['STRIPE_SECRET_KEY',env.STRIPE_SECRET_KEY],
      ['STRIPE_API_KEY',env.STRIPE_API_KEY]
    ])
    :firstValid([['STRIPE_TEST_SECRET_KEY',env.STRIPE_TEST_SECRET_KEY]],isTestSecret);
  const webhookEntry=live
    ?firstConfigured([
      ['DATA_SHAPER_STRIPE_LIVE_WEBHOOK_SECRET',env.DATA_SHAPER_STRIPE_LIVE_WEBHOOK_SECRET],
      ['STRIPE_LIVE_WEBHOOK_SECRET',env.STRIPE_LIVE_WEBHOOK_SECRET],
      ['DATA_SHAPER_STRIPE_WEBHOOK_SECRET',env.DATA_SHAPER_STRIPE_WEBHOOK_SECRET],
      ['STRIPE_WEBHOOK_SECRET',env.STRIPE_WEBHOOK_SECRET]
    ])
    :firstConfigured([['DATA_SHAPER_STRIPE_WEBHOOK_SECRET',env.DATA_SHAPER_STRIPE_WEBHOOK_SECRET]]);
  const secret=secretEntry.value;
  const proPriceId=clean(live?env.DATA_SHAPER_STRIPE_LIVE_PRO_PRICE_ID:env.DATA_SHAPER_STRIPE_TEST_PRICE_ID);
  const litePriceId=clean(live?env.DATA_SHAPER_STRIPE_LIVE_LITE_PRICE_ID:env.DATA_SHAPER_STRIPE_TEST_LITE_PRICE_ID);
  const webhookSecret=webhookEntry.value;
  const portalConfigId=clean(live?env.DATA_SHAPER_STRIPE_LIVE_PORTAL_CONFIG_ID:env.DATA_SHAPER_STRIPE_TEST_PORTAL_CONFIG_ID);
  const origin=exactOrigin(env.APP_ORIGIN);
  return {
    mode,live,
    enabled:env.DATA_SHAPER_BILLING_ENABLED==='true',
    secret,secretSource:secretEntry.name,secretIssue:stripeSecretIssue(secret,{live}),proPriceId,litePriceId,priceId:proPriceId,webhookSecret,webhookSource:webhookEntry.name,portalConfigId,origin,
    secretConfigured:live?isLiveCredentialCandidate(secret):isTestSecret(secret),
    proPriceConfigured:isPrice(proPriceId),
    litePriceConfigured:isPrice(litePriceId),
    priceConfigured:isPrice(proPriceId),
    webhookConfigured:isWebhookSecret(webhookSecret),
    portalConfigured:isPortalConfig(portalConfigId),
    originConfigured:!!origin,
    liveOriginConfigured:!!origin&&origin.startsWith('https://'),
    taxDisplayConfirmed:env.DATA_SHAPER_TAX_DISPLAY_CONFIRMED==='true',
    refundPolicyConfirmed:env.DATA_SHAPER_REFUND_POLICY_CONFIRMED==='true',
    liveSaleApproved:env.DATA_SHAPER_LIVE_SALE_APPROVED==='true'
  };
}

export function billingMissing(env={},tier='pro'){
  const c=billingConfig(env),missing=[];
  if(!c.secretConfigured)missing.push(c.live?'STRIPE_LIVE_SECRET_KEY':'STRIPE_TEST_SECRET_KEY');
  if(tier==='lite'&&!c.litePriceConfigured)missing.push(c.live?'DATA_SHAPER_STRIPE_LIVE_LITE_PRICE_ID':'DATA_SHAPER_STRIPE_TEST_LITE_PRICE_ID');
  if(tier==='pro'&&!c.proPriceConfigured)missing.push(c.live?'DATA_SHAPER_STRIPE_LIVE_PRO_PRICE_ID':'DATA_SHAPER_STRIPE_TEST_PRICE_ID');
  if(!c.webhookConfigured)missing.push(c.live?'DATA_SHAPER_STRIPE_LIVE_WEBHOOK_SECRET':'DATA_SHAPER_STRIPE_WEBHOOK_SECRET');
  if(!c.originConfigured)missing.push('APP_ORIGIN');
  if(c.live&&!c.liveOriginConfigured)missing.push('APP_ORIGIN_LIVE_HTTPS');
  if(!env?.DB?.prepare)missing.push('DB');
  if(c.live){
    if(!c.portalConfigured)missing.push('DATA_SHAPER_STRIPE_LIVE_PORTAL_CONFIG_ID');
    if(!c.taxDisplayConfirmed)missing.push('DATA_SHAPER_TAX_DISPLAY_CONFIRMED');
    if(!c.refundPolicyConfirmed)missing.push('DATA_SHAPER_REFUND_POLICY_CONFIRMED');
    if(!c.liveSaleApproved)missing.push('DATA_SHAPER_LIVE_SALE_APPROVED');
  }
  return missing;
}

export function tierBillingConfig(env={},tier='pro'){
  const plan=DATA_SHAPER_TIERS[tier];
  if(!plan)throw new Error('invalid_tier');
  const c=billingConfig(env);
  return {
    ...plan,tier,
    priceId:tier==='lite'?c.litePriceId:c.proPriceId,
    priceConfigured:tier==='lite'?c.litePriceConfigured:c.proPriceConfigured
  };
}

function encodeForm(params){
  const body=new URLSearchParams();
  for(const [key,value] of Object.entries(params||{})){
    if(value===undefined||value===null||value==='')continue;
    body.set(key,String(value));
  }
  return body.toString();
}
async function stripeRequest(path,{method='GET',params=null,secret,fetchImpl=fetch}={}){
  const init={method,headers:{authorization:'Bearer '+secret,'stripe-version':'2026-09-30.preview','accept':'application/json'}};
  if(method==='POST'){
    init.headers['content-type']='application/x-www-form-urlencoded';
    init.body=encodeForm(params);
  }
  const res=await fetchImpl(STRIPE_API+path,init);
  let data={};
  try{data=await res.json()}catch{}
  if(!res.ok)throw new Error('stripe_api_error_'+res.status);
  return data;
}
async function stripePost(path,params,secret,fetchImpl=fetch){
  return stripeRequest(path,{method:'POST',params,secret,fetchImpl});
}
async function stripeGet(path,secret,fetchImpl=fetch){
  return stripeRequest(path,{method:'GET',secret,fetchImpl});
}

export function validateTierPriceObject(price,{tier='pro',livemode=true}={}){
  const plan=DATA_SHAPER_TIERS[tier];
  if(!plan)return {ok:false,reason:'invalid_tier'};
  if(price?.livemode!==livemode)return {ok:false,reason:'livemode'};
  if(price?.active!==true)return {ok:false,reason:'inactive'};
  if(price?.currency!=='jpy')return {ok:false,reason:'currency'};
  if(price?.unit_amount!==plan.monthlyJpy)return {ok:false,reason:'amount'};
  if(price?.recurring?.interval!=='month'||Number(price?.recurring?.interval_count||1)!==1)return {ok:false,reason:'interval'};
  const product=price?.product;
  if(!product||typeof product!=='object')return {ok:false,reason:'product_not_expanded'};
  if(product.active!==true)return {ok:false,reason:'product_inactive'};
  if(product.metadata?.app!=='data-shaper'||product.metadata?.tier!==tier)return {ok:false,reason:'product_metadata'};
  return {ok:true,reason:null,price};
}

export async function verifyTierPrice(env,tier='pro',{fetchImpl=fetch}={}){
  const c=billingConfig(env),plan=tierBillingConfig(env,tier);
  if(!plan.priceConfigured)return {ok:false,reason:'missing'};
  const price=await stripeGet('/prices/'+encodeURIComponent(plan.priceId)+'?expand[]=product',c.secret,fetchImpl);
  return validateTierPriceObject(price,{tier,livemode:c.live});
}

export async function verifyStripeAccount(env,{fetchImpl=fetch}={}){
  const c=billingConfig(env);
  if(!c.secretConfigured)return {checked:false,charges_enabled:false,payouts_enabled:false,details_submitted:false};
  const account=await stripeGet('/account',c.secret,fetchImpl);
  return {
    checked:true,
    charges_enabled:account?.charges_enabled===true,
    payouts_enabled:account?.payouts_enabled===true,
    details_submitted:account?.details_submitted===true
  };
}

export async function createCheckoutSession({env,userId,email,customerId,tier='pro',legalVersion='',acceptedAt=null,reservationId='',fetchImpl=fetch}){
  const c=billingConfig(env);
  if(!c.enabled)throw new Error('billing_disabled');
  const plan=tierBillingConfig(env,tier);
  const missing=billingMissing(env,tier);
  if(missing.length)throw new Error('billing_not_configured:'+missing.join(','));
  if(c.live){
    const verified=await verifyTierPrice(env,tier,{fetchImpl});
    if(!verified.ok)throw new Error('live_price_verification_failed:'+verified.reason);
  }
  const params={
    mode:'subscription',
    'line_items[0][price]':plan.priceId,
    'line_items[0][quantity]':'1',
    success_url:c.origin+'/?billing=success&tier='+encodeURIComponent(tier),
    cancel_url:c.origin+'/?billing=cancelled',
    client_reference_id:userId,
    'metadata[data_shaper_user_id]':userId,
    'metadata[product_key]':plan.productKey,
    'metadata[tier]':tier,
    'metadata[legal_version]':legalVersion,
    'metadata[legal_accepted_at]':acceptedAt?String(acceptedAt):'',
    'metadata[capacity_reservation_id]':reservationId,
    'subscription_data[metadata][data_shaper_user_id]':userId,
    'subscription_data[metadata][product_key]':plan.productKey,
    'subscription_data[metadata][tier]':tier,
    'subscription_data[metadata][capacity_reservation_id]':reservationId
  };
  if(customerId)params.customer=customerId;
  else if(email)params.customer_email=email;
  const session=await stripePost('/checkout/sessions',params,c.secret,fetchImpl);
  if(!session?.url?.startsWith('https://checkout.stripe.com/')||!session?.id)throw new Error('stripe_checkout_invalid_response');
  return {id:session.id,url:session.url,tier,mode:c.mode};
}

export async function createPortalSession({env,customerId,fetchImpl=fetch}){
  const c=billingConfig(env);
  if(!c.secretConfigured||!c.originConfigured)throw new Error('billing_not_configured');
  if(c.live&&!c.portalConfigured)throw new Error('live_portal_not_configured');
  if(!customerId)throw new Error('stripe_customer_not_linked');
  const params={customer:customerId,return_url:c.origin+'/'};
  if(c.portalConfigured)params.configuration=c.portalConfigId;
  const session=await stripePost('/billing_portal/sessions',params,c.secret,fetchImpl);
  if(!session?.url?.startsWith('https://billing.stripe.com/'))throw new Error('stripe_portal_invalid_response');
  return {url:session.url};
}

function bytesToHex(bytes){return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function hmacHex(message,secret){
  const key=await crypto.subtle.importKey('raw',te.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sig=await crypto.subtle.sign('HMAC',key,te.encode(message));
  return bytesToHex(new Uint8Array(sig));
}
export async function verifyStripeWebhook(rawBody,signatureHeader,secret,{now=Math.floor(Date.now()/1000),tolerance=300}={}){
  if(!isWebhookSecret(secret))return false;
  const parts=String(signatureHeader||'').split(',').map(x=>x.trim()).filter(Boolean);
  let timestamp=null;const signatures=[];
  for(const part of parts){
    const i=part.indexOf('=');
    if(i<0)continue;
    const k=part.slice(0,i),v=part.slice(i+1);
    if(k==='t'&&/^\d+$/.test(v))timestamp=Number(v);
    if(k==='v1'&&/^[a-f0-9]{64}$/i.test(v))signatures.push(v.toLowerCase());
  }
  if(!Number.isInteger(timestamp)||!signatures.length)return false;
  if(Math.abs(now-timestamp)>tolerance)return false;
  const expected=await hmacHex(String(timestamp)+'.'+rawBody,secret);
  return signatures.some(sig=>safeEqual(sig,expected));
}
