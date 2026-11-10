import {b64urlDecode,decodeJsonB64url,randomToken,safeEqual,sha256B64url,te} from './crypto.js';

export const GOOGLE_AUTHORIZE_URL='https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL='https://oauth2.googleapis.com/token';
export const GOOGLE_JWKS_URL='https://www.googleapis.com/oauth2/v3/certs';
export const GOOGLE_SCOPES='openid email profile';

let jwksCache={expires:0,value:null};

function clean(value){return typeof value==='string'?value.trim():''}
export function configuredOAuthOrigin(env={}){
  const raw=clean(env.APP_ORIGIN);
  if(!raw)return null;
  try{
    const u=new URL(raw);
    const local=u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname);
    if(!(u.protocol==='https:'||local)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)return null;
    if(raw!==u.origin)return null;
    return u.origin;
  }catch{return null}
}
export function googleConfig(env={}){
  const clientId=clean(env.GOOGLE_OAUTH_CLIENT_ID);
  const clientSecret=clean(env.GOOGLE_OAUTH_CLIENT_SECRET);
  const sessionSecret=clean(env.SESSION_SECRET);
  const origin=configuredOAuthOrigin(env);
  return {
    clientId,
    clientSecret,
    sessionSecret,
    origin,
    callbackUrl:origin?`${origin}/api/auth/google/callback`:null,
    clientIdConfigured:/^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId),
    clientSecretConfigured:clientSecret.length>=16,
    sessionSecretConfigured:sessionSecret.length>=32
  };
}
export function googleConfigMissing(env={}){
  const c=googleConfig(env),missing=[];
  if(!c.clientIdConfigured)missing.push('GOOGLE_OAUTH_CLIENT_ID');
  if(!c.clientSecretConfigured)missing.push('GOOGLE_OAUTH_CLIENT_SECRET');
  if(!c.sessionSecretConfigured)missing.push('SESSION_SECRET');
  if(!c.origin)missing.push('APP_ORIGIN');
  if(!env.DB?.prepare)missing.push('DB');
  return missing;
}
export async function buildGoogleAuthorization(env={}){
  const c=googleConfig(env);
  if(googleConfigMissing(env).length)throw new Error('google_oauth_not_configured');
  const state=randomToken(32),nonce=randomToken(32),codeVerifier=randomToken(48);
  const codeChallenge=await sha256B64url(codeVerifier);
  const url=new URL(GOOGLE_AUTHORIZE_URL);
  url.searchParams.set('client_id',c.clientId);
  url.searchParams.set('redirect_uri',c.callbackUrl);
  url.searchParams.set('response_type','code');
  url.searchParams.set('scope',GOOGLE_SCOPES);
  url.searchParams.set('state',state);
  url.searchParams.set('nonce',nonce);
  url.searchParams.set('code_challenge',codeChallenge);
  url.searchParams.set('code_challenge_method','S256');
  url.searchParams.set('include_granted_scopes','false');
  return {url:url.toString(),flow:{state,nonce,code_verifier:codeVerifier}};
}
export async function exchangeAuthorizationCode(code,flow,env={},fetchImpl=fetch){
  const c=googleConfig(env);
  const body=new URLSearchParams({
    code:String(code),
    client_id:c.clientId,
    client_secret:c.clientSecret,
    redirect_uri:c.callbackUrl,
    grant_type:'authorization_code',
    code_verifier:flow.code_verifier
  });
  const res=await fetchImpl(GOOGLE_TOKEN_URL,{
    method:'POST',
    headers:{'content-type':'application/x-www-form-urlencoded','accept':'application/json'},
    body
  });
  let data={};
  try{data=await res.json()}catch{}
  if(!res.ok||typeof data.id_token!=='string')throw new Error('google_token_exchange_failed');
  return {idToken:data.id_token};
}
export function validateGoogleClaims(payload,{clientId,nonce,now=Math.floor(Date.now()/1000)}){
  if(!payload||typeof payload!=='object')throw new Error('invalid_claims');
  if(!['https://accounts.google.com','accounts.google.com'].includes(payload.iss))throw new Error('invalid_issuer');
  const audiences=Array.isArray(payload.aud)?payload.aud:[payload.aud];
  if(!audiences.includes(clientId))throw new Error('invalid_audience');
  if(audiences.length>1&&payload.azp!==clientId)throw new Error('invalid_authorized_party');
  if(!Number.isInteger(payload.exp)||payload.exp<=now)throw new Error('expired_token');
  if(Number.isInteger(payload.nbf)&&payload.nbf>now+60)throw new Error('token_not_yet_valid');
  if(Number.isInteger(payload.iat)&&payload.iat>now+60)throw new Error('invalid_issued_at');
  if(typeof payload.nonce!=='string'||!safeEqual(payload.nonce,nonce))throw new Error('invalid_nonce');
  if(typeof payload.sub!=='string'||payload.sub.length<3||payload.sub.length>255)throw new Error('invalid_subject');
  if(typeof payload.email!=='string'||payload.email.length>254)throw new Error('invalid_email');
  if(payload.email_verified!==true)throw new Error('email_not_verified');
  const name=typeof payload.name==='string'?payload.name.slice(0,200):'';
  return {sub:payload.sub,email:payload.email.toLowerCase(),email_verified:true,name};
}
async function loadGoogleJwks(fetchImpl=fetch){
  const now=Date.now();
  if(jwksCache.value&&jwksCache.expires>now)return jwksCache.value;
  const res=await fetchImpl(GOOGLE_JWKS_URL,{headers:{accept:'application/json'}});
  const data=await res.json();
  if(!res.ok||!Array.isArray(data.keys))throw new Error('google_jwks_unavailable');
  jwksCache={value:data,expires:now+30*60*1000};
  return data;
}
export async function verifyGoogleIdToken(idToken,{clientId,nonce,now=Math.floor(Date.now()/1000),jwks=null,fetchImpl=fetch}){
  try{
    const parts=String(idToken||'').split('.');
    if(parts.length!==3)throw new Error('invalid_jwt');
    const header=decodeJsonB64url(parts[0]),payload=decodeJsonB64url(parts[1]);
    if(header.alg!=='RS256'||typeof header.kid!=='string'||!header.kid)throw new Error('invalid_jwt_header');
    const keys=(jwks||await loadGoogleJwks(fetchImpl)).keys||[];
    const jwk=keys.find(k=>k.kid===header.kid&&k.kty==='RSA');
    if(!jwk)throw new Error('signing_key_not_found');
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    const ok=await crypto.subtle.verify({name:'RSASSA-PKCS1-v1_5'},key,b64urlDecode(parts[2]),te.encode(parts[0]+'.'+parts[1]));
    if(!ok)throw new Error('invalid_signature');
    return validateGoogleClaims(payload,{clientId,nonce,now});
  }catch(err){
    if(err instanceof Error)throw err;
    throw new Error('invalid_id_token');
  }
}
