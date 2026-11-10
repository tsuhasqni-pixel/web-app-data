function clean(value){return typeof value==='string'?value.trim():''}
function httpsUrl(value){
  try{const u=new URL(clean(value));return u.protocol==='https:'&&u.username===''&&u.password===''?u.toString():''}catch{return ''}
}
function secretConfigured(value,prefix){const v=clean(value);return v.length>=16&&(!prefix||v.startsWith(prefix))}
function exactOrigin(value,{allowLocal=false}={}){
  try{
    const u=new URL(clean(value));
    const local=allowLocal&&u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname);
    if(!(u.protocol==='https:'||local)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)return '';
    return u.origin;
  }catch{return ''}
}
function platformHostname(hostname){
  const h=String(hostname||'').toLowerCase();
  return h.endsWith('.pages.dev')||h.endsWith('.workers.dev')||h==='pages.dev'||h==='workers.dev';
}
export function domainStatus(env={}){
  const origin=exactOrigin(env.APP_ORIGIN,{allowLocal:true});
  let hostname='';
  try{hostname=origin?new URL(origin).hostname:''}catch{}
  const isLocal=['localhost','127.0.0.1','[::1]'].includes(hostname);
  const customDomain=!!origin&&!isLocal&&!platformHostname(hostname);
  const enforce=clean(env.ENFORCE_CANONICAL_ORIGIN)==='true';
  return {
    configured:!!origin,
    origin:origin||null,
    hostname:hostname||null,
    custom_domain:customDomain,
    canonical_redirect_enabled:enforce,
    ready_for_cutover:customDomain
  };
}
export function canonicalOrigin(env={}){return domainStatus(env).origin}
export function integrationStatus(env={}){
  const billingEnabled=clean(env.DATA_SHAPER_BILLING_ENABLED)==='true';
  const stripeKey=clean(env.STRIPE_TEST_SECRET_KEY||env.STRIPE_SECRET_KEY);
  const stripePrice=clean(env.DATA_SHAPER_STRIPE_TEST_PRICE_ID);
  const stripeWebhook=clean(env.DATA_SHAPER_STRIPE_WEBHOOK_SECRET);
  const stripeConfigured=secretConfigured(stripeKey,'sk_test_')||secretConfigured(stripeKey,'rk_test_');
  const priceConfigured=/^price_[A-Za-z0-9]+$/.test(stripePrice);
  const webhookConfigured=secretConfigured(stripeWebhook,'whsec_');
  const disclosure=httpsUrl(env.LEGAL_DISCLOSURE_URL);
  const domain=domainStatus(env);
  return {
    service:'data-shaper',
    production_billing:false,
    cloudflare:{assets_bound:!!env.ASSETS},
    domain,
    stripe:{
      mode:'test',
      enabled:billingEnabled,
      secret_configured:stripeConfigured,
      price_configured:priceConfigured,
      webhook_configured:webhookConfigured,
      ready:billingEnabled&&stripeConfigured&&priceConfigured&&webhookConfigured
    },
    legal:{disclosure_configured:!!disclosure},
    ready_for_test_connections:!!env.ASSETS&&stripeConfigured&&priceConfigured&&webhookConfigured&&!!disclosure,
    ready_for_domain_cutover:!!env.ASSETS&&domain.ready_for_cutover&&!!disclosure
  };
}
export function disclosureUrl(env={}){return httpsUrl(env.LEGAL_DISCLOSURE_URL)}
