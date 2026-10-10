import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLead } from '../src/leadCheck.js';

const good = { property_type: 'residential', location: 'Kothrud', scope: 'full home redesign with execution', weeks_available: 20, decision_maker: 'owner' };

test('a good lead goes on to booking', () => {
  const r = checkLead(good);
  assert.equal(r.status, 'qualified');
  assert.match(r.say, /fetch_available_slots/);
});
test('Nashik is declined kindly, with the rubric closing line', () => {
  const r = checkLead({ ...good, location: 'Nashik' });
  assert.equal(r.status, 'declined');
  assert.match(r.say, /Pune and Pimpri-Chinchwad/);
  assert.match(r.say, /may not be the right fit/);
});
test('3-week timeline is declined', () => assert.equal(checkLead({ ...good, weeks_available: 3 }).status, 'declined'));
test('advice-only is declined', () => assert.equal(checkLead({ ...good, scope: 'just wants ideas' }).status, 'declined'));
test('a budget far too low is declined without quoting any number', () => {
  const r = checkLead({ ...good, scope: 'kitchen and bedroom', budget_lakh: 1.5 });
  assert.equal(r.status, 'declined');
  assert.doesNotMatch(r.say, /\d/);
});
test('unknown location asks one question instead of declining', () => {
  const r = checkLead({ ...good, location: null });
  assert.equal(r.status, 'needs_info');
  assert.match(r.ask, /Pune/);
});
test('unclear decision-maker or budget never blocks', () => {
  const r = checkLead({ ...good, decision_maker: null });
  assert.equal(r.status, 'qualified');
});
test('nothing the agent could say ever contains a price', () => {
  for (const c of [good, { ...good, location: 'Mumbai' }, { ...good, weeks_available: 2 }, { ...good, budget_lakh: 1 }, {}]) {
    const r = checkLead(c);
    assert.doesNotMatch(`${r.say ?? ''}${r.ask ?? ''}`, /₹|rs\.?\s?\d|lakh|per sq/i);
  }
});
