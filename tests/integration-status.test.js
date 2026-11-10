import {describe,it,expect} from 'vitest';
import {integrationStatus,disclosureUrl,domainStatus,canonicalOrigin} from '../src/integrations/status.js';

describe('non-mail integration status',()=>{
  it('fails closed when no external connection is configured',()=>{
    const s=integrationStatus({});
    expect(s.production_billing).toBe(false);
    expect(s.stripe.enabled).toBe(false);
    expect(s.stripe.ready).toBe(false);
    expect(s.ready_for_test_connections).toBe(false);
    expect(s.ready_for_domain_cutover).toBe(false);
    expect(disclosureUrl({})).toBe('');
    expect(canonicalOrigin({})).toBe(null);
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
  it('accepts only an exact HTTPS custom origin for domain cutover',()=>{
    const d=domainStatus({APP_ORIGIN:'https://data.example.com',ENFORCE_CANONICAL_ORIGIN:'true'});
    expect(d.configured).toBe(true);
    expect(d.custom_domain).toBe(true);
    expect(d.ready_for_cutover).toBe(true);
    expect(d.canonical_redirect_enabled).toBe(true);
    expect(canonicalOrigin({APP_ORIGIN:'https://data.example.com'})).toBe('https://data.example.com');
  });
  it('does not count Cloudflare platform URLs as the final custom domain',()=>{
    expect(domainStatus({APP_ORIGIN:'https://web-app-data.example.pages.dev'}).ready_for_cutover).toBe(false);
    expect(domainStatus({APP_ORIGIN:'https://web-app-data.example.workers.dev'}).ready_for_cutover).toBe(false);
  });
  it('rejects path-bearing or insecure production origins',()=>{
    expect(domainStatus({APP_ORIGIN:'https://example.com/app'}).configured).toBe(false);
    expect(domainStatus({APP_ORIGIN:'http://example.com'}).configured).toBe(false);
  });
  it('rejects non-https disclosure destinations',()=>{
    expect(disclosureUrl({LEGAL_DISCLOSURE_URL:'http://example.com'})).toBe('');
  });
});
