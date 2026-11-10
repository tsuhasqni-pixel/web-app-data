function isoNow(){return new Date().toISOString()}
function requireDb(env){
  if(!env?.DB?.prepare)throw new Error('identity_store_not_configured');
  return env.DB;
}
export async function identitySchemaReady(env){
  if(!env?.DB?.prepare)return false;
  try{
    const row=await env.DB.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('users','oauth_identities','stripe_customer_links','stripe_entitlements')").first();
    return Number(row?.n)===4;
  }catch{return false}
}
export async function findOrCreateGoogleUser(env,claims){
  const db=requireDb(env);
  const existing=await db.prepare("SELECT user_id FROM oauth_identities WHERE provider='google' AND provider_subject=?").bind(claims.sub).first();
  const now=isoNow();
  if(existing?.user_id){
    await db.prepare("UPDATE oauth_identities SET email=?,email_verified=?,display_name=?,updated_at=? WHERE provider='google' AND provider_subject=?")
      .bind(claims.email,claims.email_verified?1:0,claims.name||null,now,claims.sub).run();
    return existing.user_id;
  }
  const userId='usr_'+crypto.randomUUID();
  const userStmt=db.prepare('INSERT INTO users (id,created_at) VALUES (?,?)').bind(userId,now);
  const identityStmt=db.prepare("INSERT INTO oauth_identities (provider,provider_subject,user_id,email,email_verified,display_name,created_at,updated_at) VALUES ('google',?,?,?,?,?,?,?)")
    .bind(claims.sub,userId,claims.email,claims.email_verified?1:0,claims.name||null,now,now);
  try{
    if(typeof db.batch==='function')await db.batch([userStmt,identityStmt]);
    else{await userStmt.run();await identityStmt.run();}
    return userId;
  }catch{
    const raced=await db.prepare("SELECT user_id FROM oauth_identities WHERE provider='google' AND provider_subject=?").bind(claims.sub).first();
    if(raced?.user_id)return raced.user_id;
    throw new Error('identity_store_write_failed');
  }
}
export async function getUserIdentity(env,userId){
  const db=requireDb(env);
  return db.prepare("SELECT u.id AS user_id,i.email,i.email_verified,i.display_name FROM users u JOIN oauth_identities i ON i.user_id=u.id AND i.provider='google' WHERE u.id=?")
    .bind(userId).first();
}
export async function resolveEntitlement(env,userId){
  if(env?.DATA_SHAPER_BILLING_ENABLED!=='true'){
    return {tier:'free',pro:false,source:'stripe',reason:'billing_disabled'};
  }
  if(!env?.DB?.prepare)return {tier:'unknown',pro:false,source:'stripe',reason:'identity_store_unavailable'};
  try{
    const row=await env.DB.prepare("SELECT status FROM stripe_entitlements WHERE user_id=? AND product_key='data-shaper-pro' AND status IN ('active','trialing') ORDER BY updated_at DESC LIMIT 1").bind(userId).first();
    if(row?.status)return {tier:'pro',pro:true,source:'stripe',reason:'active_subscription'};
    return {tier:'free',pro:false,source:'stripe',reason:'no_active_subscription'};
  }catch{
    return {tier:'unknown',pro:false,source:'stripe',reason:'entitlement_store_unavailable'};
  }
}

export async function getStripeCustomerLink(env,userId){
  const db=requireDb(env);
  return db.prepare('SELECT user_id,stripe_customer_id,updated_at FROM stripe_customer_links WHERE user_id=?').bind(userId).first();
}
export async function getUserIdByStripeCustomer(env,customerId){
  const db=requireDb(env);
  const row=await db.prepare('SELECT user_id FROM stripe_customer_links WHERE stripe_customer_id=?').bind(customerId).first();
  return row?.user_id||null;
}
export async function upsertStripeCustomerLink(env,userId,customerId){
  const db=requireDb(env),now=isoNow();
  await db.prepare(`INSERT INTO stripe_customer_links (user_id,stripe_customer_id,updated_at)
    VALUES (?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET stripe_customer_id=excluded.stripe_customer_id,updated_at=excluded.updated_at`)
    .bind(userId,customerId,now).run();
}
export async function upsertStripeEntitlement(env,{subscriptionId,userId,customerId,priceId,status}){
  const db=requireDb(env),now=isoNow();
  await db.prepare(`INSERT INTO stripe_entitlements
    (stripe_subscription_id,user_id,stripe_customer_id,product_key,stripe_price_id,status,updated_at)
    VALUES (?,?,?,'data-shaper-pro',?,?,?)
    ON CONFLICT(stripe_subscription_id) DO UPDATE SET
      user_id=excluded.user_id,
      stripe_customer_id=excluded.stripe_customer_id,
      product_key='data-shaper-pro',
      stripe_price_id=excluded.stripe_price_id,
      status=excluded.status,
      updated_at=excluded.updated_at`)
    .bind(subscriptionId,userId,customerId,priceId||null,status,now).run();
}
