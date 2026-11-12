import {describe,it,expect} from 'vitest';
import {billingConfig,billingMissing,billingMode,createCheckoutSession,verifyStripeWebhook,validateTierPriceObject,stripeSecretIssue} from '../src/billing/stripe.js';
import {subscriptionMatchesDataShaper,handleCheckout,handleWebhook} from '../src/billing/routes.js';

const ORIGIN='https://data.example.com';
const USER_ID='usr_12345678-1234-1234-1234-123456789abc';
const WEBHOOK_SECRET='whsec_testsecret123';
const baseEnv={
  DATA_SHAPER_BILLING_ENABLED:'true',
  STRIPE_TEST_SECRET_KEY:'rk_test_example123',
  DATA_SHAPER_STRIPE_TEST_PRICE_ID:'price_test123',
  DATA_SHAPER_STRIPE_TEST_LITE_PRICE_ID:'price_lite123',
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
    expect(c.proPriceConfigured).toBe(true);
    expect(c.litePriceConfigured).toBe(true);
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
  it('builds Lite checkout with the Lite price and entitlement key',async()=>{
    let called;
    const out=await createCheckoutSession({
      env:baseEnv,userId:USER_ID,email:'user@example.com',customerId:'',tier:'lite',
      fetchImpl:async(url,init)=>{
        called={url,body:new URLSearchParams(init.body)};
        return new Response(JSON.stringify({id:'cs_test_lite',url:'https://checkout.stripe.com/c/pay/lite'}),{status:200,headers:{'content-type':'application/json'}});
      }
    });
    expect(out.tier).toBe('lite');
    expect(called.body.get('line_items[0][price]')).toBe(baseEnv.DATA_SHAPER_STRIPE_TEST_LITE_PRICE_ID);
    expect(called.body.get('metadata[product_key]')).toBe('data-shaper-lite');
    expect(called.body.get('subscription_data[metadata][product_key]')).toBe('data-shaper-lite');
  });
  it('fails closed for Lite while the Lite price is not configured',async()=>{
    await expect(createCheckoutSession({
      env:{...baseEnv,DATA_SHAPER_STRIPE_TEST_LITE_PRICE_ID:''},
      userId:USER_ID,email:'user@example.com',tier:'lite'
    })).rejects.toThrow('DATA_SHAPER_STRIPE_TEST_LITE_PRICE_ID');
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
    expect(subscriptionMatchesDataShaper(baseEnv,{
      metadata:{product_key:'data-shaper-lite'},
      items:{data:[{price:{id:baseEnv.DATA_SHAPER_STRIPE_TEST_LITE_PRICE_ID}}]}
    })).toBe(true);
    expect(subscriptionMatchesDataShaper(baseEnv,{
      metadata:{product_key:'data-shaper-lite'},
      items:{data:[{price:{id:baseEnv.DATA_SHAPER_STRIPE_TEST_PRICE_ID}}]}
    })).toBe(false);
  });
});


describe('Data Shaper LIVE sale gates',()=>{
  const liveEnv={
    DATA_SHAPER_BILLING_ENABLED:'true',
    DATA_SHAPER_LIVE_BILLING_ENABLED:'true',
    STRIPE_LIVE_SECRET_KEY:'rk_live_example123',
    DATA_SHAPER_STRIPE_LIVE_PRO_PRICE_ID:'price_livepro123',
    DATA_SHAPER_STRIPE_LIVE_LITE_PRICE_ID:'price_livelite123',
    DATA_SHAPER_STRIPE_LIVE_WEBHOOK_SECRET:'whsec_liveexample123',
    DATA_SHAPER_STRIPE_LIVE_PORTAL_CONFIG_ID:'bpc_liveexample123',
    DATA_SHAPER_TAX_DISPLAY_CONFIRMED:'true',
    DATA_SHAPER_REFUND_POLICY_CONFIRMED:'true',
    DATA_SHAPER_LIVE_SALE_APPROVED:'true',
    APP_ORIGIN:ORIGIN,
    DB:{prepare(){}}
  };
  it('keeps TEST and LIVE configuration strictly separate',()=>{
    expect(billingMode(baseEnv)).toBe('test');
    expect(billingMode(liveEnv)).toBe('live');
    expect(billingMissing({...liveEnv,STRIPE_LIVE_SECRET_KEY:'sk_test_wrong'},'pro')).toContain('STRIPE_LIVE_SECRET_KEY');
    expect(billingMissing({...liveEnv,DATA_SHAPER_LIVE_SALE_APPROVED:'false'},'pro')).toContain('DATA_SHAPER_LIVE_SALE_APPROVED');
  });
  it('accepts safe legacy live secret aliases but still rejects TEST keys in LIVE mode',()=>{
    const aliasEnv={...liveEnv};
    delete aliasEnv.STRIPE_LIVE_SECRET_KEY;
    delete aliasEnv.DATA_SHAPER_STRIPE_LIVE_WEBHOOK_SECRET;
    aliasEnv.STRIPE_SECRET_KEY='rk_live_legacy123';
    aliasEnv.STRIPE_WEBHOOK_SECRET='whsec_legacy123';
    const cfg=billingConfig(aliasEnv);
    expect(cfg.secretConfigured).toBe(true);
    expect(cfg.secretSource).toBe('STRIPE_SECRET_KEY');
    expect(cfg.webhookConfigured).toBe(true);
    expect(cfg.webhookSource).toBe('STRIPE_WEBHOOK_SECRET');
    expect(billingMissing(aliasEnv,'pro')).not.toContain('STRIPE_LIVE_SECRET_KEY');
    expect(billingMissing(aliasEnv,'pro')).not.toContain('DATA_SHAPER_STRIPE_LIVE_WEBHOOK_SECRET');
    aliasEnv.STRIPE_SECRET_KEY='sk_test_not_allowed';
    expect(billingConfig(aliasEnv).secretConfigured).toBe(false);
  });
  it('skips an invalid canonical live key when a valid legacy live key also exists',()=>{
    const duplicated={...liveEnv,
      STRIPE_LIVE_SECRET_KEY:'not-a-live-secret',
      STRIPE_SECRET_KEY:'sk_live_validfallback123'
    };
    const cfg=billingConfig(duplicated);
    expect(cfg.secretConfigured).toBe(true);
    expect(cfg.secretSource).toBe('STRIPE_SECRET_KEY');
    expect(cfg.secretIssue).toBe(null);
    expect(billingMissing(duplicated,'pro')).not.toContain('STRIPE_LIVE_SECRET_KEY');
  });
  it('classifies live Stripe secret mistakes without exposing the value',()=>{
    expect(stripeSecretIssue('',{live:true})).toBe('missing');
    expect(stripeSecretIssue('pk_live_public123',{live:true})).toBe('publishable_key_not_secret');
    expect(stripeSecretIssue('sk_test_wrong123',{live:true})).toBe('test_key_in_live');
    expect(stripeSecretIssue('whsec_wrongplace',{live:true})).toBe('webhook_secret_not_api_key');
    expect(stripeSecretIssue('price_wrongplace',{live:true})).toBe('price_id_not_api_key');
    expect(stripeSecretIssue('STRIPE_LIVE_SECRET_KEY=sk_live_abc123',{live:true})).toBe('pasted_assignment');
    expect(stripeSecretIssue('sk_live_abc-123',{live:true})).toBe(null);
    expect(stripeSecretIssue('managed_live_candidate_123',{live:true})).toBe('unrecognized_format_verify_with_stripe');
  });
  it('allows an unknown backend credential format only to reach Stripe verification',()=>{
    const candidate={...liveEnv,STRIPE_LIVE_SECRET_KEY:'managed_live_candidate_123'};
    const cfg=billingConfig(candidate);
    expect(cfg.secretConfigured).toBe(true);
    expect(cfg.secretIssue).toBe('unrecognized_format_verify_with_stripe');
    expect(billingMissing(candidate,'pro')).not.toContain('STRIPE_LIVE_SECRET_KEY');
  });
  it('validates exact JPY monthly prices and Data Shaper product metadata',()=>{
    const good={livemode:true,active:true,currency:'jpy',unit_amount:980,recurring:{interval:'month',interval_count:1},product:{active:true,metadata:{app:'data-shaper',tier:'pro'}}};
    expect(validateTierPriceObject(good,{tier:'pro',livemode:true}).ok).toBe(true);
    expect(validateTierPriceObject({...good,unit_amount:981},{tier:'pro',livemode:true}).reason).toBe('amount');
    expect(validateTierPriceObject({...good,product:{active:true,metadata:{app:'other',tier:'pro'}}},{tier:'pro',livemode:true}).reason).toBe('product_metadata');
    expect(validateTierPriceObject({...good,unit_amount:480,product:{active:true,metadata:{app:'data-shaper',tier:'lite'}}},{tier:'lite',livemode:true}).ok).toBe(true);
  });
  it('re-verifies the live Stripe Price before creating Checkout',async()=>{
    const calls=[];
    const goodPrice={livemode:true,active:true,currency:'jpy',unit_amount:980,recurring:{interval:'month',interval_count:1},product:{active:true,metadata:{app:'data-shaper',tier:'pro'}}};
    const out=await createCheckoutSession({
      env:liveEnv,userId:USER_ID,email:'user@example.com',tier:'pro',legalVersion:'2026-11-12',acceptedAt:1700000000,
      fetchImpl:async(url,init)=>{
        calls.push({url,init});
        if(init.method==='GET')return new Response(JSON.stringify(goodPrice),{status:200,headers:{'content-type':'application/json'}});
        return new Response(JSON.stringify({id:'cs_live_123',url:'https://checkout.stripe.com/c/pay/live'}),{status:200,headers:{'content-type':'application/json'}});
      }
    });
    expect(out.mode).toBe('live');
    expect(calls[0].url).toContain('/prices/price_livepro123');
    const body=new URLSearchParams(calls[1].init.body);
    expect(calls[1].init.headers.authorization).toBe('Bearer rk_live_example123');
    expect(body.get('line_items[0][price]')).toBe('price_livepro123');
    expect(body.get('metadata[legal_version]')).toBe('2026-11-12');
    expect(body.get('metadata[legal_accepted_at]')).toBe('1700000000');
  });
});

describe('Commercial request hardening',()=>{
  it('refuses Checkout before explicit legal consent',async()=>{
    const req=new Request(ORIGIN+'/api/billing/checkout',{
      method:'POST',
      headers:{Origin:ORIGIN,'content-type':'application/json'},
      body:JSON.stringify({tier:'pro'})
    });
    const res=await handleCheckout(req,baseEnv);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('legal_consent_required');
  });
  it('rejects a signed webhook whose livemode does not match the active billing mode',async()=>{
    const raw=JSON.stringify({id:'evt_live_wrong',type:'payment_intent.succeeded',livemode:true,created:1700000000,data:{object:{}}});
    const sig=await webhookSignature(raw,1700000000);
    const req=new Request(ORIGIN+'/api/billing/webhook',{method:'POST',headers:{'Stripe-Signature':sig},body:raw});
    const res=await handleWebhook(req,baseEnv,{now:1700000000});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_stripe_event');
  });
  it('acknowledges a duplicate Stripe event only once',async()=>{
    const events=new Map();
    const db={
      prepare(sql){
        return {
          args:[],
          bind(...args){this.args=args;return this},
          async first(){
            if(sql.startsWith('SELECT processed_at FROM stripe_webhook_events'))return events.get(this.args[0])||null;
            return null;
          },
          async run(){
            if(sql.startsWith('INSERT OR IGNORE INTO stripe_webhook_events')){
              if(!events.has(this.args[0]))events.set(this.args[0],{processed_at:null});
            }else if(sql.startsWith('UPDATE stripe_webhook_events SET processed_at=')){
              const row=events.get(this.args[0]);if(row)row.processed_at='now';
            }else if(sql.startsWith('UPDATE stripe_webhook_events SET last_error=')){
              const row=events.get(this.args[1]);if(row)row.last_error=this.args[0];
            }
            return {success:true};
          }
        };
      }
    };
    const env={...baseEnv,DB:db};
    const raw=JSON.stringify({id:'evt_test_duplicate',type:'payment_intent.succeeded',livemode:false,created:1700000000,data:{object:{}}});
    const sig=await webhookSignature(raw,1700000000);
    const make=()=>new Request(ORIGIN+'/api/billing/webhook',{method:'POST',headers:{'Stripe-Signature':sig},body:raw});
    const first=await handleWebhook(make(),env,{now:1700000000});
    const second=await handleWebhook(make(),env,{now:1700000000});
    expect((await first.json()).duplicate).toBe(false);
    expect((await second.json()).duplicate).toBe(true);
  });
});
