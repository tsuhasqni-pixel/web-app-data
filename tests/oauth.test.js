import {describe,it,expect,beforeAll} from 'vitest';
import {readFileSync} from 'node:fs';
import {b64urlEncode,te} from '../src/auth/crypto.js';
import {GOOGLE_SCOPES,validateGoogleClaims,verifyGoogleIdToken} from '../src/auth/google.js';
import {issueSessionCookie,readOAuthFlow} from '../src/auth/session.js';
import {handleGoogleCallback,handleGoogleStart,handleLogout} from '../src/auth/routes.js';
import {resolveEntitlement} from '../src/auth/store.js';

const CLIENT_ID='175542619333-datashapertest.apps.googleusercontent.com';
const ORIGIN='https://data.example.com';
const SECRET='google-client-secret-test-only';
const SESSION_SECRET='S'.repeat(48);
const dbStub={prepare(){return {bind(){return this},first:async()=>({n:4}),run:async()=>({success:true})}}};
const env={GOOGLE_OAUTH_CLIENT_ID:CLIENT_ID,GOOGLE_OAUTH_CLIENT_SECRET:SECRET,SESSION_SECRET,APP_ORIGIN:ORIGIN,DB:dbStub,DATA_SHAPER_BILLING_ENABLED:'false'};

let keys,jwks;
beforeAll(async()=>{
 keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',keys.publicKey);
 jwk.kid='test-key';jwk.use='sig';jwk.alg='RS256';
 jwks={keys:[jwk]};
});

async function jwt(payload){
 const head=b64urlEncode(JSON.stringify({alg:'RS256',typ:'JWT',kid:'test-key'}));
 const body=b64urlEncode(JSON.stringify(payload));
 const input=head+'.'+body;
 const sig=new Uint8Array(await crypto.subtle.sign({name:'RSASSA-PKCS1-v1_5'},keys.privateKey,te.encode(input)));
 return input+'.'+b64urlEncode(sig);
}
function claims(overrides={}){
 const now=Math.floor(Date.now()/1000);
 return {iss:'https://accounts.google.com',aud:CLIENT_ID,exp:now+600,iat:now-5,nonce:'nonce-ok',sub:'google-sub-123',email:'USER@example.com',email_verified:true,name:'Data User',...overrides};
}
function cookiePair(setCookie){return String(setCookie||'').split(';')[0]}

describe('Google OIDC start',()=>{
 it('uses Authorization Code + PKCE with minimum scopes and fixed callback',async()=>{
   const res=await handleGoogleStart(new Request(ORIGIN+'/api/auth/google/start'),env);
   expect(res.status).toBe(302);
   const u=new URL(res.headers.get('location'));
   expect(u.origin+u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
   expect(u.searchParams.get('response_type')).toBe('code');
   expect(u.searchParams.get('scope')).toBe(GOOGLE_SCOPES);
   expect(u.searchParams.get('redirect_uri')).toBe(ORIGIN+'/api/auth/google/callback');
   expect(u.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{40,}$/);
   expect(u.searchParams.get('nonce')).toMatch(/^[A-Za-z0-9_-]{40,}$/);
   expect(u.searchParams.get('code_challenge_method')).toBe('S256');
   expect(u.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{40,}$/);
   const sc=res.headers.get('set-cookie');
   expect(sc).toContain('HttpOnly');
   expect(sc).toContain('Secure');
   expect(sc).toContain('SameSite=Lax');
 });
 it('fails closed when client secret is missing',async()=>{
   const bad={...env,GOOGLE_OAUTH_CLIENT_SECRET:''};
   const res=await handleGoogleStart(new Request(ORIGIN+'/api/auth/google/start'),bad);
   expect(res.status).toBe(503);
   expect((await res.json()).missing).toContain('GOOGLE_OAUTH_CLIENT_SECRET');
 });
 it('ignores arbitrary return targets and never creates an open redirect',async()=>{
   const res=await handleGoogleStart(new Request(ORIGIN+'/api/auth/google/start?return_to=https://evil.example'),env);
   const u=new URL(res.headers.get('location'));
   expect(u.searchParams.get('redirect_uri')).toBe(ORIGIN+'/api/auth/google/callback');
   expect(res.headers.get('location')).not.toContain('evil.example');
 });
});

describe('ID Token validation',()=>{
 it('accepts a correctly signed Google token',async()=>{
   const token=await jwt(claims());
   const out=await verifyGoogleIdToken(token,{clientId:CLIENT_ID,nonce:'nonce-ok',jwks});
   expect(out).toEqual({sub:'google-sub-123',email:'user@example.com',email_verified:true,name:'Data User'});
 });
 it('rejects nonce mismatch',async()=>{
   await expect(verifyGoogleIdToken(await jwt(claims()),{clientId:CLIENT_ID,nonce:'other',jwks})).rejects.toThrow('invalid_nonce');
 });
 it('rejects invalid issuer',async()=>{
   await expect(verifyGoogleIdToken(await jwt(claims({iss:'https://evil.example'})),{clientId:CLIENT_ID,nonce:'nonce-ok',jwks})).rejects.toThrow('invalid_issuer');
 });
 it('rejects invalid audience',async()=>{
   await expect(verifyGoogleIdToken(await jwt(claims({aud:'other.apps.googleusercontent.com'})),{clientId:CLIENT_ID,nonce:'nonce-ok',jwks})).rejects.toThrow('invalid_audience');
 });
 it('rejects expired token',async()=>{
   const now=Math.floor(Date.now()/1000);
   await expect(verifyGoogleIdToken(await jwt(claims({exp:now-1})),{clientId:CLIENT_ID,nonce:'nonce-ok',jwks,now})).rejects.toThrow('expired_token');
 });
 it('rejects a tampered signature',async()=>{
   const token=await jwt(claims());
   const parts=token.split('.');
   parts[1]=b64urlEncode(JSON.stringify(claims({email:'attacker@example.com'})));
   await expect(verifyGoogleIdToken(parts.join('.'),{clientId:CLIENT_ID,nonce:'nonce-ok',jwks})).rejects.toThrow('invalid_signature');
 });
});

describe('OAuth callback security',()=>{
 async function started(){
   const start=await handleGoogleStart(new Request(ORIGIN+'/api/auth/google/start'),env);
   const auth=new URL(start.headers.get('location'));
   const cookie=cookiePair(start.headers.get('set-cookie'));
   const flow=await readOAuthFlow(new Request(ORIGIN+'/',{headers:{Cookie:cookie}}),SESSION_SECRET);
   return {state:auth.searchParams.get('state'),cookie,flow};
 }
 it('rejects state mismatch before token exchange',async()=>{
   const s=await started();
   const res=await handleGoogleCallback(new Request(ORIGIN+'/api/auth/google/callback?code=secret-code&state=wrong',{headers:{Cookie:s.cookie}}),env,{fetchImpl:async()=>{throw new Error('must not fetch')}});
   expect(res.status).toBe(400);
   expect((await res.json()).error).toBe('invalid_oauth_state');
 });
 it('rejects arbitrary callback host',async()=>{
   const s=await started();
   const res=await handleGoogleCallback(new Request('https://evil.example/api/auth/google/callback?code=x&state='+encodeURIComponent(s.state),{headers:{Cookie:s.cookie}}),env);
   expect(res.status).toBe(400);
   expect((await res.json()).error).toBe('invalid_callback_origin');
 });
 it('handles Google callback error without reflecting provider data',async()=>{
   const res=await handleGoogleCallback(new Request(ORIGIN+'/api/auth/google/callback?error=access_denied&error_description=SECRET'),env);
   expect(res.status).toBe(302);
   expect(res.headers.get('location')).toBe(ORIGIN+'/?auth=google_error');
   expect(res.headers.get('location')).not.toContain('SECRET');
 });
 it('does not issue a session when token nonce is wrong',async()=>{
   const s=await started();
   const token=await jwt(claims({nonce:'wrong-nonce'}));
   const res=await handleGoogleCallback(new Request(ORIGIN+'/api/auth/google/callback?code=opaque-code&state='+encodeURIComponent(s.state),{headers:{Cookie:s.cookie}}),env,{
     jwks,
     fetchImpl:async()=>new Response(JSON.stringify({id_token:token}),{status:200,headers:{'content-type':'application/json'}}),
     findOrCreateUser:async()=>{throw new Error('must not reach identity store')}
   });
   expect(res.status).toBe(302);
   expect(res.headers.get('location')).toBe(ORIGIN+'/?auth=google_failed');
   expect(res.headers.get('set-cookie')||'').not.toContain('ds_session=');
 });
 it('issues only the Data Shaper session after successful callback',async()=>{
   const s=await started();
   const token=await jwt(claims({nonce:s.flow.nonce}));
   const res=await handleGoogleCallback(new Request(ORIGIN+'/api/auth/google/callback?code=opaque-code&state='+encodeURIComponent(s.state),{headers:{Cookie:s.cookie}}),env,{
     jwks,
     fetchImpl:async()=>new Response(JSON.stringify({id_token:token,access_token:'must-not-persist',refresh_token:'must-not-persist'}),{status:200,headers:{'content-type':'application/json'}}),
     findOrCreateUser:async(_env,identity)=>{
       expect(identity.sub).toBe('google-sub-123');
       return 'usr_12345678-1234-1234-1234-123456789abc';
     }
   });
   expect(res.status).toBe(302);
   expect(res.headers.get('location')).toBe(ORIGIN+'/?auth=google_success');
   const setCookie=res.headers.get('set-cookie')||'';
   expect(setCookie).toContain('ds_session=');
   expect(setCookie).toContain('HttpOnly');
   expect(setCookie).toContain('Secure');
   expect(setCookie).not.toContain('access_token');
   expect(setCookie).not.toContain('refresh_token');
   expect(setCookie).not.toContain('google-sub-123');
 });
});

describe('session, logout, and entitlement boundary',()=>{
 it('session cookie has required browser protections',async()=>{
   const sc=await issueSessionCookie('usr_12345678-1234-1234-1234-123456789abc',SESSION_SECRET);
   expect(sc).toContain('HttpOnly');
   expect(sc).toContain('Secure');
   expect(sc).toContain('SameSite=Lax');
   expect(sc).toContain('Path=/');
   expect(sc).toMatch(/Max-Age=\d+/);
 });
 it('logout requires same-origin POST and clears the session',async()=>{
   const bad=await handleLogout(new Request(ORIGIN+'/api/auth/logout',{method:'POST',headers:{Origin:'https://evil.example'}}),env);
   expect(bad.status).toBe(403);
   const ok=await handleLogout(new Request(ORIGIN+'/api/auth/logout',{method:'POST',headers:{Origin:ORIGIN}}),env);
   expect(ok.status).toBe(200);
   const sc=ok.headers.get('set-cookie');
   expect(sc).toContain('ds_session=');
   expect(sc).toContain('Max-Age=0');
   expect(sc).toContain('Secure');
 });
 it('Google identity never grants Pro while Stripe billing is disabled',async()=>{
   const entitlement=await resolveEntitlement({DATA_SHAPER_BILLING_ENABLED:'false'},'usr_12345678-1234-1234-1234-123456789abc');
   expect(entitlement.pro).toBe(false);
   expect(entitlement.source).toBe('stripe');
   expect(entitlement.reason).toBe('billing_disabled');
 });
 it('Pro query is keyed by internal user_id and Data Shaper product, not email',()=>{
   const src=readFileSync(new URL('../src/auth/store.js',import.meta.url),'utf8');
   const segment=src.slice(src.indexOf('export async function resolveEntitlement'));
   expect(segment).toContain("user_id=?");
   expect(segment).toContain("product_key='data-shaper-pro'");
   expect(segment).not.toContain('email=?');
 });
});

describe('secret and token non-exposure',()=>{
 it('does not log OAuth codes or tokens in auth routes',()=>{
   const src=readFileSync(new URL('../src/auth/routes.js',import.meta.url),'utf8');
   expect(src).not.toContain('console.');
   expect(src).not.toContain('console.log');
 });
 it('does not put server secrets in the browser entry bundle source',()=>{
   const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
   expect(main).not.toContain('GOOGLE_OAUTH_CLIENT_SECRET');
   expect(main).not.toContain('STRIPE_TEST_SECRET_KEY');
   expect(main).not.toContain('SESSION_SECRET');
   expect(main).not.toContain('id_token');
   expect(main).not.toContain('access_token');
   expect(main).not.toContain('refresh_token');
 });
 it('requested Google scopes stay minimal',()=>{
   expect(GOOGLE_SCOPES).toBe('openid email profile');
   expect(GOOGLE_SCOPES).not.toMatch(/gmail|drive|calendar/i);
 });
 it('claim validator does not accept an unverified email',()=>{
   expect(()=>validateGoogleClaims(claims({email_verified:false}),{clientId:CLIENT_ID,nonce:'nonce-ok'})).toThrow('email_not_verified');
 });
});
