import {describe,it,expect} from 'vitest';
import {integrationStatus,disclosureUrl} from '../src/integrations/status.js';

describe('non-mail integration status',()=>{
  it('fails closed when no external connection is configured',()=>{
    const s=integrationStatus({});
    expect(s.production_billing).toBe(false);
    expect(s.stripe.enabled).toBe(false);
    expect(s.stripe.ready).toBe(false);
    expect(s.ready_for_test_connections).toBe(false);
    expect(disclosureUrl({})).toBe('');
  });
  it('reports prepared TEST connections without enabling production billing',()=>{
    const s=integrationStatus({
      ASSETS:{fetch(){}},
      DATA_SHAPER_BILLING_ENABLED:'false',
      STRIPE_TEST_SECRET_KEY:'sk_test_12345678901234567890',
      DATA_SHAPER_STRIPE_TEST_PRICE_ID:'price_123ABC',
      DATA_SHAPER_STRIPE_WEBHOOK_SECRET:'whsec_12345678901234567890',
      LEGAL_DISCLOSURE_URL:'https://example.com/legal/disclosure'
    });
    expect(s.production_billing).toBe(false);
    expect(s.stripe.secret_configured).toBe(true);
    expect(s.stripe.price_configured).toBe(true);
    expect(s.stripe.webhook_configured).toBe(true);
    expect(s.stripe.enabled).toBe(false);
    expect(s.stripe.ready).toBe(false);
    expect(s.ready_for_test_connections).toBe(true);
  });
  it('rejects non-https disclosure destinations',()=>{
    expect(disclosureUrl({LEGAL_DISCLOSURE_URL:'http://example.com'})).toBe('');
  });
});
