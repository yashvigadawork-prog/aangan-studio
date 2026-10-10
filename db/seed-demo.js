// npm run seed:demo   -> loads the 17 real September calls as clearly-marked demo rows
// npm run seed:clear  -> removes them again
import 'dotenv/config';
import pg from 'pg';
import { qualify } from '../src/qualify.js';

const clearOnly = process.argv.includes('--clear');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query("DELETE FROM calendar_bookings WHERE vaani_call_id LIKE 'DEMO-%'");
await client.query('DELETE FROM calls WHERE is_demo');
if (clearOnly) { console.log('✅ demo data removed'); await client.end(); process.exit(0); }

// [id, date, time, minutes, name, lead fields]  (from Aangan_Sep 2026_Enquiries.pdf, phone section)
const R = { property_type: 'residential' }, C = { property_type: 'commercial' };
const calls = [
  ['T01', '2026-09-02', '10:23', 4.2, 'Priya', { ...R, location: 'Kothrud', area_sqft: 1400, scope: 'full_home', scope_size: 'full_home', weeks_available: 24, decision_maker: 'authorised' }],
  ['T02', '2026-09-03', '14:41', 5.1, 'Wakad enquirer', { ...R, location: 'Wakad', area_sqft: 950, scope: 'full_home', scope_size: 'full_home', weeks_available: 8, decision_maker: 'self' }],
  ['T03', '2026-09-03', '16:15', 2.7, 'Suresh Patil', { ...R, location: 'Nashik', scope: 'partial', scope_size: 'partial', decision_maker: 'self' }],
  ['T04', '2026-09-04', '11:07', 3.4, 'Living-room enquirer', { ...R, scope: 'advice_only', scope_size: 'single_room', decision_maker: 'self' }],
  ['T05', '2026-09-05', '10:52', 6.7, 'Aarti Mehta', { ...R, location: 'Koregaon Park', area_sqft: 2400, scope: 'full_home', scope_size: 'full_home', weeks_available: 17, decision_maker: 'self' }],
  ['T06', '2026-09-05', '15:28', 5.0, 'Baner startup', { ...C, location: 'Baner', area_sqft: 800, scope: 'full_home', scope_size: 'office', weeks_available: 12, decision_maker: 'self' }],
  ['T07', '2026-09-08', '09:44', 3.3, 'Pre-Diwali enquirer', { ...R, scope: 'partial', scope_size: 'partial', weeks_available: 3, decision_maker: 'self' }],
  ['T10', '2026-09-11', '14:04', 3.7, 'Kharadi 1BHK', { ...R, location: 'Kharadi', area_sqft: 550, scope: 'partial', scope_size: 'partial', budget_lakh: 1.5, decision_maker: 'self' }],
  ['T11', '2026-09-12', '10:18', 6.4, 'Baner renter', { ...R, location: 'Baner', scope: 'partial', scope_size: 'partial', decision_maker: 'self' }],
  ['T12', '2026-09-15', '10:05', 7.5, 'Anand Sharma', { ...R, location: 'Kalyani Nagar', area_sqft: 5500, scope: 'full_home', scope_size: 'full_home', weeks_available: 24, decision_maker: 'self' }],
  ['T13', '2026-09-16', '12:19', 6.1, 'Aundh enquirer', { ...R, location: 'Aundh', area_sqft: 1100, scope: 'partial', scope_size: 'partial', decision_maker: 'self' }],
  ['T14', '2026-09-17', '11:41', 4.9, 'Hadapsar (for parents)', { ...R, location: 'Hadapsar', scope: 'full_home', scope_size: 'full_home', decision_maker: null }],
  ['T15', '2026-09-18', '15:12', 5.7, 'Smita', { ...R, location: 'Undri', area_sqft: 875, scope: 'full_home', scope_size: 'full_home', weeks_available: 6, decision_maker: 'authorised' }],
  ['T17', '2026-09-22', '14:16', 4.5, 'Ritu Kapoor', { ...R, location: 'Pimple Saudagar', area_sqft: 1050, scope: 'full_home', scope_size: 'full_home', weeks_available: 24, decision_maker: 'self' }],
  ['T18', '2026-09-23', '11:55', 3.0, 'Coworking pod', { ...C, area_sqft: 180, scope: 'partial', scope_size: 'office', decision_maker: 'self' }],
  ['T19', '2026-09-24', '16:02', 2.8, 'Restaurant owner', { ...C, venue: 'restaurant', location: 'Koregaon Park', scope: 'full_home', decision_maker: 'self' }],
  ['T20', '2026-09-25', '09:15', 4.7, 'Pooja', { ...R, location: 'Magarpatta', area_sqft: 900, scope: 'full_home', scope_size: 'full_home', weeks_available: 12, decision_maker: 'authorised' }],
];

let n = 0;
for (const [id, date, time, min, name, lead] of calls) {
  const r = qualify(lead);
  const when = `${date}T${time}:00+05:30`;
  const hour = Number(time.slice(0, 2));
  const q = r.status === 'qualified';
  const ins = await client.query(
    `INSERT INTO calls (vaani_call_id, caller_phone, caller_name, property_type, area_sqft, scope, budget_lakh, qualification_status,
       qualification_reason, handoff_note, call_started_at, call_duration_sec, after_hours, vaani_cost, telegram_sent, hubspot_contact_id,
       is_demo, created_at, raw_payload, location)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,TRUE,$11,$17,$18) RETURNING id`,
    [`DEMO-${id}`, `+9199999${String(++n).padStart(5, '0')}`, `${name} (demo)`, lead.property_type, lead.area_sqft ?? null, lead.scope ?? null,
      lead.budget_lakh ?? null, r.status, r.reason, r.notes.join('; ') || null, when, Math.round(min * 60), hour < 10 || hour >= 19,
      +(min * 6).toFixed(2) /* demo estimate: ₹6/min */, q, q ? 'demo' : null, { extracted_data: lead }, lead.location ?? null]);
  if (q && id !== 'T14') {
    await client.query(
      `INSERT INTO calendar_bookings (call_id, vaani_call_id, cal_booking_uid, slot_start, slot_end, invitee_name, created_at)
       VALUES ($1,$2,'demo',$3::timestamptz + interval '3 days',$3::timestamptz + interval '3 days 1 hour',$4,$3)`,
      [ins.rows[0].id, `DEMO-${id}`, when, name]);
  }
}
console.log(`✅ loaded ${calls.length} demo calls (marked is_demo)`);
await client.end();
