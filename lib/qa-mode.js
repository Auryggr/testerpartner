/*
 * QA mode: lets the owner see (and book) the real calendar availability,
 * skipping the minimum notice that visitors get.
 *
 * It is enabled only when the request carries the cookie
 *   tp_qa=<QA_BYPASS_TOKEN>
 * and the value matches the Cloudflare secret QA_BYPASS_TOKEN.
 * Without the secret configured, QA mode is always off.
 */

const COOKIE_NAME = "tp_qa";

function safeEqual(a, b) {
  const encoder = new TextEncoder();
  const left = encoder.encode(String(a));
  const right = encoder.encode(String(b));
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i++) {
    diff |= (left[i] || 0) ^ (right[i] || 0);
  }

  return diff === 0;
}

function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";

  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return part.slice(index + 1).trim();
      }
    }
  }

  return "";
}

export function isQaRequest(request, env) {
  const expected = env.QA_BYPASS_TOKEN;
  if (!expected) return false;

  const provided = readCookie(request, COOKIE_NAME);
  return Boolean(provided) && safeEqual(provided, expected);
}

/* Minimum minutes between "now" and the start of a bookable slot. */
export function minNoticeMinutes(request, env) {
  if (isQaRequest(request, env)) return 0;

  const hours = Number(env.MIN_NOTICE_HOURS ?? 48);
  return Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : 0;
}
