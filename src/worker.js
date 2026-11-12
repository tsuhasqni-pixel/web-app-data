import {integrationStatus,disclosureUrl,domainStatus,canonicalOrigin} from './integrations/status.js';
import {handleAuthRequest} from './auth/routes.js';
import {handleBillingRequest} from './billing/routes.js';

function json(body,status=200){
  return new Response(JSON.stringify(body),{status,headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff',
    'referrer-policy':'no-referrer'
  }});
}
function withSecurityHeaders(response){
  const headers=new Headers(response.headers);
  headers.set('x-content-type-options','nosniff');
  headers.set('referrer-policy','strict-origin-when-cross-origin');
  headers.set('x-frame-options','DENY');
  headers.set('permissions-policy','camera=(), microphone=(), geolocation=()');
  headers.set('content-security-policy',"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'");
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
function canonicalRedirect(request,env){
  const d=domainStatus(env);
  if(!d.canonical_redirect_enabled||!d.ready_for_cutover||!['GET','HEAD'].includes(request.method))return null;
  const current=new URL(request.url);
  if(current.pathname.startsWith('/api/'))return null;
  const canonical=canonicalOrigin(env);
  if(!canonical||current.origin===canonical)return null;
  const target=new URL(current.pathname+current.search,canonical);
  return Response.redirect(target.toString(),308);
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/auth/')){
      return handleAuthRequest(request,env);
    }
    if(url.pathname.startsWith('/api/billing/')){
      return handleBillingRequest(request,env);
    }
    if(url.pathname==='/api/integration-status'&&request.method==='GET'){
      return json(integrationStatus(env));
    }
    if(url.pathname==='/api/domain-readiness'&&request.method==='GET'){
      return json(domainStatus(env));
    }
    if(url.pathname==='/api/legal/disclosure'&&request.method==='GET'){
      const target=disclosureUrl(env);
      if(!target)return json({error:'disclosure_not_configured'},503);
      return Response.redirect(target,302);
    }
    const redirect=canonicalRedirect(request,env);
    if(redirect)return redirect;
    if(!env.ASSETS)return json({error:'assets_binding_missing'},503);
    return withSecurityHeaders(await env.ASSETS.fetch(request));
  }
};
