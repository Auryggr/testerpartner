/*
 * Staging protection (HTTP Basic Auth) for every *.pages.dev URL.
 *
 * - testerpartner.com (production) is NOT affected.
 * - testerpartner.pages.dev and any preview/branch URL
 *   (e.g. staging.testerpartner.pages.dev) ask for a username and password.
 * - Credentials come from Cloudflare environment variables:
 *     STAGING_USER
 *     STAGING_PASSWORD   (add it as an encrypted "Secret")
 *   If they are missing, staging stays closed instead of open.
 * - Staging responses also send "noindex" so search engines never list them.
 */

const STAGING_HOST_SUFFIX = ".pages.dev";

/*
 * Security headers for every response (pages and API).
 *
 * Content-Security-Policy starts in Report-Only mode: the browser reports
 * violations in the console but blocks nothing. After a week without
 * violations, rename the header to "Content-Security-Policy" to enforce it.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://*.google-analytics.com https://*.googletagmanager.com",
  "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'"
].join("; ");

const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Content-Security-Policy-Report-Only": CSP
};

/*
 * Pages, scripts and styles must always be revalidated, so a new deploy
 * is visible immediately (no stale cookie-consent.js after a change).
 * Unchanged files are answered with 304 via ETag, so it stays fast.
 */
const REVALIDATE_TYPES = /text\/html|javascript|text\/css/;

function withSecurityHeaders(response) {
  const secured = new Response(response.body, response);

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    secured.headers.set(name, value);
  }

  const type = secured.headers.get("Content-Type") || "";
  const cache = secured.headers.get("Cache-Control") || "";

  if (REVALIDATE_TYPES.test(type) && !/no-store|private/.test(cache)) {
    secured.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  }

  return secured;
}

function safeEqual(a, b) {
  // Constant-time comparison so the password can't be guessed by timing.
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

function unauthorized(message = "Authentication required.") {
  return withSecurityHeaders(new Response(message, {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="TesterPartner staging", charset="UTF-8"',
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow"
    }
  }));
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const { hostname } = new URL(request.url);

  // Production domain: serve normally.
  if (!hostname.endsWith(STAGING_HOST_SUFFIX)) {
    return withSecurityHeaders(await next());
  }

  const expectedUser = env.STAGING_USER;
  const expectedPassword = env.STAGING_PASSWORD;

  // Fail closed: never expose staging by accident.
  if (!expectedUser || !expectedPassword) {
    return new Response("Staging access is not configured.", {
      status: 503,
      headers: { "X-Robots-Tag": "noindex, nofollow" }
    });
  }

  const header = request.headers.get("Authorization") || "";
  const [scheme, encoded] = header.split(" ");

  if (scheme !== "Basic" || !encoded) {
    return unauthorized();
  }

  let decoded = "";

  try {
    decoded = atob(encoded);
  } catch {
    return unauthorized();
  }

  const separator = decoded.indexOf(":");
  const user = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);

  const validUser = safeEqual(user, expectedUser);
  const validPassword = safeEqual(password, expectedPassword);

  if (separator < 0 || !(validUser && validPassword)) {
    return unauthorized("Invalid username or password.");
  }

  const response = await next();
  const protectedResponse = withSecurityHeaders(response);
  protectedResponse.headers.set("X-Robots-Tag", "noindex, nofollow");
  protectedResponse.headers.set("Cache-Control", "no-store");

  return protectedResponse;
}