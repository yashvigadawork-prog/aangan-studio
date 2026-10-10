// Data for Nikhil's dashboard + the front-desk override button.
import { Router } from 'express';
import { pool } from '../db.js';
import { ROI } from '../config.js';
import { normalizePayload } from '../normalize.js';
import { buildAlert, sendTelegram } from '../services/telegram.js';
import { pushLead } from '../services/hubspot.js';

const router = Router();

// The dashboard is open (no login), by design for this project submission.

const categorise = (reason = '') => {
  const r = reason.toLowerCase();
  if (r.includes('outside pune')) return 'Outside service area';
  if (r.includes('advice') || r.includes('decor') || r.includes('furniture') || r.includes('structural')) return 'Not a full design project';
  if (r.includes('lead time') || r.includes('weeks')) return 'Timeline too short';
  if (r.includes('budget')) return 'Budget far too low';
  if (r.includes('sq ft') || r.includes('out of scope')) return 'Size / venue not served';
  if (r.includes('complaint')) return 'Existing-client complaint';
  if (r.includes('research')) return 'Not the decision-maker';
  return 'Other';
};

router.get('/stats', async (req, res) => {
  try {
    const days = Number(req.query.days) || null;
    const where = days ? `WHERE created_at > NOW() - INTERVAL '${days} days'` : '';
    const [{ rows: [t] }, { rows: reasons }, { rows: daily }, { rows: [bk] }] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int total,
          COUNT(*) FILTER (WHERE qualification_status='qualified')::int qualified,
          COUNT(*) FILTER (WHERE qualification_status='unqualified')::int unqualified,
          COUNT(*) FILTER (WHERE overridden_by_staff)::int overridden,
          COUNT(*) FILTER (WHERE after_hours)::int after_hours,
          COUNT(*) FILTER (WHERE answered_within_5min)::int answered_fast,
          COUNT(*) FILTER (WHERE hubspot_contact_id IS NOT NULL)::int in_hubspot,
          COUNT(*) FILTER (WHERE telegram_sent)::int alerted,
          COUNT(*) FILTER (WHERE pricing_flagged)::int pricing_flagged,
          COALESCE(SUM(vaani_cost),0)::float vaani_cost, COALESCE(SUM(llm_cost),0)::float llm_cost
        FROM calls ${where}`),
      pool.query(`SELECT qualification_reason reason FROM calls ${where ? where + ' AND' : 'WHERE'} qualification_status='unqualified'`),
      pool.query(`SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata'),'YYYY-MM-DD') AS "day",
          COUNT(*)::int calls, COUNT(*) FILTER (WHERE qualification_status='qualified')::int qualified
        FROM calls ${where} GROUP BY 1 ORDER BY 1`),
      pool.query(`SELECT COUNT(*)::int booked FROM calendar_bookings b ${days ? `WHERE b.created_at > NOW() - INTERVAL '${days} days'` : ''}`),
    ]);

    const breakdown = {};
    for (const r of reasons) breakdown[categorise(r.reason)] = (breakdown[categorise(r.reason)] ?? 0) + 1;

    // Honest, assumption-driven estimate: extra projects = booked leads x share that used to go unanswered x (4x - 1x) x baseline rate.
    const extraProjects = bk.booked * ROI.unansweredShare * (ROI.fastResponseMultiplier - 1) * ROI.baselineConversion;
    res.json({
      ...t, booked: bk.booked, reasons: breakdown, daily,
      system_cost_total: t.vaani_cost + t.llm_cost, infra_cost: 0,
      cost_per_call: t.total ? (t.vaani_cost + t.llm_cost) / t.total : 0,
      roi: { extra_projects: extraProjects, revenue_lakh: extraProjects * ROI.avgProjectLakh, assumptions: ROI },
    });
  } catch (err) {
    console.error('stats error:', err.message);
    res.status(500).json({ error: 'stats failed' });
  }
});

router.get('/unqualified', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, created_at, caller_name, caller_phone, property_type, area_sqft, scope, location, to_char(start_date,'YYYY-MM-DD') AS start_date, to_char(end_date,'YYYY-MM-DD') AS end_date, timeline, qualification_reason, recording_url, call_type, is_demo
     FROM calls WHERE qualification_status='unqualified' AND NOT overridden_by_staff ORDER BY created_at DESC LIMIT 100`);
  res.json(rows);
});

// Front desk disagrees with the AI: mark qualified, then do the normal qualified-lead handoff.
router.post('/calls/:id/requalify', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM calls WHERE id=$1 AND qualification_status=\'unqualified\'', [req.params.id]);
  const call = rows[0];
  if (!call) return res.status(404).json({ error: 'call not found or already qualified' });

  await pool.query(
    `UPDATE calls SET qualification_status='qualified', overridden_by_staff=TRUE,
       qualification_reason = 'Re-qualified by front desk (AI said: ' || COALESCE(qualification_reason,'') || ')' WHERE id=$1`, [call.id]);

  const lead = call.raw_payload ? normalizePayload(call.raw_payload).lead : {};
  const merged = { ...lead, caller_name: call.caller_name ?? lead.caller_name, email: call.email ?? lead.email,
    caller_phone: call.caller_phone, recording_url: call.recording_url, handoff_note: 'Re-qualified by front desk; AI had declined' };
  const out = { telegram: false, hubspot: false };
  try { out.telegram = (await sendTelegram(buildAlert({ ...merged, property_type: lead.property_type ?? call.property_type, area_sqft: call.area_sqft, scope: call.scope }, null))).sent; } catch (e) { console.error(e.message); }
  try { const h = await pushLead(merged); out.hubspot = h.pushed; if (h.pushed) await pool.query('UPDATE calls SET hubspot_contact_id=$1, telegram_sent=$2 WHERE id=$3', [h.id, out.telegram, call.id]); } catch (e) { console.error(e.message); }
  res.json({ ok: true, ...out });
});

export default router;
