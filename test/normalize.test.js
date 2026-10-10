import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePayload } from '../src/normalize.js';

// Shaped exactly like the call_postprocessing example in docs.vaanivoice.ai/guides/webhook-setup
const vaani = {
  event: 'call_postprocessing', call_id: 'inbound-1', timestamp: '2026-10-10T04:30:00+00:00',
  data: {
    room_name: 'inbound-1', call_id: 'inbound-1', call_duration: 240000, summary: 'Caller wants a 3BHK redesign.',
    entities: { name: 'Priya Sharma', email: 'p@example.com', property_type: 'residential', location: 'Kothrud', area_sqft: '1400', scope: 'full_home', weeks_available: '20' },
    recording_url: 'https://example.com/r', transcript: '[10:00:00] AGENT: Hello\n\n[10:00:03] USER: Hi',
  },
};

test('reads details out of data.entities and converts milliseconds', () => {
  const n = normalizePayload(vaani);
  assert.equal(n.event, 'call_postprocessing');
  assert.equal(n.vaani_call_id, 'inbound-1');
  assert.equal(n.call_duration_sec, 240);
  assert.equal(n.lead.caller_name, 'Priya Sharma');
  assert.equal(n.lead.area_sqft, 1400);
  assert.equal(n.lead.weeks_available, 20);
  assert.equal(n.recording_url, 'https://example.com/r');
});

test('plain (unwrapped) payloads still work', () => {
  const n = normalizePayload({ call_id: 'x', duration: 60, extracted_data: { name: 'A' } });
  assert.equal(n.call_duration_sec, 60);
  assert.equal(n.lead.caller_name, 'A');
});

import { qualify } from '../src/qualify.js';

// Real entities captured from a live Vaani test call (the AI used its own words, not ours)
test('maps the AI\'s free-text answers onto our values and qualifies the lead', () => {
  const n = normalizePayload({ event: 'call_postprocessing', call_id: 'real-1', timestamp: '2026-10-09T17:43:00+00:00', data: {
    call_duration: 171.48, call_started_at: '2026-10-09T17:40:17+00:00', call_ended_at: '2026-10-09T17:43:11+00:00',
    entities: { name: 'Yashvi', email: 'y@example.com', scope: 'Full redesign with complete execution', venue: 'home', location: 'Kothrud',
      timeline: 'March', area_sqft: 1400, call_type: 'new enquiry', scope_size: '3 BHK', budget_lakh: null, decision_maker: 'Owner', weeks_available: 20 } } });
  assert.equal(n.lead.property_type, 'residential');
  assert.equal(n.lead.scope, 'full_home');
  assert.equal(n.lead.scope_size, 'full_home');
  assert.equal(n.lead.decision_maker, 'self');
  assert.equal(n.call_type, 'enquiry');
  assert.ok(n.call_duration_sec > 150 && n.call_duration_sec < 200);
  assert.equal(qualify(n.lead).status, 'qualified');
  assert.equal(qualify(n.lead).notes.length, 0); // nothing left unclear
});

test('declines when the AI describes advice-only or a restaurant, in its own words', () => {
  const a = normalizePayload({ event: 'call_postprocessing', call_id: 'a', data: { entities: { scope: 'Just wants ideas for colours', venue: 'home', location: 'Baner' } } });
  assert.equal(qualify(a.lead).status, 'unqualified');
  const r = normalizePayload({ event: 'call_postprocessing', call_id: 'b', data: { entities: { venue: 'restaurant', location: 'Koregaon Park', scope: 'full interior' } } });
  assert.equal(qualify(r.lead).status, 'unqualified');
});

test('works out weeks from a month name or "6 weeks"', () => {
  const m = normalizePayload({ call_id: 'm', extracted_data: { timeline: 'by December' } }).lead.weeks_available;
  assert.ok(m > 0 && m < 60);
  assert.equal(normalizePayload({ call_id: 'w', extracted_data: { timeline: 'in 6 weeks' } }).lead.weeks_available, 6);
});

import { normalizePhone } from '../src/normalize.js';
test('phone numbers are cleaned into +91 format', () => {
  for (const v of ['(961) 952-5483', '96195 25483', '9619525483', '+91 96195 25483', '09619525483', '919619525483']) {
    assert.equal(normalizePhone(v), '+919619525483', v);
  }
  assert.equal(normalizePhone('web-user'), 'web-user');
});
