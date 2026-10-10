// Sends the designer alert through the free Telegram Bot API (no library needed).
import { isTodayOrPast } from '../dates.js';

export const fmtDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
// "Immediately" when the start date is today or earlier, otherwise a date.
export const startLabel = (iso) => (isTodayOrPast(iso) ? 'Immediately' : fmtDate(iso));

const esc = (s) => String(s ?? '—').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export function buildAlert(call, booking) {
  const lines = [
    '🏠 <b>New qualified lead</b>',
    '',
    `<b>${esc(call.caller_name)}</b> · ${esc(call.caller_phone)}`,
    `Email: ${esc(call.email)}`,
    `Property: ${esc(call.property_type)}${call.area_sqft ? `, ${call.area_sqft} sq ft` : ''}`,
    `Location: ${esc(call.location)}`,
    `Scope: ${esc(call.scope)}`,
  ];
  if (call.start_date || call.end_date) {
    lines.push(`Starts: ${call.start_date ? startLabel(call.start_date) : '—'}`);
    lines.push(`Finish by: ${call.end_date ? fmtDate(call.end_date) : '—'}`);
  } else {
    lines.push(`Timeline: ${esc(call.timeline)}`);
  }
  if (call.budget_lakh) lines.push(`Budget mentioned: ₹${call.budget_lakh} lakh`);
  if (booking) {
    const when = new Date(booking.slot_start).toLocaleString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
    });
    lines.push('', `📅 <b>Consultation:</b> ${when}`);
  } else {
    lines.push('', '📅 No slot booked yet');
  }
  if (call.handoff_note) lines.push('', `⚠️ <b>Please confirm:</b> ${esc(call.handoff_note)}`);
  if (call.recording_url) lines.push('', `🎧 <a href="${esc(call.recording_url)}">Recording</a>`);
  if (process.env.DASHBOARD_URL) lines.push(`📊 <a href="${esc(process.env.DASHBOARD_URL)}">Open dashboard</a>`);
  return lines.join('\n');
}

export async function sendTelegram(text) {
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chat } = process.env;
  if (!token || !chat) return { sent: false, reason: 'Telegram not configured' };
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  const body = await res.json();
  return body.ok ? { sent: true } : { sent: false, reason: body.description };
}
