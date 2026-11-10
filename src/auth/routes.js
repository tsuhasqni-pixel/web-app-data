import {safeEqual} from './crypto.js';
import {buildGoogleAuthorization,exchangeAuthorizationCode,googleConfig,googleConfigMissing,verifyGoogleIdToken} from './google.js';
import {clearOAuthFlowCookie,clearSessionCookie,issueOAuthFlowCookie,issueSessionCookie,readOAuthFlow,readSession} from './session.js';
import {findOrCreateGoogleUser,getUserIdentity,identitySchemaReady,resolveEntitlement} from './store.js';

function json(body,status=200,headers={}){
  const h=new Headers({'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});
  for(const [k,v] of Object.entries(headers))h.set(k,v);
  return new Response(JSON.stringify(body),{status,headers:h});
}
function redirect(location,cookies=[]){
  const headers=new Headers({'location':location,'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'});
  for(const value of cookies)headers.append('set-cookie',value);
  return new Response(null,{status:302,headers});
}
function sameCanonicalOrigin(request,origin){
  try{return new URL(request.url).origin===origin}catch{return false}
}
function sameOriginMutation(request,origin){
  try{
    if(new URL(request.url).origin!==origin)return false;
    const header=request.headers.get('Origin');
    if(header)return new URL(header).origin===origin;
    const ref=request.headers.get('Referer');
    return !!ref&&new URL(ref).origin===origin;
  }catch{return false}
}
export async function handleGoogleStart(request,env){
  const missing=googleConfigMissing(env);
  if(missing.length)return json({error:'google_oauth_not_configured',missing},503);
  const c=googleConfig(env);
  if(!sameCanonicalOrigin(request,c.origin))return json({error:'canonical_origin_required'},409);
  const {url,flow}=await buildGoogleAuthorization(env);
  const flowCookie=await issueOAuthFlowCookie(flow,c.sessionSecret);
  return redirect(url,[flowCookie]);
}
export async function handleGoogleCallback(request,env,deps={}){
  const c=googleConfig(env),missing=googleConfigMissing(env);
  if(missing.length)return json({error:'google_oauth_not_configured',missing},503);
  if(!sameCanonicalOrigin(request,c.origin))return json({error:'invalid_callback_origin'},400);
  const url=new URL(request.url);
  if(url.searchParams.has('error')){
    return redirect(c.origin+'/?auth=google_error',[clearOAuthFlowCookie()]);
  }
  const code=url.searchParams.get('code')||'',state=url.searchParams.get('state')||'';
  if(!code||!state)return json({error:'invalid_oauth_callback'},400,{'set-cookie':clearOAuthFlowCookie()});
  const flow=await readOAuthFlow(request,c.sessionSecret,deps.now);
  if(!flow||!safeEqual(state,flow.state))return json({error:'invalid_oauth_state'},400,{'set-cookie':clearOAuthFlowCookie()});
  try{
    const token=await exchangeAuthorizationCode(code,flow,env,deps.fetchImpl||fetch);
    const claims=await verifyGoogleIdToken(token.idToken,{clientId:c.clientId,nonce:flow.nonce,now:deps.now,jwks:deps.jwks||null,fetchImpl:deps.fetchImpl||fetch});
    const userId=await (deps.findOrCreateUser||findOrCreateGoogleUser)(env,claims);
    const sessionCookie=await issueSessionCookie(userId,c.sessionSecret,deps.now);
    return redirect(c.origin+'/?auth=google_success',[sessionCookie,clearOAuthFlowCookie()]);
  }catch{
    return redirect(c.origin+'/?auth=google_failed',[clearOAuthFlowCookie()]);
  }
}
export async function handleSession(request,env){
  const c=googleConfig(env);
  const empty={authenticated:false,user:null,entitlement:{tier:'free',pro:false,source:'stripe',reason:'not_authenticated'}};
  if(!c.sessionSecretConfigured||!env?.DB?.prepare)return json(empty);
  const session=await readSession(request,c.sessionSecret);
  if(!session)return json(empty);
  try{
    const identity=await getUserIdentity(env,session.user_id);
    if(!identity)return json(empty);
    const entitlement=await resolveEntitlement(env,session.user_id);
    return json({
      authenticated:true,
      user:{id:identity.user_id,email:identity.email,email_verified:identity.email_verified===1||identity.email_verified===true,name:identity.display_name||''},
      entitlement
    });
  }catch{return json({...empty,entitlement:{tier:'unknown',pro:false,source:'stripe',reason:'identity_store_unavailable'}})}
}
export async function handleLogout(request,env){
  const c=googleConfig(env);
  if(!c.origin||!sameOriginMutation(request,c.origin))return json({error:'invalid_origin'},403);
  return json({ok:true},200,{'set-cookie':clearSessionCookie()});
}
export async function handleAuthStatus(_request,env){
  const c=googleConfig(env),missing=googleConfigMissing(env);
  const schemaReady=await identitySchemaReady(env);
  return json({
    provider:'google',
    scopes:['openid','email','profile'],
    client_id_configured:c.clientIdConfigured,
    client_secret_configured:c.clientSecretConfigured,
    session_secret_configured:c.sessionSecretConfigured,
    identity_store_bound:!!env?.DB?.prepare,
    identity_schema_ready:schemaReady,
    callback_url:c.callbackUrl,
    ready:missing.length===0&&schemaReady,
    missing:[...missing,...(env?.DB?.prepare&&!schemaReady?['DB_SCHEMA']:[])]
  });
}
export async function handleAuthRequest(request,env){
  const url=new URL(request.url);
  if(request.method==='GET'&&url.pathname==='/api/auth/google/start')return handleGoogleStart(request,env);
  if(request.method==='GET'&&url.pathname==='/api/auth/google/callback')return handleGoogleCallback(request,env);
  if(request.method==='GET'&&url.pathname==='/api/auth/session')return handleSession(request,env);
  if(request.method==='GET'&&url.pathname==='/api/auth/status')return handleAuthStatus(request,env);
  if(request.method==='POST'&&url.pathname==='/api/auth/logout')return handleLogout(request,env);
  return json({error:'not_found'},404);
}
