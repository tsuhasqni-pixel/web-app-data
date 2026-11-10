import {describe,it,expect} from 'vitest';
import {billingConfig,billingMissing,createCheckoutSession,verifyStripeWebhook} from '../src/billing/stripe.js';
import {subscriptionMatchesDataShaper} from '../src/billing/routes.js';

const ORIGIN='https://data.example.com';
const USER_ID='usr_12345678-1234-1234-1234-123456789abc';
const WEBHOOK_SECRET='whsec_testsecret123';
const baseEnv={
  DATA_SHAPER_BILLING_ENABLED:'true',
  STRIPE_TEST_SECRET_KEY:'rk_test_example123',
  DATA_SHAPER_STRIPE_TEST_PRICE_ID:'price_test123',
  DATA_SHAPER_STRIPE_WEBHOOK_SECRET:WEBHOOK_SECRET,
  APP_ORIGIN:ORIGIN,
  DB:{prepare(){}}
};

async function webhookSignature(raw,timestamp,secret=WEBHOOK_SECRET){
  const enc=new TextEncoder();
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sig=new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(timestamp+'.'+raw)));
  const hex=[...sig].map(x=>x.toString(16).padStart(2,'0')).join('');
  return 't='+timestamp+',v1='+hex;
}

describe('Data Shaper Stripe test configuration',()=>{
  it('is test-only and stays disabled unless explicitly enabled',()=>{
    const c=billingConfig({...baseEnv,DATA_SHAPER_BILLING_ENABLED:'false'});
    expect(c.enabled).toBe(false);
    expect(c.secretConfigured).toBe(true);
    expect(c.priceConfigured).toBe(true);
    expect(c.webhookConfigured).toBe(true);
  });
  it('rejects live Stripe secret in the test scaffold',()=>{
    const bad={...baseEnv,STRIPE_TEST_SECRET_KEY:'sk_live_must_not_be_used'};
    expect(billingMissing(bad)).toContain('STRIPE_TEST_SECRET_KEY');
  });
  it('reports each missing connection without exposing values',()=>{
    const missing=billingMissing({APP_ORIGIN:ORIGIN});
    expect(missing).toEqual(expect.arrayContaining([
      'STRIPE_TEST_SECRET_KEY','DATA_SHAPER_STRIPE_TEST_PRICE_ID','DATA_SHAPER_STRIPE_WEBHOOK_SECRET','DB'
    ]));
  });
});

describe('Stripe Checkout construction',()=>{
  it('passes only internal user identity and Data Shaper product key',async()=>{
    let called;
    const out=await createCheckoutSession({
      env:baseEnv,userId:USER_ID,email:'user@example.com',customerId:'',
      fetchImpl:async(url,init)=>{
        called={url,init,body:new URLSearchParams(init.body)};
        return new Response(JSON.stringify({id:'cs_test_123',url:'https://checkout.stripe.com/c/pay/test'}),{status:200,headers:{'content-type':'application/json'}});
      }
    });
    expect(out.id).toBe('cs_test_123');
    expect(called.url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(called.init.headers.authorization).toBe('Bearer '+baseEnv.STRIPE_TEST_SECRET_KEY);
    expect(called.body.get('mode')).toBe('subscription');
    expect(called.body.get('line_items[0][price]')).toBe(baseEnv.DATA_SHAPER_STRIPE_TEST_PRICE_ID);
    expect(called.body.get('client_reference_id')).toBe(USER_ID);
    expect(called.body.get('metadata[data_shaper_user_id]')).toBe(USER_ID);
    expect(called.body.get('metadata[product_key]')).toBe('data-shaper-pro');
    expect(called.body.get('subscription_data[metadata][data_shaper_user_id]')).toBe(USER_ID);
    expect(called.body.get('customer_email')).toBe('user@example.com');
    expect(called.body.toString()).not.toContain('google');
  });
  it('fails closed while billing is disabled',async()=>{
    await expect(createCheckoutSession({
      env:{...baseEnv,DATA_SHAPER_BILLING_ENABLED:'false'},
      userId:USER_ID,email:'user@example.com'
    })).rejects.toThrow('billing_disabled');
  });
});

describe('Stripe webhook verification',()=>{
  it('accepts a valid v1 signature inside tolerance',async()=>{
    const now=1700000000,raw=JSON.stringify({id:'evt_test',type:'checkout.session.completed'});
    const header=await webhookSignature(raw,now);
    await expect(verifyStripeWebhook(raw,header,WEBHOOK_SECRET,{now})).resolves.toBe(true);
  });
  it('rejects tampered payload and stale timestamps',async()=>{
    const now=1700000000,raw=JSON.stringify({id:'evt_test'});
    const header=await webhookSignature(raw,now);
    await expect(verifyStripeWebhook(raw+'x',header,WEBHOOK_SECRET,{now})).resolves.toBe(false);
    await expect(verifyStripeWebhook(raw,header,WEBHOOK_SECRET,{now:now+301})).resolves.toBe(false);
  });
});

describe('Data Shaper webhook entitlement boundary',()=>{
  it('accepts only the configured Data Shaper price and product key',()=>{
    const matching={
      metadata:{product_key:'data-shaper-pro'},
      items:{data:[{price:{id:baseEnv.DATA_SHAPER_STRIPE_TEST_PRICE_ID}}]}
    };
    expect(subscriptionMatchesDataShaper(baseEnv,matching)).toBe(true);
    expect(subscriptionMatchesDataShaper(baseEnv,{...matching,metadata:{product_key:'other-product'}})).toBe(false);
    expect(subscriptionMatchesDataShaper(baseEnv,{
      metadata:{product_key:'data-shaper-pro'},
      items:{data:[{price:{id:'price_other'}}]}
    })).toBe(false);
  });
});
