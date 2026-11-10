const te=new TextEncoder();
const td=new TextDecoder();

export function b64urlEncode(value){
  const bytes=value instanceof Uint8Array?value:te.encode(String(value));
  let binary='';
  for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function b64urlDecode(value){
  const s=String(value||'').replace(/-/g,'+').replace(/_/g,'/');
  const padded=s+'='.repeat((4-s.length%4)%4);
  const binary=atob(padded);
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
export function decodeJsonB64url(value){
  return JSON.parse(td.decode(b64urlDecode(value)));
}
export function randomToken(bytes=32){
  const out=new Uint8Array(bytes);
  crypto.getRandomValues(out);
  return b64urlEncode(out);
}
export async function sha256B64url(value){
  const digest=await crypto.subtle.digest('SHA-256',te.encode(String(value)));
  return b64urlEncode(new Uint8Array(digest));
}
export function safeEqual(a,b){
  const x=String(a||''),y=String(b||'');
  if(x.length!==y.length)return false;
  let diff=0;
  for(let i=0;i<x.length;i++)diff|=x.charCodeAt(i)^y.charCodeAt(i);
  return diff===0;
}
async function hmacBytes(message,secret){
  const key=await crypto.subtle.importKey('raw',te.encode(String(secret)),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',key,te.encode(String(message))));
}
export async function signCompactJson(payload,secret){
  const body=b64urlEncode(JSON.stringify(payload));
  const sig=b64urlEncode(await hmacBytes(body,secret));
  return body+'.'+sig;
}
export async function verifyCompactJson(token,secret){
  try{
    const [body,sig,extra]=String(token||'').split('.');
    if(!body||!sig||extra!==undefined)return null;
    const expected=b64urlEncode(await hmacBytes(body,secret));
    if(!safeEqual(sig,expected))return null;
    return decodeJsonB64url(body);
  }catch{return null}
}
export function nowSeconds(){return Math.floor(Date.now()/1000)}
export {te};
