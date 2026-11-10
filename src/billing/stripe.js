import {safeEqual,te} from '../auth/crypto.js';

const STRIPE_API='https://api.stripe.com/v1';

function clean(v){return typeof v==='string'?v.trim():''}
function isTestSecret(v){return /^(?:sk|rk)_test_[A-Za-z0-9_]+$/.test(v)}
function isPrice(v){return /^price_[A-Za-z0-9]+$/.test(v)}
function isWebhookSecret(v){return /^whsec_[A-Za-z0-9]+$/.test(v)}

export function billingConfig(env={}){
  const secret=clean(env.STRIPE_TEST_SECRET_KEY);
  const priceId=clean(env.DATA_SHAPER_STRIPE_TEST_PRICE_ID);
  const webhookSecret=clean(env.DATA_SHAPER_STRIPE_WEBHOOK_SECRET);
  const origin=clean(env.APP_ORIGIN);
  return {
    enabled:env.DATA_SHAPER_BILLING_ENABLED==='true',
    secret,
    priceId,
    webhookSecret,
    origin,
    secretConfigured:isTestSecret(secret),
    priceConfigured:isPrice(priceId),
    webhookConfigured:isWebhookSecret(webhookSecret),
    originConfigured:/^https:\/\//.test(origin)
  };
}
export function billingMissing(env={}){
  const c=billingConfig(env),missing=[];
  if(!c.secretConfigured)missing.push('STRIPE_TEST_SECRET_KEY');
  if(!c.priceConfigured)missing.push('DATA_SHAPER_STRIPE_TEST_PRICE_ID');
  if(!c.webhookConfigured)missing.push('DATA_SHAPER_STRIPE_WEBHOOK_SECRET');
  if(!c.originConfigured)missing.push('APP_ORIGIN');
  if(!env?.DB?.prepare)missing.push('DB');
  return missing;
}

function encodeForm(params){
  const body=new URLSearchParams();
  for(const [key,value] of Object.entries(params||{})){
    if(value===undefined||value===null||value==='')continue;
    body.set(key,String(value));
  }
  return body.toString();
}
async function stripePost(path,params,secret,fetchImpl=fetch){
  const res=await fetchImpl(STRIPE_API+path,{
    method:'POST',
    headers:{
      authorization:'Bearer '+secret,
      'content-type':'application/x-www-form-urlencoded'
    },
    body:encodeForm(params)
  });
  let data={};
  try{data=await res.json()}catch{}
  if(!res.ok)throw new Error('stripe_api_error_'+res.status);
  return data;
}
export async function createCheckoutSession({env,userId,email,customerId,fetchImpl=fetch}){
  const c=billingConfig(env);
  if(!c.enabled)throw new Error('billing_disabled');
  const missing=billingMissing(env);
  if(missing.length)throw new Error('billing_not_configured:'+missing.join(','));
  const params={
    mode:'subscription',
    'line_items[0][price]':c.priceId,
    'line_items[0][quantity]':'1',
    success_url:c.origin+'/?billing=success',
    cancel_url:c.origin+'/?billing=cancelled',
    client_reference_id:userId,
    'metadata[data_shaper_user_id]':userId,
    'metadata[product_key]':'data-shaper-pro',
    'subscription_data[metadata][data_shaper_user_id]':userId,
    'subscription_data[metadata][product_key]':'data-shaper-pro'
  };
  if(customerId)params.customer=customerId;
  else if(email)params.customer_email=email;
  const session=await stripePost('/checkout/sessions',params,c.secret,fetchImpl);
  if(!session?.url||!session?.id)throw new Error('stripe_checkout_invalid_response');
  return {id:session.id,url:session.url};
}
export async function createPortalSession({env,customerId,fetchImpl=fetch}){
  const c=billingConfig(env);
  if(!c.secretConfigured||!c.originConfigured)throw new Error('billing_not_configured');
  if(!customerId)throw new Error('stripe_customer_not_linked');
  const session=await stripePost('/billing_portal/sessions',{
    customer:customerId,
    return_url:c.origin+'/'
  },c.secret,fetchImpl);
  if(!session?.url)throw new Error('stripe_portal_invalid_response');
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
