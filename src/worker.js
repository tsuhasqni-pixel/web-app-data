import {integrationStatus,disclosureUrl} from './integrations/status.js';

function json(body,status=200){
  return new Response(JSON.stringify(body),{status,headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff',
    'referrer-policy':'no-referrer'
  }});
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==='/api/integration-status'&&request.method==='GET'){
      return json(integrationStatus(env));
    }
    if(url.pathname==='/api/legal/disclosure'&&request.method==='GET'){
      const target=disclosureUrl(env);
      if(!target)return json({error:'disclosure_not_configured'},503);
      return Response.redirect(target,302);
    }
    if(!env.ASSETS)return json({error:'assets_binding_missing'},503);
    return env.ASSETS.fetch(request);
  }
};
