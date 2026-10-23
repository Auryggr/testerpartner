/*
 * Shared-key protection for internal endpoints
 * (/api/transcript, /api/laxis-discovery).
 *
 * Callers must send the key in one of these headers:
 *   X-TesterPartner-Key: <INTERNAL_API_KEY>
 *   Authorization: Bearer <INTERNAL_API_KEY>
 *
 * INTERNAL_API_KEY is a Cloudflare secret (Production and Preview).
 * If it is not configured, the endpoint stays closed (fail closed).
 */

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

function readKey(request) {
  const direct = request.headers.get("X-TesterPartner-Key");

  if (direct) {
    return direct.trim();
  }

  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match ? match[1].trim() : "";
}

/*
 * Returns a Response to send back when the request is not allowed,
 * or null when the caller is authorized.
 */
export function requireInternalKey(context) {
  const expected = context.env.INTERNAL_API_KEY;

  if (!expected) {
    console.error("INTERNAL_API_KEY is not configured: internal endpoint closed.");

    return Response.json(
      { success: false, error: "Service unavailable." },
      { status: 503 }
    );
  }

  const provided = readKey(context.request);

  if (!provided || !safeEqual(provided, expected)) {
    return Response.json(
      { success: false, error: "Unauthorized." },
      {
        status: 401,
        headers: { "WWW-Authenticate": 'Bearer realm="TesterPartner internal"' }
      }
    );
  }

  return null;
}
