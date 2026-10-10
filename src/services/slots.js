// Free consultation slots and booking, powered by Cal.com (https://cal.com/docs/api-reference/v2).
// Cal.com owns availability (days, hours, notice, double-booking) and emails the caller the invite.
// Change working hours in Cal.com: Availability settings. Times here are India time (IST).
import { pool } from '../db.js';

const API = 'https://api.cal.com/v2';
const TZ = 'Asia/Kolkata';
const DAYS_AHEAD = 7;

const headers = (version) => ({
  authorization: `Bearer ${process.env.CAL_API_KEY}`,
  'cal-api-version': version,
  'content-type': 'application/json',
});

export const label = (iso) =>
  new Date(iso).toLocaleString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ,
  });

export async function getFreeSlots(now = Date.now(), limit = 6) {
  const start = new Date(now).toISOString();
  const end = new Date(now + DAYS_AHEAD * 864e5).toISOString();
  const res = await fetch(
    `${API}/slots?eventTypeId=${process.env.CAL_EVENT_TYPE_ID}&start=${start}&end=${end}&timeZone=${TZ}&format=range`,
    { headers: headers('2024-09-04') }
  );
  const body = await res.json();
  if (!res.ok) throw new Error(`Cal.com slots ${res.status}: ${body.error?.message ?? JSON.stringify(body)}`);
  return Object.values(body.data ?? {})
    .flat()
    .map((s) => ({ start: new Date(s.start).toISOString(), end: new Date(s.end).toISOString(), label: label(s.start) }))
    .slice(0, limit);
}

export async function bookSlot({ startIso, name, email, phone, vaaniCallId }) {
  if (!email) return { booked: false, reason: 'An email address is needed to send the invite.' };

  const res = await fetch(`${API}/bookings`, {
    method: 'POST',
    headers: headers('2026-02-25'),
    body: JSON.stringify({
      start: new Date(startIso).toISOString(),
      eventTypeId: Number(process.env.CAL_EVENT_TYPE_ID),
      attendee: { name: name ?? 'New lead', email, timeZone: TZ, language: 'en' },
      metadata: { phone: phone ?? '', source: 'aangan-voice-assistant' },
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    console.error('Cal.com booking failed:', res.status, JSON.stringify(body));
    const why = String(body?.error?.message ?? body?.message ?? '').toLowerCase();
    if (/email|mail/.test(why)) return { booked: false, reason: 'That email address looks invalid. Ask the caller to spell it again, letter by letter.' };
    return { booked: false, reason: 'That slot is no longer available. Fetch the slots again and offer different times.' };
  }

  const b = body.data;
  const slot = { start: new Date(b.start).toISOString(), end: new Date(b.end).toISOString() };
  slot.label = label(slot.start);
  const { rows } = await pool.query(
    `INSERT INTO calendar_bookings (vaani_call_id, cal_booking_uid, slot_start, slot_end, invitee_email, invitee_name)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [vaaniCallId ?? null, b.uid, slot.start, slot.end, email, name ?? null]
  );
  return { booked: true, booking_id: rows[0].id, cal_uid: b.uid, slot };
}

export async function cancelBooking(uid) {
  const res = await fetch(`${API}/bookings/${uid}/cancel`, {
    method: 'POST', headers: headers('2026-02-25'), body: JSON.stringify({ cancellationReason: 'Cancelled by Aangan system' }),
  });
  return res.ok;
}
