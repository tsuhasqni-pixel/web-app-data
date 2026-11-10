import {integrationStatus,disclosureUrl,domainStatus,canonicalOrigin} from './integrations/status.js';

function json(body,status=200){
  return new Response(JSON.stringify(body),{status,headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff',
    'referrer-policy':'no-referrer'
  }});
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
    return env.ASSETS.fetch(request);
  }
};
