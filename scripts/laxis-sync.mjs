#!/usr/bin/env node
/*
 * TesterPartner — send Laxis data to the internal endpoints.
 *
 * Adds the X-TesterPartner-Key header automatically, reading INTERNAL_API_KEY
 * from the environment or from .dev.vars. The key is never printed.
 *
 * Commands
 *   node scripts/laxis-sync.mjs discover <meetings.json> [--staging]
 *       Sends Laxis meetings to /api/laxis-discovery so they are matched
 *       with Opportunity Briefs in Airtable. The file may contain an array
 *       of meetings or an object { "meetings": [...] }. Each meeting needs
 *       at least: id, title, createdTime (optional: duration, noteUrl, status).
 *
 *   node scripts/laxis-sync.mjs transcript <BRIEF_ID> <transcript.txt> [--staging]
 *       Sends a transcript to /api/transcript for that Brief ID (e.g. TP-3DE91A5E).
 *
 * Options
 *   --staging          Use https://staging.testerpartner.pages.dev
 *                      (STAGING_USER / STAGING_PASSWORD from env or .dev.vars)
 *   --base <url>       Use another base URL (e.g. http://localhost:8788)
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PRODUCTION = "https://testerpartner.com";
const STAGING = "https://staging.testerpartner.pages.dev";

function loadDevVars() {
  const path = resolve(process.cwd(), ".dev.vars");
  if (!existsSync(path)) return {};

  const vars = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match) continue;
    vars[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return vars;
}

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const flags = {
  staging: args.includes("--staging"),
  base: args.includes("--base") ? args[args.indexOf("--base") + 1] : ""
};
const positional = args.filter(
  (arg, i) => !arg.startsWith("--") && args[i - 1] !== "--base"
);
const [command, ...rest] = positional;

const devVars = loadDevVars();
const env = (name) => process.env[name] || devVars[name] || "";

const key = env("INTERNAL_API_KEY");
if (!key) {
  fail("INTERNAL_API_KEY not found. Add it to .dev.vars (INTERNAL_API_KEY=...) or export it.");
}

const base = (flags.base || (flags.staging ? STAGING : PRODUCTION)).replace(/\/$/, "");

const headers = { "X-TesterPartner-Key": key };

if (base.includes(".pages.dev")) {
  const user = env("STAGING_USER") || "testerpartner";
  const password = env("STAGING_PASSWORD");
  if (!password) fail("STAGING_PASSWORD not found in .dev.vars or the environment.");
  headers.Authorization = "Basic " + Buffer.from(`${user}:${password}`).toString("base64");
}

async function send(path, init) {
  const response = await fetch(base + path, {
    method: "POST",
    ...init,
    headers: { ...headers, ...(init.headers || {}) }
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 500);
  }

  if (response.status === 401) fail(`${path}: 401 — the key was rejected. Check INTERNAL_API_KEY matches Cloudflare.`);
  if (response.status === 503) fail(`${path}: 503 — INTERNAL_API_KEY is not configured in Cloudflare for this environment.`);

  console.log(`${response.ok ? "✔" : "✖"} ${base}${path} → HTTP ${response.status}`);
  console.log(typeof body === "string" ? body : JSON.stringify(body, null, 2));
  if (!response.ok) process.exit(1);
}

if (command === "discover") {
  const [file] = rest;
  if (!file) fail("Usage: node scripts/laxis-sync.mjs discover <meetings.json> [--staging]");

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    fail(`Could not read ${file} as JSON: ${error.message}`);
  }

  const meetings = Array.isArray(parsed) ? parsed : parsed?.meetings;
  if (!Array.isArray(meetings) || !meetings.length) fail("No meetings found in the file.");
  const missing = meetings.filter((m) => !m?.id || !m?.title);
  if (missing.length) fail(`${missing.length} meeting(s) have no id or title.`);

  console.log(`Sending ${meetings.length} meeting(s) to ${base}/api/laxis-discovery…`);
  await send("/api/laxis-discovery", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meetings })
  });
} else if (command === "transcript") {
  const [briefId, file] = rest;
  if (!briefId || !file) {
    fail("Usage: node scripts/laxis-sync.mjs transcript <BRIEF_ID> <transcript.txt> [--staging]");
  }
  if (!/^TP-[A-Z0-9]+$/i.test(briefId)) fail(`"${briefId}" doesn't look like a Brief ID (TP-XXXXXXXX).`);

  const content = readFileSync(file, "utf8");
  if (!content.trim()) fail(`${file} is empty.`);

  console.log(`Sending transcript (${content.length} characters) for ${briefId}…`);
  await send("/api/transcript", {
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Brief-ID": briefId },
    body: content
  });
} else {
  console.log(readFileSync(new URL(import.meta.url), "utf8").split("*/")[0].replace(/^#!.*\n\/\*\s?/, ""));
  process.exit(command ? 1 : 0);
}
