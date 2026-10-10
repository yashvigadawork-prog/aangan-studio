// POST /api/webhook/vaani  - Vaani calls this when a call ends.
import { Router } from 'express';
import { pool } from '../db.js';
import { normalizePayload } from '../normalize.js';
import { qualify } from '../qualify.js';
import { findPriceQuotes } from '../pricingGuard.js';
import { VAANI_RATE_INR_PER_MIN } from '../config.js';
import { buildAlert, sendTelegram } from '../services/telegram.js';
import { pushLead } from '../services/hubspot.js';
import { label } from '../services/slots.js';

const router = Router();

const isAfterHours = (iso) => {
  if (!iso) return false;
  const hour = Number(new Date(iso).toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }));
  return hour < 10 || hour >= 19;
};

router.post('/', async (req, res) => {
  // 1. Only accept calls that know our secret word.
  const secret = req.get('x-webhook-secret') ?? req.query.secret;
  if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'bad secret' });
  }

  try {
    // 2. Clean up the payload, then score the lead.
    const c = normalizePayload(req.body);

    // Vaani sends many events per call; only the post-processing one has the transcript and details.
    if (c.event && c.event !== 'call_postprocessing') return res.json({ ok: true, ignored: c.event });
    if (!c.vaani_cost && c.call_duration_sec) c.vaani_cost = +((c.call_duration_sec / 60) * VAANI_RATE_INR_PER_MIN).toFixed(2);
    // Browser test calls have no real number ("web-user"); use the one the caller spoke, if any.
    if (!/\d{8,}/.test(String(c.caller_phone ?? ''))) c.caller_phone = c.lead.phone ?? c.caller_phone;
    const result = c.call_type === 'complaint'
      ? { status: 'unqualified', reason: 'Existing-client complaint, not a new lead; escalate to studio head', notes: [] }
      : qualify(c.lead);
    const priceLines = findPriceQuotes(c.transcript);

    const transcriptText = Array.isArray(c.transcript)
      ? c.transcript.map((t) => `${t.role ?? t.speaker}: ${t.text ?? t.content ?? t.message}`).join('\n')
      : c.transcript;

    // 3. Save every call (qualified or not).
    const { rows } = await pool.query(
      `INSERT INTO calls (vaani_call_id, caller_phone, caller_name, email, property_type, area_sqft, scope,
          budget_lakh, timeline, transcript, recording_url, qualification_status, qualification_reason,
          handoff_note, call_type, call_started_at, call_duration_sec, after_hours, vaani_cost, pricing_flagged, raw_payload, location, start_date, end_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       ON CONFLICT (vaani_call_id) DO NOTHING
       RETURNING id, qualification_status`,
      [c.vaani_call_id, c.caller_phone, c.lead.caller_name, c.lead.email, c.lead.property_type ?? c.lead.venue,
        c.lead.area_sqft, c.lead.scope, c.lead.budget_lakh, c.lead.timeline, transcriptText, c.recording_url,
        result.status, result.reason, result.notes.join('; ') || null, c.call_type, c.call_started_at, c.call_duration_sec,
        isAfterHours(c.call_started_at), c.vaani_cost, priceLines.length > 0, req.body,
        c.lead.location, c.lead.start_date, c.lead.end_date]
    );

    if (!rows.length) return res.json({ ok: true, duplicate: true });

    // Link any slot booked during the call to this call record.
    let booking = null;
    if (c.vaani_call_id) {
      const b = await pool.query(
        'UPDATE calendar_bookings SET call_id = $1 WHERE vaani_call_id = $2 RETURNING slot_start', [rows[0].id, c.vaani_call_id]);
      booking = b.rows[0] ?? null;
    }
    // The booking tool may not know Vaani's call id, so fall back to the caller's email (recent, unlinked bookings only).
    if (!booking && c.lead.email) {
      const b = await pool.query(
        `UPDATE calendar_bookings SET call_id = $1
         WHERE id = (SELECT id FROM calendar_bookings WHERE call_id IS NULL AND lower(invitee_email) = lower($2)
                     AND created_at > NOW() - INTERVAL '3 hours' ORDER BY created_at DESC LIMIT 1)
         RETURNING slot_start`, [rows[0].id, c.lead.email]);
      booking = b.rows[0] ?? null;
    }

    // Qualified leads only: alert the designer. A failed alert must never lose the call.
    if (result.status === 'qualified') {
      try {
        const alert = await sendTelegram(buildAlert({
          caller_name: c.lead.caller_name, caller_phone: c.caller_phone, email: c.lead.email,
          property_type: c.lead.property_type, area_sqft: c.lead.area_sqft, scope: c.lead.scope,
          timeline: c.lead.timeline, location: c.lead.location, start_date: c.lead.start_date, end_date: c.lead.end_date, budget_lakh: c.lead.budget_lakh, handoff_note: result.notes.join('; '),
          recording_url: c.recording_url,
        }, booking));
        if (alert.sent) await pool.query('UPDATE calls SET telegram_sent = TRUE WHERE id = $1', [rows[0].id]);
        else console.warn('telegram not sent:', alert.reason);
      } catch (err) {
        console.error('telegram error:', err.message);
      }
    }
    if (result.status === 'qualified') {
      try {
        const hsr = await pushLead({
          ...c.lead, caller_phone: c.caller_phone, handoff_note: result.notes.join('; '), recording_url: c.recording_url,
          consultation: booking ? label(booking.slot_start) : null,
        });
        if (hsr.pushed) await pool.query('UPDATE calls SET hubspot_contact_id = $1 WHERE id = $2', [hsr.id, rows[0].id]);
      } catch (err) {
        console.error('hubspot error:', err.message);
      }
    }
    res.json({ ok: true, call_id: rows[0].id, status: rows[0].qualification_status, pricing_flagged: priceLines.length > 0 });
  } catch (err) {
    console.error('webhook error:', err);
    res.status(500).json({ error: 'server error' });
  }
});

export default router;
