import { parseWhen, weeksUntil } from './dates.js';
// Turns whatever Vaani sends into one clean shape.
// We do not know Vaani's exact payload yet, so we accept several common names for each field.
// Once you paste a real sample from the Vaani dashboard, we can tighten this up.

const pick = (obj, ...keys) => {
  for (const k of keys) {
    const v = k.split('.').reduce((o, p) => (o == null ? o : o[p]), obj);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
};
const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

// "(961) 952-5483", "96195 25483", "+91 96195 25483", "09619525483" -> "+919619525483". Anything else is returned unchanged.
export function normalizePhone(v) {
  if (v == null) return null;
  const raw = String(v).trim();
  const d = raw.replace(/\D/g, '');
  if (d.length === 10 && /^[6-9]/.test(d)) return `+91${d}`;
  if (d.length === 11 && d.startsWith('0') && /^[6-9]/.test(d.slice(1))) return `+91${d.slice(1)}`;
  if (d.length === 12 && d.startsWith('91') && /^[6-9]/.test(d.slice(2))) return `+${d}`;
  return /^\+?\d{8,15}$/.test(d) ? (raw.startsWith('+') ? `+${d}` : raw) : raw;
}

const has = (t, re) => re.test(String(t ?? '').toLowerCase());
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Vaani's AI does not always use our exact words ("Owner" instead of "self", "3 BHK" instead of "full_home").
// This maps its free text onto the values the qualification rules understand.
export function canonicalise(l, now = Date.now()) {
  const out = { ...l };
  const all = [l.property_type, l.venue, l.scope_size].join(' ');

  if (!['residential', 'commercial'].includes(out.property_type)) {
    out.property_type = has(all, /office|clinic|studio|commercial|cowork|shop|store|restaurant|cafe|hotel|gym|retail/) ? 'commercial'
      : has(all, /home|house|flat|apartment|villa|bhk|residen|bungalow|penthouse/) ? 'residential' : null;
  }
  if (!out.venue && out.property_type === 'residential') out.venue = null;

  const sc = `${l.scope ?? ''} ${l.scope_size ?? ''}`;
  const known = ['full_home', 'partial', 'single_room', 'advice_only', 'decor_only', 'furniture_only', 'structural'];
  if (!known.includes(out.scope)) {
    out.scope = has(sc, /advice|idea|suggest|consult.*only|just look/) ? 'advice_only'
      : has(sc, /decor|styling|colou?r/) ? 'decor_only'
      : has(sc, /furniture.*(only|source)|only.*furniture/) ? 'furniture_only'
      : has(sc, /structur|demolish|break.*wall|move.*wall/) ? 'structural'
      : has(sc, /single|one room|bedroom only|living room only|kitchen only/) ? 'single_room'
      : has(sc, /full|complete|whole|entire|end.to.end|bhk|all rooms/) ? 'full_home'
      : has(sc, /partial|few rooms|two rooms|2 rooms|floor|kitchen|bedroom|living/) ? 'partial' : null;
  }
  if (!['single_room', 'partial', 'full_home', 'office'].includes(out.scope_size)) {
    out.scope_size = out.property_type === 'commercial' ? 'office'
      : ['single_room', 'partial', 'full_home'].includes(out.scope) ? out.scope : null;
  }

  const dm = String(l.decision_maker ?? '').toLowerCase();
  if (!['self', 'authorised', 'researching'].includes(out.decision_maker)) {
    out.decision_maker = !dm ? null
      : /research|just look|explor|checking|not decid|in-law|for my (parents|friend)/.test(dm) ? 'researching'
      : /author|behalf|spouse|husband|wife|partner|parent|represent/.test(dm) ? 'authorised'
      : /owner|self|myself|me\b|i am|i'm|yes|decision|founder|director|principal/.test(dm) ? 'self' : null;
  }

  // Start / finish dates. The caller's words ("immediately", "by March", "ready in January") become real dates.
  out.start_date = parseWhen(l.start_date, now, 'start');
  out.end_date = parseWhen(l.end_date, now, 'end') ?? (l.end_date ? null : parseWhen(l.timeline, now, 'end'));
  // The lead-time rule is about the finish date: weeks from today until the project must be done.
  const endWeeks = weeksUntil(out.end_date, now);
  const startWeeks = weeksUntil(out.start_date, now);
  if (endWeeks != null) out.weeks_available = endWeeks;
  else if (out.weeks_available == null && startWeeks != null) out.weeks_available = startWeeks;

  return out;
}

export function normalizePayload(input) {
  // Vaani's real webhook wraps details like { event, call_id, timestamp, data: { entities, transcript, ... } }.
  // call_postprocessing durations are in milliseconds.
  const isVaaniEvent = typeof input?.event === 'string' && input.data && typeof input.data === 'object';
  const body = isVaaniEvent ? { ...input.data, event: input.event, timestamp: input.timestamp } : input;
  // Structured answers the agent collected on the call (names vary by Vaani setup).
  const d = pick(body, 'entities', 'extracted_data', 'extracted', 'variables', 'collected_data', 'data') ?? {};

  const transcript = pick(body, 'transcript', 'call.transcript', 'conversation');
  return {
    event: body.event ?? null,
    summary: pick(body, 'summary'),
    vaani_call_id: pick(body, 'call_id', 'callId', 'id', 'call.id'),
    caller_phone: normalizePhone(pick(body, 'caller_phone', 'from', 'from_number', 'caller_number', 'phone', 'phone_number', 'call.from')),
    recording_url: pick(body, 'recording_url', 'recordingUrl', 'recording', 'call.recording_url'),
    transcript,
    call_started_at: pick(body, 'started_at', 'start_time', 'call_start', 'created_at', 'timestamp', 'call.started_at'),
    call_duration_sec: (() => {
      const a = Date.parse(pick(body, 'call_started_at', 'picked_up_at') ?? ''), b = Date.parse(pick(body, 'call_ended_at') ?? '');
      if (a && b && b > a) return Math.round((b - a) / 1000);
      const v = num(pick(body, 'duration', 'duration_sec', 'call_duration', 'call.duration'));
      // Vaani's docs say milliseconds but real calls arrive in seconds; anything huge is treated as milliseconds.
      return v != null && v >= 20000 ? Math.round(v / 1000) : v != null ? Math.round(v) : null;
    })(),
    call_type: has(pick(d, 'call_type'), /complain/) ? 'complaint' : 'enquiry',
    vaani_cost: num(pick(body, 'cost', 'call_cost', 'total_cost', 'call.cost')) ?? 0,

    lead: canonicalise({
      caller_name: pick(d, 'name', 'caller_name', 'customer_name'),
      email: pick(d, 'email', 'caller_email'),
      phone: normalizePhone(pick(d, 'phone', 'phone_number', 'mobile', 'contact_number')),
      property_type: pick(d, 'property_type', 'propertyType'), // 'residential' | 'commercial'
      venue: pick(d, 'venue', 'space_type', 'business_type'),
      location: pick(d, 'location', 'area', 'locality', 'city'),
      area_sqft: num(pick(d, 'area_sqft', 'square_footage', 'sqft', 'size')),
      scope: pick(d, 'scope', 'project_scope'),
      scope_size: pick(d, 'scope_size'), // single_room | partial | full_home | office
      weeks_available: num(pick(d, 'weeks_available', 'timeline_weeks')),
      timeline: pick(d, 'timeline'),
      start_date: pick(d, 'start_date', 'start', 'site_ready', 'start_when'),
      end_date: pick(d, 'end_date', 'finish_date', 'deadline', 'complete_by'),
      budget_lakh: num(pick(d, 'budget_lakh', 'budget')),
      decision_maker: pick(d, 'decision_maker'), // self | authorised | researching
    }),
  };
}
