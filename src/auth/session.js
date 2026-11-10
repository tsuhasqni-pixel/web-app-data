import {nowSeconds,signCompactJson,verifyCompactJson} from './crypto.js';

export const SESSION_COOKIE='ds_session';
export const OAUTH_FLOW_COOKIE='ds_google_oauth';
export const SESSION_MAX_AGE=7*24*60*60;
export const OAUTH_FLOW_MAX_AGE=10*60;

function readCookie(request,name){
  const raw=request?.headers?.get('Cookie')||'';
  for(const part of raw.split(';')){
    const i=part.indexOf('=');
    if(i<0)continue;
    if(part.slice(0,i).trim()===name)return part.slice(i+1).trim();
  }
  return '';
}
function cookie(name,value,{maxAge,path='/'}={}){
  const age=Number.isInteger(maxAge)?`; Max-Age=${maxAge}`:'';
  return `${name}=${value}; Path=${path}${age}; HttpOnly; Secure; SameSite=Lax`;
}
export async function issueSessionCookie(userId,secret,now=nowSeconds()){
  const token=await signCompactJson({v:1,user_id:userId,iat:now,exp:now+SESSION_MAX_AGE},secret);
  return cookie(SESSION_COOKIE,token,{maxAge:SESSION_MAX_AGE,path:'/'});
}
export async function readSession(request,secret,now=nowSeconds()){
  if(typeof secret!=='string'||secret.length<32)return null;
  const data=await verifyCompactJson(readCookie(request,SESSION_COOKIE),secret);
  if(!data||data.v!==1||typeof data.user_id!=='string'||!/^usr_[0-9a-f-]{36}$/i.test(data.user_id))return null;
  if(!Number.isInteger(data.iat)||!Number.isInteger(data.exp)||data.iat>now+60||data.exp<=now)return null;
  return data;
}
export function clearSessionCookie(){return cookie(SESSION_COOKIE,'',{maxAge:0,path:'/'});}
export async function issueOAuthFlowCookie(flow,secret,now=nowSeconds()){
  const token=await signCompactJson({v:1,...flow,iat:now,exp:now+OAUTH_FLOW_MAX_AGE},secret);
  return cookie(OAUTH_FLOW_COOKIE,token,{maxAge:OAUTH_FLOW_MAX_AGE,path:'/api/auth/google/'});
}
export async function readOAuthFlow(request,secret,now=nowSeconds()){
  if(typeof secret!=='string'||secret.length<32)return null;
  const data=await verifyCompactJson(readCookie(request,OAUTH_FLOW_COOKIE),secret);
  if(!data||data.v!==1||typeof data.state!=='string'||typeof data.nonce!=='string'||typeof data.code_verifier!=='string')return null;
  if(!Number.isInteger(data.iat)||!Number.isInteger(data.exp)||data.iat>now+60||data.exp<=now)return null;
  return data;
}
export function clearOAuthFlowCookie(){return cookie(OAUTH_FLOW_COOKIE,'',{maxAge:0,path:'/api/auth/google/'});}
