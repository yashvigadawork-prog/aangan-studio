// Mid-call check: the agent sends what it has learned so far, and Nikhil's rules (qualify.js) decide what happens next.
// Returns one of:
//   needs_info -> ask ONE direct question (rubric: unclear on project, area or timeline)
//   qualified  -> go on to offer consultation slots
//   declined   -> close kindly with the given words
// Never mentions a price or a number. Budget/decision-maker gaps never block (rubric: do not push).
import { qualify } from './qualify.js';
import { canonicalise } from './normalize.js';

const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

const QUESTIONS = {
  real_project: 'Are you looking for a complete design with execution, like a full home or at least a full room, rather than just advice?',
  service_area: 'Which area of Pune or Pimpri-Chinchwad is the property in?',
  timeline: 'When would you need the project completed, or when will the site be ready?',
};

const REASON_SAY = {
  real_project: "We're a full-service studio, so we do design together with execution, not advice-only or styling-only work.",
  service_area: 'We currently work only in Pune and Pimpri-Chinchwad, because our contractor network is there.',
  timeline: 'Our design phase and execution need a bit more lead time than that to do the work well.',
  budget: 'A project of that scope usually needs a bigger investment than the figure you mentioned, and I would not want to waste your time.',
  decision_maker: 'It works best when the person who decides can be part of the consultation, so please call us again once they can join.',
  space_fit: "That kind of space is outside what we take on. We focus on homes and offices or clinics of a certain size.",
};

const CLOSING = 'This sounds like it may not be the right fit for us right now, but please reach out if your timeline or scope changes.';

export function checkLead(input, now = Date.now()) {
  const lead = canonicalise({
    property_type: input.property_type ?? null, venue: input.venue ?? null, location: input.location ?? null,
    area_sqft: num(input.area_sqft), scope: input.scope ?? null, scope_size: input.scope_size ?? null,
    weeks_available: num(input.weeks_available), timeline: input.timeline ?? null,
    start_date: input.start_date ?? null, end_date: input.end_date ?? null,
    budget_lakh: num(input.budget_lakh), decision_maker: input.decision_maker ?? null,
  }, now);

  const r = qualify(lead);
  const failed = Object.entries(r.checks).filter(([, [res]]) => res === 'fail').map(([k]) => k);

  if (failed.length) {
    return { status: 'declined', say: `${failed.map((k) => REASON_SAY[k]).join(' ')} ${CLOSING}`, reason: r.reason };
  }
  const missing = ['real_project', 'service_area', 'timeline'].find((k) => r.checks[k][0] === 'unclear');
  if (missing) return { status: 'needs_info', ask: QUESTIONS[missing], missing };

  return {
    status: 'qualified',
    say: 'This is a good fit. Offer the free designer consultation, then use fetch_available_slots.',
    note: r.notes.length ? `Not confirmed, but do not push: ${r.notes.join('; ')}` : null,
  };
}
