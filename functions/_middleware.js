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
  return new Response(message, {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="TesterPartner staging", charset="UTF-8"',
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const { hostname } = new URL(request.url);

  // Production domain: serve normally.
  if (!hostname.endsWith(STAGING_HOST_SUFFIX)) {
    return next();
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
  const protectedResponse = new Response(response.body, response);
  protectedResponse.headers.set("X-Robots-Tag", "noindex, nofollow");
  protectedResponse.headers.set("Cache-Control", "no-store");

  return protectedResponse;
}