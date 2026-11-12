import {billingConfig,billingMode,billingMissing} from '../billing/stripe.js';
import {googleConfig,googleConfigMissing,GOOGLE_SCOPES} from '../auth/google.js';

function clean(value){return typeof value==='string'?value.trim():''}
function httpsUrl(value){
  try{const u=new URL(clean(value));return u.protocol==='https:'&&u.username===''&&u.password===''?u.toString():''}catch{return ''}
}
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
  return {configured:!!origin,origin:origin||null,hostname:hostname||null,custom_domain:customDomain,canonical_redirect_enabled:enforce,ready_for_cutover:customDomain};
}
export function canonicalOrigin(env={}){return domainStatus(env).origin}
export function integrationStatus(env={}){
  const c=billingConfig(env),mode=billingMode(env),proMissing=billingMissing(env,'pro'),liteMissing=billingMissing(env,'lite');
  const disclosure=httpsUrl(env.LEGAL_DISCLOSURE_URL),domain=domainStatus(env);
  const gc=googleConfig(env),googleMissing=googleConfigMissing(env);
  const google={
    provider:'google',scopes:GOOGLE_SCOPES.split(' '),
    client_id_configured:gc.clientIdConfigured,
    client_secret_configured:gc.clientSecretConfigured,
    session_secret_configured:gc.sessionSecretConfigured,
    identity_store_bound:!!env.DB?.prepare,
    entitlement_source:'stripe',
    ready:googleMissing.length===0,
    missing:googleMissing
  };
  const proReady=c.enabled&&proMissing.length===0;
  const liteReady=c.enabled&&liteMissing.length===0;
  return {
    service:'data-shaper',
    production_billing:mode==='live',
    cloudflare:{assets_bound:!!env.ASSETS},
    domain,
    stripe:{
      mode,enabled:c.enabled,
      secret_configured:c.secretConfigured,
      price_configured:c.proPriceConfigured,
      pro_price_configured:c.proPriceConfigured,
      lite_price_configured:c.litePriceConfigured,
      webhook_configured:c.webhookConfigured,
      portal_configured:c.portalConfigured,
      tax_display_confirmed:c.taxDisplayConfirmed,
      refund_policy_confirmed:c.refundPolicyConfirmed,
      live_sale_approved:c.liveSaleApproved,
      pro_ready:proReady,lite_ready:liteReady,ready:proReady&&liteReady,
      pro_missing:proMissing,lite_missing:liteMissing
    },
    legal:{disclosure_configured:!!disclosure},
    google_oauth:google,
    ready_for_google_oauth:google.ready,
    ready_for_test_connections:mode==='test'&&!!env.ASSETS&&c.secretConfigured&&c.proPriceConfigured&&c.webhookConfigured&&!!disclosure,
    ready_for_live_connections:mode==='live'&&!!env.ASSETS&&proReady&&liteReady&&google.ready&&!!disclosure,
    ready_for_domain_cutover:!!env.ASSETS&&domain.ready_for_cutover&&!!disclosure
  };
}
export function disclosureUrl(env={}){return httpsUrl(env.LEGAL_DISCLOSURE_URL)}
