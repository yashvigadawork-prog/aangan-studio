// Tools Vaani calls DURING the live call (Phase 2).
//   GET  /api/slots   -> list of free slots to read out
//   POST /api/book    -> book the one the caller picked
import { Router } from 'express';
import { getFreeSlots, bookSlot } from '../services/slots.js';
import { normalizePhone } from '../normalize.js';
import { checkLead } from '../leadCheck.js';

const router = Router();

router.use((req, res, next) => {
  const secret = req.get('x-webhook-secret') ?? req.query.secret;
  if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) return res.status(401).json({ error: 'bad secret' });
  next();
});

// Mid-call: Nikhil's rules decide whether to go on to booking.
router.post('/check_lead', (req, res) => res.json(checkLead(req.body ?? {})));

router.get('/slots', async (_req, res) => {
  try {
    const slots = await getFreeSlots();
    res.json({ slots, say: slots.map((s) => s.label) });
  } catch (err) {
    console.error('slots error:', err.message);
    res.status(500).json({ error: 'could not read calendar' });
  }
});

router.post('/book', async (req, res) => {
  const { start, name, email, phone, call_id } = req.body ?? {};
  if (!start) return res.status(400).json({ error: 'start is required' });
  try {
    const r = await bookSlot({ startIso: start, name, email, phone: normalizePhone(phone), vaaniCallId: call_id });
    if (!r.booked) return res.status(409).json(r);
    // Cal.com emails the caller the invite and calendar file itself.
    res.json({ booked: true, when: r.slot.label, invite_sent_by_email: true });
  } catch (err) {
    console.error('book error:', err.message);
    res.status(500).json({ error: 'could not book' });
  }
});

export default router;
