function clean(value){return typeof value==='string'?value.trim():''}
function httpsUrl(value){
  try{const u=new URL(clean(value));return u.protocol==='https:'&&u.username===''&&u.password===''?u.toString():''}catch{return ''}
}
function secretConfigured(value,prefix){const v=clean(value);return v.length>=16&&(!prefix||v.startsWith(prefix))}
export function integrationStatus(env={}){
  const billingEnabled=clean(env.DATA_SHAPER_BILLING_ENABLED)==='true';
  const stripeKey=clean(env.STRIPE_TEST_SECRET_KEY||env.STRIPE_SECRET_KEY);
  const stripePrice=clean(env.DATA_SHAPER_STRIPE_TEST_PRICE_ID);
  const stripeWebhook=clean(env.DATA_SHAPER_STRIPE_WEBHOOK_SECRET);
  const stripeConfigured=secretConfigured(stripeKey,'sk_test_')||secretConfigured(stripeKey,'rk_test_');
  const priceConfigured=/^price_[A-Za-z0-9]+$/.test(stripePrice);
  const webhookConfigured=secretConfigured(stripeWebhook,'whsec_');
  const disclosure=httpsUrl(env.LEGAL_DISCLOSURE_URL);
  return {
    service:'data-shaper',
    production_billing:false,
    cloudflare:{assets_bound:!!env.ASSETS},
    stripe:{
      mode:'test',
      enabled:billingEnabled,
      secret_configured:stripeConfigured,
      price_configured:priceConfigured,
      webhook_configured:webhookConfigured,
      ready:billingEnabled&&stripeConfigured&&priceConfigured&&webhookConfigured
    },
    legal:{disclosure_configured:!!disclosure},
    ready_for_test_connections:!!env.ASSETS&&stripeConfigured&&priceConfigured&&webhookConfigured&&!!disclosure
  };
}
export function disclosureUrl(env={}){return httpsUrl(env.LEGAL_DISCLOSURE_URL)}
