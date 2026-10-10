// Business rules in one place, so Nikhil can change numbers without touching logic.
// Source: knowledge/services.md and knowledge/qualified.md.
// Items marked CONFIRM are our best guess and need Nikhil's sign-off.

export const RULES = {
  // Places we serve (lowercase). Anything matching = in area.
  serviceAreas: [
    'pune', 'pcmc', 'pimpri', 'chinchwad', 'pimple saudagar', 'pimple nilakh', 'ravet', 'hinjewadi',
    'kothrud', 'baner', 'aundh', 'wakad', 'koregaon park', 'kalyani nagar', 'viman nagar', 'hadapsar',
    'magarpatta', 'nibm', 'kondhwa', 'undri', 'shivane', 'warje', 'erandwane', 'deccan',
    'kharadi', 'nanded', 'pashan', 'balewadi', 'bavdhan', 'camp', 'yerwada', 'wanowrie', 'sinhagad',
  ],
  // Places we clearly do NOT serve.
  outOfArea: ['talegaon', 'lonavala', 'lonavla', 'nashik', 'mumbai', 'nagpur', 'kolhapur', 'satara', 'delhi', 'bangalore', 'bengaluru', 'hyderabad'],

  // Venue types that are out of scope (services.md "What we don't do").
  outOfScopeVenues: ['restaurant', 'hotel', 'retail', 'store', 'shop', 'gym', 'cafe', 'resort', 'showroom'],

  // Weeks the site must be available before the deadline. services.md: under 6 weeks = no.
  minWeeksAvailable: 6,

  // Commercial size window. Max from services.md; min from call T18 (CONFIRM).
  commercialMinSqft: 500,
  commercialMaxSqft: 3000,
  commercialMaxTolerance: 1.1, // "approximately 3,000"

  // A volunteered budget below this (in lakh INR) is "clearly below" for the scope. (CONFIRM)
  budgetFloorLakh: { single_room: 2.5, partial: 4, full_home: 6, office: 6 },
};


// Dashboard money maths. Every number here is an ASSUMPTION; the dashboard shows them openly. (CONFIRM with Nikhil)
export const ROI = {
  avgProjectLakh: 11,          // midpoint of the stated ₹8-14 lakh
  unansweredShare: 0.48,       // 48% of enquiries got no reply in 48 hours (case brief)
  fastResponseMultiplier: 4,   // replies within 1 hour convert at 4x (case brief)
  baselineConversion: 0.05,    // ASSUMED: 5% of qualified leads that get a slow reply become projects
};

// Vaani does not send a cost with its webhook, so we estimate it. Rate shown on the agent page: about 5.60 INR/min.
export const VAANI_RATE_INR_PER_MIN = 5.6;
