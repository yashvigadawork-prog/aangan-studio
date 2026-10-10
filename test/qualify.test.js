// Run with: npm test
// Each case is a REAL call from "Aangan_Sep 2026_Enquiries.pdf" (phone section),
// with the structured details the voice agent would capture, and the expected verdict.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qualify } from '../src/qualify.js';
import { findPriceQuotes } from '../src/pricingGuard.js';

const cases = [
  ['T01 3BHK Kothrud, done by March', 'qualified',
    { property_type: 'residential', location: 'Kothrud', area_sqft: 1400, scope: 'full_home', scope_size: 'full_home', weeks_available: 24, decision_maker: 'authorised' }],
  ['T02 2BHK Wakad, asks price (not a disqualifier)', 'qualified',
    { property_type: 'residential', location: 'Wakad', area_sqft: 950, scope: 'full_home', scope_size: 'full_home', weeks_available: 8, decision_maker: 'self' }],
  ['T03 Nashik is outside area', 'unqualified',
    { property_type: 'residential', location: 'Nashik', scope: 'partial', scope_size: 'partial', decision_maker: 'self' }],
  ['T04 only wants ideas', 'unqualified',
    { property_type: 'residential', scope: 'advice_only', scope_size: 'single_room', decision_maker: 'self' }],
  ['T05 4BHK Koregaon Park', 'qualified',
    { property_type: 'residential', location: 'Koregaon Park', area_sqft: 2400, scope: 'full_home', scope_size: 'full_home', weeks_available: 17, decision_maker: 'self' }],
  ['T06 800 sq ft office Baner', 'qualified',
    { property_type: 'commercial', location: 'Baner', area_sqft: 800, scope: 'full_home', scope_size: 'office', weeks_available: 12, decision_maker: 'self' }],
  ['T07 wants it before Diwali (3 weeks)', 'unqualified',
    { property_type: 'residential', scope: 'partial', scope_size: 'partial', weeks_available: 3, decision_maker: 'self' }],
  ['T10 Rs 1-1.5 lakh for kitchen + bedroom', 'unqualified',
    { property_type: 'residential', location: 'Kharadi', area_sqft: 550, scope: 'partial', scope_size: 'partial', budget_lakh: 1.5, decision_maker: 'self' }],
  ['T11 rented 2BHK, no structural change', 'qualified',
    { property_type: 'residential', location: 'Baner', scope: 'partial', scope_size: 'partial', decision_maker: 'self' }],
  ['T12 5,500 sq ft villa (residential has no size cap)', 'qualified',
    { property_type: 'residential', location: 'Kalyani Nagar', area_sqft: 5500, scope: 'full_home', scope_size: 'full_home', weeks_available: 24, decision_maker: 'self' }],
  ['T13 2BHK Aundh, pushes for price', 'qualified',
    { property_type: 'residential', location: 'Aundh', area_sqft: 1100, scope: 'partial', scope_size: 'partial', decision_maker: 'self' }],
  ['T14 son checking for parents (unclear decision-maker = pass with note)', 'qualified',
    { property_type: 'residential', location: 'Hadapsar', scope: 'full_home', scope_size: 'full_home', decision_maker: null }],
  ['T15 possession in 6 weeks (exactly the minimum)', 'qualified',
    { property_type: 'residential', location: 'Undri', area_sqft: 875, scope: 'full_home', scope_size: 'full_home', weeks_available: 6, decision_maker: 'authorised' }],
  ['T17 Pimple Saudagar 3BHK', 'qualified',
    { property_type: 'residential', location: 'Pimple Saudagar', area_sqft: 1050, scope: 'full_home', scope_size: 'full_home', weeks_available: 24, decision_maker: 'self' }],
  ['T18 180 sq ft coworking pod', 'unqualified',
    { property_type: 'commercial', area_sqft: 180, scope: 'partial', scope_size: 'office', decision_maker: 'self' }],
  ['T19 restaurant', 'unqualified',
    { property_type: 'commercial', venue: 'restaurant', location: 'Koregaon Park', scope: 'full_home', decision_maker: 'self' }],
  ['T20 2BHK Magarpatta', 'qualified',
    { property_type: 'residential', location: 'Magarpatta', area_sqft: 900, scope: 'full_home', scope_size: 'full_home', weeks_available: 12, decision_maker: 'authorised' }],
];

for (const [name, expected, lead] of cases) {
  test(name, () => {
    const r = qualify(lead);
    assert.equal(r.status, expected, `${r.status}: ${r.reason}`);
  });
}

test('unclear details never cause a rejection', () => {
  assert.equal(qualify({}).status, 'qualified');
});

test('pricing guard flags an agent quoting a price, ignores the caller', () => {
  const bad = 'Caller: How much?\nAgent: For a 2BHK it is around ₹2,000 per sq ft.';
  const good = 'Caller: I have ₹10 lakh.\nAgent: Pricing depends on the site; your designer will walk you through it.';
  assert.equal(findPriceQuotes(bad).length, 1);
  assert.equal(findPriceQuotes(good).length, 0);
});
