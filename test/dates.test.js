import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWhen, weeksUntil } from '../src/dates.js';
import { normalizePayload } from '../src/normalize.js';
import { qualify } from '../src/qualify.js';
import { buildAlert } from '../src/services/telegram.js';

const NOW = Date.parse('2026-10-10T08:00:00Z'); // 10 Oct 2026

test('parses the ways callers talk about dates', () => {
  assert.equal(parseWhen('immediately', NOW, 'start'), '2026-10-10');
  assert.equal(parseWhen('right away', NOW, 'start'), '2026-10-10');
  assert.equal(parseWhen('by March', NOW, 'end'), '2027-03-31');
  assert.equal(parseWhen('ready in January', NOW, 'start'), '2027-01-01');
  assert.equal(parseWhen('in 6 weeks', NOW, 'end'), '2026-11-21');
  assert.equal(parseWhen('15/12/2026', NOW, 'end'), '2026-12-15');
  assert.equal(parseWhen('before Diwali', NOW, 'end'), null);
  assert.equal(parseWhen('October', NOW, 'start'), '2026-10-10'); // current month = now
  assert.equal(parseWhen('', NOW), null);
});

test('weeks until a date', () => assert.equal(weeksUntil('2026-11-21', NOW), 6));

test('start and finish dates drive the lead-time rule', () => {
  const mk = (e) => normalizePayload({ event: 'call_postprocessing', call_id: 'x', data: { entities: { property_type: 'home', location: 'Baner', scope: 'full home', decision_maker: 'owner', ...e } } });
  const ok = mk({ start_date: 'immediately', end_date: 'by March' });
  assert.equal(ok.lead.start_date > '2026-01-01', true);
  assert.equal(qualify(ok.lead).status, 'qualified');
  const tooSoon = mk({ start_date: 'immediately', end_date: 'in 3 weeks' });
  assert.equal(qualify(tooSoon.lead).status, 'unqualified');
});

test('the Telegram alert shows location and both dates', () => {
  const text = buildAlert({ caller_name: 'A', location: 'Kothrud', start_date: '2020-01-01', end_date: '2027-03-31' }, null);
  assert.match(text, /Location: Kothrud/);
  assert.match(text, /Starts: Immediately/);
  assert.match(text, /Finish by: 31 Mar 2027/);
});
