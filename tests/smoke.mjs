/*
 * TesterPartner — smoke tests (no dependencies, Node 18+).
 *
 * Checks that the site, the legal pages and the booking API work.
 * The most important check: /api/availability returns days and times,
 * which proves the Google Calendar refresh token is still valid.
 *
 * Usage:
 *   BASE_URL=https://testerpartner.com node tests/smoke.mjs
 *   BASE_URL=https://staging.testerpartner.pages.dev \
 *     STAGING_USER=... STAGING_PASSWORD=... node tests/smoke.mjs
 */

import { appendFileSync } from "node:fs";

const BASE_URL = (process.env.BASE_URL || "https://testerpartner.com").replace(/\/$/, "");
const STAGING_USER = process.env.STAGING_USER || "";
const STAGING_PASSWORD = process.env.STAGING_PASSWORD || "";
const IS_STAGING = BASE_URL.includes(".pages.dev");
const IS_PRODUCTION = BASE_URL === "https://testerpartner.com";

const EXPECTED_SESSION_DURATION = 15;
const EXPECTED_SLOT_INTERVAL = 30;

const authHeaders =
  STAGING_USER && STAGING_PASSWORD
    ? {
        Authorization:
          "Basic " + Buffer.from(`${STAGING_USER}:${STAGING_PASSWORD}`).toString("base64")
      }
    : {};

const results = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function get(path, { auth = true, base = BASE_URL } = {}) {
  return fetch(base + path, {
    redirect: "manual",
    headers: {
      "Cache-Control": "no-cache",
      "User-Agent": "TesterPartner-QA/1.0",
      ...(auth ? authHeaders : {})
    }
  });
}

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`✅ ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
    console.log(`❌ ${name}\n   → ${error.message}`);
  }
}

/* ------------------------------------------------------------------ */

console.log(`\nTesterPartner smoke tests → ${BASE_URL}\n`);

if (IS_STAGING) {
  await check("Staging credentials are available and accepted", async () => {
    assert(
      STAGING_USER && STAGING_PASSWORD,
      "STAGING_USER and/or STAGING_PASSWORD are missing (GitHub: Settings → Secrets and variables → Actions)"
    );
    const res = await get("/");
    assert(
      res.status !== 401,
      "Credentials were rejected: STAGING_USER / STAGING_PASSWORD in GitHub don't match the ones in Cloudflare (Preview)"
    );
  });
}

await check("Home loads with the booking form", async () => {
  const res = await get("/");
  if (res.status === 503 && (await res.clone().text()).includes("Staging access is not configured")) {
    throw new Error("Staging is closed: add STAGING_PASSWORD (and the other secrets) to Cloudflare's Preview environment, then redeploy");
  }
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  const html = await res.text();
  assert(html.includes("breakdownModal"), "Booking form (#breakdownModal) not found in the home page");
  assert(html.includes("consentPrivacy"), "Privacy consent checkbox (#consentPrivacy) not found");
});

await check("Privacy Policy page is the policy (not the home)", async () => {
  const res = await get("/privacy-policy/");
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  const html = await res.text();
  assert(html.includes("Privacy Policy"), "Title 'Privacy Policy' not found");
  assert(html.includes("Aurysmar Guerra"), "Operator name not found — an old version may be deployed");
  assert(!html.includes("breakdownModal"), "The home page is being served instead of the policy (file missing?)");
});

await check("Terms page is the terms (not the home)", async () => {
  const res = await get("/terms/");
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  const html = await res.text();
  assert(html.includes("Terms of Service"), "Title 'Terms of Service' not found");
  assert(!html.includes("breakdownModal"), "The home page is being served instead of the terms (file missing?)");
});

await check("Booking API returns available dates (Google Calendar token OK)", async () => {
  const res = await get("/api/availability");
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Response is not JSON (status ${res.status}): ${text.slice(0, 120)}`);
  }
  assert(
    res.ok && body.success === true,
    `API failed (status ${res.status}). Most likely cause: the Google refresh token expired or the ` +
      `GOOGLE_* variables don't belong to the same OAuth client. Check the Cloudflare logs.`
  );
  const days = body?.data?.days || [];
  assert(days.length > 0, "API answered but returned no available days. Is the calendar fully booked?");
  const slots = days.reduce((sum, day) => sum + (day.slots?.length || 0), 0);
  assert(slots > 0, "API returned days without any time slots");
  console.log(`   ${days.length} days, ${slots} slots available`);
});

await check(`Session length is ${EXPECTED_SESSION_DURATION} min, offered every ${EXPECTED_SLOT_INTERVAL} min`, async () => {
  const res = await get("/api/availability");
  const body = await res.json();
  const { sessionDuration, slotInterval } = body?.data || {};
  assert(sessionDuration === EXPECTED_SESSION_DURATION, `sessionDuration is ${sessionDuration} (check SESSION_DURATION)`);
  assert(slotInterval === EXPECTED_SLOT_INTERVAL, `slotInterval is ${slotInterval} (check SLOT_INTERVAL / lib/scheduler.js)`);
});

await check("Google Analytics ID is configured (Cookie settings visible)", async () => {
  const res = await get("/cookie-consent.js");
  assert(res.status === 200, `cookie-consent.js returned ${res.status}`);
  const js = await res.text();
  const match = js.match(/var GA_ID = '([^']*)'/);
  assert(match, "GA_ID line not found in cookie-consent.js");
  assert(/^G-[A-Z0-9]+$/.test(match[1]), `GA_ID is "${match[1]}" — analytics is off and Cookie settings is hidden`);
});

await check("Visitors only see slots at least 48 h ahead", async () => {
  const res = await get("/api/availability");
  const body = await res.json();
  const { minNoticeHours, days = [] } = body?.data || {};
  assert(minNoticeHours === 48, `minNoticeHours is ${minNoticeHours} (check MIN_NOTICE_HOURS)`);
  assert((res.headers.get("cache-control") || "").includes("no-store"), "availability must not be cached");
  const first = days[0]?.slots?.[0];
  if (first) {
    const start = new Date(`${days[0].date}T${first.padStart(5, "0")}:00-03:00`);
    const earliest = Date.now() + 48 * 60 * 60 * 1000 - 5 * 60 * 1000;
    assert(start.getTime() >= earliest, `First slot ${days[0].date} ${first} is less than 48 h away`);
  }
});

await check("Security headers are sent", async () => {
  const res = await get("/");
  const expected = {
    "strict-transport-security": "max-age=",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=()"
  };
  for (const [name, fragment] of Object.entries(expected)) {
    const value = res.headers.get(name) || "";
    assert(value.includes(fragment), `${name} is "${value}"`);
  }
  const csp =
    res.headers.get("content-security-policy") ||
    res.headers.get("content-security-policy-report-only") || "";
  assert(csp.includes("frame-ancestors 'none'"), "Content-Security-Policy missing");
});

await check("No links point to pages.dev", async () => {
  for (const path of ["/", "/privacy-policy/", "/terms/"]) {
    const html = await (await get(path)).text();
    assert(!/href="https?:\/\/[^"]*pages\.dev/i.test(html), `${path} contains a link to pages.dev`);
  }
});

await check("Internal files are not published", async () => {
  const internal = [
    ["/wrangler.toml", "compatibility_date"],
    ["/lib/airtable.js", "export"],
    ["/functions/api/booking.js", "export"],
    ["/DEPLOYMENT_NOTES.md", "TesterPartner"],
    ["/package.json", "wrangler"],
    ["/.vscode/mcp.json", "servers"],
    ["/tests/smoke.mjs", "smoke"]
  ];
  for (const [path, marker] of internal) {
    const res = await get(path);
    const text = await res.text();
    assert(!(res.status === 200 && text.includes(marker)), `${path} is publicly downloadable`);
  }
});

await check("Unknown pages return 404 (not the home)", async () => {
  const res = await get("/this-page-does-not-exist-qa/");
  assert(res.status === 404, `Expected 404, got ${res.status}`);
});

await check("Test endpoints are removed", async () => {
  for (const path of ["/api/airtable-test", "/api/transcript-test"]) {
    const res = await get(path);
    const text = await res.text();
    assert(!text.includes('"connected"') && !text.includes('"transcript"'), `${path} is still active`);
  }
});

await check("Internal endpoints reject requests without the key", async () => {
  for (const path of ["/api/transcript", "/api/laxis-discovery"]) {
    const res = await fetch(BASE_URL + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Brief-ID": "QA-PROBE", ...authHeaders },
      body: JSON.stringify({ meetings: [] })
    });
    assert([401, 503].includes(res.status), `${path} answered ${res.status} without the internal key`);
  }
});

if (IS_STAGING) {
  await check("Staging is protected with a password", async () => {
    const res = await get("/", { auth: false });
    assert(
      res.status !== 503,
      "Staging is closed: STAGING_USER / STAGING_PASSWORD are missing in Cloudflare's Preview environment"
    );
    assert(res.status === 401, `Expected 401 without credentials, got ${res.status} — staging is public!`);
  });

  await check("Staging tells search engines not to index it", async () => {
    const res = await get("/");
    const robots = res.headers.get("x-robots-tag") || "";
    assert(robots.includes("noindex"), `X-Robots-Tag is "${robots}"`);
  });
}

if (IS_PRODUCTION) {
  await check("Production does not ask for a password", async () => {
    const res = await get("/", { auth: false });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await check("www redirects to the main domain (301)", async () => {
    const res = await get("/terms/?qa=1", { auth: false, base: "https://www.testerpartner.com" });
    assert(res.status === 301, `Expected 301, got ${res.status}`);
    const location = res.headers.get("location") || "";
    assert(location === "https://testerpartner.com/terms/?qa=1", `Redirects to "${location}"`);
  });

  await check("testerpartner.pages.dev is protected", async () => {
    const res = await get("/", { auth: false, base: "https://testerpartner.pages.dev" });
    assert(res.status === 401, `Expected 401, got ${res.status} — the pages.dev URL is public!`);
  });
}

/* ------------------------------------------------------------------ */

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed\n`);

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    `### Smoke tests — ${BASE_URL}`,
    "",
    "| Check | Result |",
    "|---|---|",
    ...results.map((r) => `| ${r.name} | ${r.ok ? "✅" : `❌ ${r.error.replace(/\|/g, "\\|")}`} |`),
    ""
  ];
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n"));
}

process.exit(failed.length ? 1 : 0);
