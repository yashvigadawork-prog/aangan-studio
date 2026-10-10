// Scores a lead against Nikhil's five criteria (knowledge/qualified.md).
// Pure function: no database, no internet, so it is easy to test.
//
// Each criterion returns 'pass' | 'fail' | 'unclear'.
//   any 'fail'  -> unqualified (close politely)
//   'unclear'   -> still qualified, with a note for the designer
// This leans towards passing leads on purpose: rejecting a good lead costs more.

import { RULES } from './config.js';

const has = (text, list) => list.some((w) => text.includes(w));
const norm = (s) => String(s ?? '').toLowerCase().trim();

function checkRealProject(lead) {
  const bad = {
    advice_only: 'only wants advice or ideas, not design with execution',
    decor_only: 'decor/styling only; minimum engagement is a room redesign with execution',
    furniture_only: 'standalone furniture sourcing is not offered',
    structural: 'needs architecture/structural work, which the studio does not do',
  };
  if (bad[lead.scope]) return ['fail', bad[lead.scope]];
  if (lead.scope) return ['pass', null];
  return ['unclear', 'scope of work not confirmed'];
}

function checkServiceArea(lead) {
  const place = norm(lead.location);
  if (!place) return ['unclear', 'location not captured'];
  if (has(place, RULES.outOfArea)) return ['fail', `site in ${lead.location} is outside Pune/PCMC`];
  if (has(place, RULES.serviceAreas)) return ['pass', null];
  return ['unclear', `location "${lead.location}" not recognised; verify it is in Pune/PCMC`];
}

function checkTimeline(lead) {
  const w = lead.weeks_available;
  if (w == null || Number.isNaN(Number(w))) return ['unclear', 'timeline not captured'];
  if (Number(w) < RULES.minWeeksAvailable) {
    return ['fail', `needs the project in about ${w} weeks; minimum lead time is ${RULES.minWeeksAvailable} weeks`];
  }
  return ['pass', null];
}

function checkBudget(lead) {
  if (lead.budget_lakh == null) return ['pass', null]; // not mentioned = treat as qualified
  const floor = RULES.budgetFloorLakh[lead.scope_size] ?? RULES.budgetFloorLakh.partial;
  if (Number(lead.budget_lakh) < floor) {
    return ['fail', `stated budget of about ₹${lead.budget_lakh} lakh is clearly below the scope described`];
  }
  return ['pass', null];
}

function checkDecisionMaker(lead) {
  if (lead.decision_maker === 'researching') return ['fail', 'caller is only doing initial research for someone else'];
  if (lead.decision_maker === 'self' || lead.decision_maker === 'authorised') return ['pass', null];
  return ['unclear', 'decision-maker not confirmed'];
}

// Studio-level limits from services.md that are not one of the five criteria.
function checkSpace(lead) {
  const venue = norm(lead.venue);
  if (has(venue, RULES.outOfScopeVenues)) return ['fail', `${lead.venue} projects are out of scope (no retail/hospitality/gyms)`];
  if (lead.property_type === 'commercial' && lead.area_sqft != null) {
    const a = Number(lead.area_sqft);
    if (a < RULES.commercialMinSqft) return ['fail', `${a} sq ft is below the commercial minimum of ${RULES.commercialMinSqft} sq ft`];
    if (a > RULES.commercialMaxSqft * RULES.commercialMaxTolerance) {
      return ['fail', `${a} sq ft is above the commercial maximum of about ${RULES.commercialMaxSqft} sq ft`];
    }
  }
  return ['pass', null];
}

export function qualify(lead) {
  const checks = {
    real_project: checkRealProject(lead),
    service_area: checkServiceArea(lead),
    timeline: checkTimeline(lead),
    budget: checkBudget(lead),
    decision_maker: checkDecisionMaker(lead),
    space_fit: checkSpace(lead),
  };

  const failures = Object.values(checks).filter(([r]) => r === 'fail').map(([, why]) => why);
  const unclear = Object.values(checks).filter(([r]) => r === 'unclear').map(([, why]) => why);

  if (failures.length) {
    return { status: 'unqualified', reason: failures.join('; '), notes: unclear, checks };
  }
  const reason = unclear.length
    ? 'Passes all clear criteria; gaps for the designer to confirm: ' + unclear.join('; ')
    : 'Passes all criteria';
  return { status: 'qualified', reason, notes: unclear, checks };
}
