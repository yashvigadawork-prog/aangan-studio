// Safety net for "THE CUT": the agent must never quote prices (knowledge/pricing.md).
// The real protection is that the agent is never given pricing.md. This scans what the
// AGENT said in the transcript and flags anything that looks like a price, so a human can check.

const AGENT_LABEL = /^(agent|assistant|ai|bot|vaani|front desk)\s*:/i;
const PRICE_PATTERNS = [
  /₹\s?\d/,
  /\brs\.?\s?\d/i,
  /\binr\s?\d/i,
  /\d[\d,.]*\s?(lakh|lac|crore|cr)\b/i,
  /per\s?(sq\.?\s?ft|square f)/i,
  /\b(rates?|costs?|prices?)\s+(start|begin|are|is|around|about)\b.*\d/i,
  /\bit'?ll cost around\b/i,
];

// transcript can be a plain string ("Agent: ...\nCaller: ...") or [{role, text}]
export function findPriceQuotes(transcript) {
  let agentLines = [];
  if (Array.isArray(transcript)) {
    agentLines = transcript
      .filter((t) => /agent|assistant|ai|bot/i.test(t.role ?? t.speaker ?? ''))
      .map((t) => String(t.text ?? t.content ?? t.message ?? ''));
  } else {
    agentLines = String(transcript ?? '').split('\n').filter((l) => AGENT_LABEL.test(l.trim()));
  }
  return agentLines.filter((line) => PRICE_PATTERNS.some((re) => re.test(line)));
}
