// Turns what a caller says ("immediately", "by March", "in 6 weeks", "15/12/2026") into a real date (YYYY-MM-DD, India time).
// kind = 'start' -> first day of a month named; kind = 'end' -> last day of a month named.
const IST_MS = 330 * 60_000;
const DAY = 864e5;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const todayMs = (now) => Math.floor((now + IST_MS) / DAY) * DAY; // IST midnight, as a UTC-looking timestamp
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const utc = (y, m, d) => Date.UTC(y, m, d);

export function parseWhen(text, now = Date.now(), kind = 'end') {
  if (text == null || text === '') return null;
  const t = String(text).toLowerCase().trim();
  const today = todayMs(now);

  if (/\b(immediate|immediately|asap|right away|right now|already ready|ready now|as soon as|from today|straight away)\b/.test(t)) return iso(today);

  let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  m = t.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/); // India: day first
  if (m) { const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); return iso(utc(y, Number(m[2]) - 1, Number(m[1]))); }

  m = t.match(/\bin\s+(?:about\s+|around\s+)?(\d+)\s*(day|week|month)s?\b/);
  if (m) {
    const n = Number(m[1]);
    if (m[2] === 'day') return iso(today + n * DAY);
    if (m[2] === 'week') return iso(today + n * 7 * DAY);
    const d = new Date(today); return iso(utc(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate()));
  }
  if (/\bnext week\b/.test(t)) return iso(today + 7 * DAY);
  if (/\bnext month\b/.test(t)) { const d = new Date(today); return iso(utc(d.getUTCFullYear(), d.getUTCMonth() + 1, kind === 'start' ? 1 : d.getUTCDate())); }

  const mi = MONTHS.findIndex((x) => new RegExp(`\\b${x}[a-z]*\\b`).test(t));
  if (mi >= 0) {
    const day = (t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/) ?? [])[1];
    const yr = (t.match(/\b(20\d{2})\b/) ?? [])[1];
    const now_ = new Date(today);
    let year = yr ? Number(yr) : now_.getUTCFullYear();
    const build = (y) => (day ? utc(y, mi, Number(day)) : kind === 'start' ? utc(y, mi, 1) : utc(y, mi + 1, 0));
    let target = build(year);
    if (!yr && target < today) {
      // the named month is already (partly) behind us: a start in the current month means "now", otherwise next year
      if (kind === 'start' && mi === now_.getUTCMonth()) return iso(today);
      if (!(kind === 'end' && mi === now_.getUTCMonth())) target = build(year + 1);
    }
    return iso(target);
  }
  return null;
}

export function weeksUntil(isoDate, now = Date.now()) {
  if (!isoDate) return null;
  return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - todayMs(now)) / (7 * DAY));
}

export function isTodayOrPast(isoDate, now = Date.now()) {
  return !!isoDate && Date.parse(`${isoDate}T00:00:00Z`) <= todayMs(now);
}
