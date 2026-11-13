const LIMITS=Object.freeze({lite:15,pro:10});
const RESERVATION_TTL_SECONDS=30*60;
const CLAIM_TTL_SECONDS=24*60*60;

function nowSeconds(now){return Number.isInteger(now)?now:Math.floor(Date.now()/1000)}
function plan(tier){
  if(tier==='lite')return {tier:'lite',productKey:'data-shaper-lite',limit:LIMITS.lite};
  if(tier==='pro')return {tier:'pro',productKey:'data-shaper-pro',limit:LIMITS.pro};
  throw new Error('invalid_capacity_tier');
}
function changes(result){const raw=result?.meta?.changes??result?.changes;return raw===undefined||raw===null?null:Number(raw)||0}

export function capacityLimits(){return {...LIMITS,total:LIMITS.lite+LIMITS.pro}}

export async function ensureCapacityTable(env){
  if(!env?.DB?.prepare)throw new Error('capacity_db_not_bound');
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS capacity_reservations (
    reservation_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    product_key TEXT NOT NULL,
    tier TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS capacity_reservations_product ON capacity_reservations(product_key,expires_at)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS capacity_reservations_user ON capacity_reservations(user_id,product_key)').run();
  await env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS capacity_reservations_user_product_unique ON capacity_reservations(user_id,product_key)').run();
}

async function cleanupExpired(env,now){
  await env.DB.prepare('DELETE FROM capacity_reservations WHERE expires_at<=?').bind(now).run();
}

export async function capacitySnapshot(env,{tier,priceId,now}){
  const p=plan(tier),ts=nowSeconds(now);
  await ensureCapacityTable(env);
  await cleanupExpired(env,ts);
  const active=await env.DB.prepare("SELECT COUNT(*) AS n FROM stripe_entitlements WHERE product_key=? AND stripe_price_id=? AND status IN ('active','trialing')")
    .bind(p.productKey,priceId||'').first();
  const reserved=await env.DB.prepare('SELECT COUNT(*) AS n FROM capacity_reservations WHERE product_key=? AND expires_at>?')
    .bind(p.productKey,ts).first();
  const activeCount=Number(active?.n)||0,reservedCount=Number(reserved?.n)||0;
  return {
    tier:p.tier,limit:p.limit,active:activeCount,reserved:reservedCount,
    used:activeCount+reservedCount,remaining:Math.max(0,p.limit-activeCount-reservedCount),
    sold_out:activeCount+reservedCount>=p.limit
  };
}

export async function reserveCapacity(env,{tier,userId,priceId,now}){
  const p=plan(tier),ts=nowSeconds(now);
  if(!/^usr_[0-9a-f-]{36}$/i.test(String(userId||'')))throw new Error('invalid_capacity_user');
  await ensureCapacityTable(env);
  await cleanupExpired(env,ts);
  const existing=await env.DB.prepare("SELECT stripe_subscription_id FROM stripe_entitlements WHERE user_id=? AND product_key=? AND stripe_price_id=? AND status IN ('active','trialing') LIMIT 1")
    .bind(userId,p.productKey,priceId||'').first();
  if(existing?.stripe_subscription_id)return {ok:false,reason:'already_subscribed',snapshot:await capacitySnapshot(env,{tier,priceId,now:ts})};
  const prior=await env.DB.prepare('SELECT reservation_id,expires_at FROM capacity_reservations WHERE user_id=? AND product_key=? AND expires_at>? LIMIT 1')
    .bind(userId,p.productKey,ts).first();
  if(prior?.reservation_id)return {ok:true,reservationId:prior.reservation_id,expiresAt:Number(prior.expires_at)||ts+RESERVATION_TTL_SECONDS,reused:true,snapshot:await capacitySnapshot(env,{tier,priceId,now:ts})};
  const reservationId='cap_'+crypto.randomUUID();
  const expiresAt=ts+RESERVATION_TTL_SECONDS;
  const result=await env.DB.prepare(`INSERT OR IGNORE INTO capacity_reservations(reservation_id,user_id,product_key,tier,status,expires_at)
    SELECT ?,?,?,?,'pending',?
    WHERE (
      (SELECT COUNT(*) FROM stripe_entitlements WHERE product_key=? AND stripe_price_id=? AND status IN ('active','trialing')) +
      (SELECT COUNT(*) FROM capacity_reservations WHERE product_key=? AND expires_at>?)
    ) < ?`)
    .bind(reservationId,userId,p.productKey,p.tier,expiresAt,p.productKey,priceId||'',p.productKey,ts,p.limit).run();
  if(changes(result)===0){
    const raced=await env.DB.prepare('SELECT reservation_id,expires_at FROM capacity_reservations WHERE user_id=? AND product_key=? AND expires_at>? LIMIT 1')
      .bind(userId,p.productKey,ts).first();
    if(raced?.reservation_id)return {ok:true,reservationId:raced.reservation_id,expiresAt:Number(raced.expires_at)||expiresAt,reused:true,snapshot:await capacitySnapshot(env,{tier,priceId,now:ts})};
    return {ok:false,reason:'capacity_full',snapshot:await capacitySnapshot(env,{tier,priceId,now:ts})};
  }
  return {ok:true,reservationId,expiresAt,reused:false,snapshot:await capacitySnapshot(env,{tier,priceId,now:ts})};
}

export async function releaseCapacityReservation(env,reservationId){
  if(!env?.DB?.prepare||!/^cap_[0-9a-f-]{36}$/i.test(String(reservationId||'')))return;
  await env.DB.prepare('DELETE FROM capacity_reservations WHERE reservation_id=?').bind(reservationId).run();
}

export async function claimCapacityReservation(env,{reservationId,userId,productKey,now}){
  if(!env?.DB?.prepare||!/^cap_[0-9a-f-]{36}$/i.test(String(reservationId||'')))return;
  const ts=nowSeconds(now);
  await env.DB.prepare("UPDATE capacity_reservations SET status='claimed',expires_at=? WHERE reservation_id=? AND user_id=? AND product_key=?")
    .bind(ts+CLAIM_TTL_SECONDS,reservationId,userId,productKey).run();
}

export async function releaseUserProductReservations(env,{userId,productKey}){
  if(!env?.DB?.prepare||!userId||!productKey)return;
  await env.DB.prepare('DELETE FROM capacity_reservations WHERE user_id=? AND product_key=?').bind(userId,productKey).run();
}
