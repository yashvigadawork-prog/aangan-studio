// Pushes a qualified lead into HubSpot CRM as a contact (free tier, plain REST).
// Uses only standard HubSpot fields; the call details go into the contact's "message" field.
const API = 'https://api.hubapi.com/crm/v3/objects/contacts';

const headers = () => ({ authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`, 'content-type': 'application/json' });

async function hs(url, init) {
  const res = await fetch(url, { ...init, headers: headers() });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`HubSpot ${res.status}: ${body.message ?? text}`);
  return body;
}

import { fmtDate, startLabel } from './telegram.js';

export function buildProperties(call) {
  const [first, ...rest] = String(call.caller_name ?? '').trim().split(/\s+/);
  const summary = [
    `Source: Aangan voice assistant (phone enquiry)`,
    `Property: ${call.property_type ?? '—'}${call.area_sqft ? `, ${call.area_sqft} sq ft` : ''}`,
    `Location: ${call.location ?? '—'}`,
    `Scope: ${call.scope ?? '—'}`,
    call.start_date || call.end_date
      ? `Starts: ${call.start_date ? startLabel(call.start_date) : '—'} | Finish by: ${call.end_date ? fmtDate(call.end_date) : '—'}`
      : `Timeline: ${call.timeline ?? '—'}`,
    call.budget_lakh ? `Budget mentioned: ₹${call.budget_lakh} lakh` : null,
    call.consultation ? `Consultation booked: ${call.consultation}` : 'Consultation: not booked yet',
    call.handoff_note ? `To confirm: ${call.handoff_note}` : null,
    call.recording_url ? `Recording: ${call.recording_url}` : null,
  ].filter(Boolean).join('\n');

  const props = {
    firstname: first || undefined,
    lastname: rest.join(' ') || undefined,
    email: call.email || undefined,
    phone: call.caller_phone || undefined,
    city: call.location || undefined,
    lifecyclestage: 'lead',
    hs_lead_status: 'NEW',
    message: summary,
  };
  return Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined));
}

export async function pushLead(call) {
  if (!process.env.HUBSPOT_ACCESS_TOKEN) return { pushed: false, reason: 'HubSpot not configured' };
  const properties = buildProperties(call);

  if (call.email) {
    const found = await hs(`${API}/search`, {
      method: 'POST',
      body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: call.email }] }], limit: 1 }),
    });
    if (found.results?.length) {
      const id = found.results[0].id;
      await hs(`${API}/${id}`, { method: 'PATCH', body: JSON.stringify({ properties }) });
      return { pushed: true, id, updated: true };
    }
  }
  const created = await hs(API, { method: 'POST', body: JSON.stringify({ properties }) });
  return { pushed: true, id: created.id, updated: false };
}

export const deleteContact = (id) => hs(`${API}/${id}`, { method: 'DELETE' });
