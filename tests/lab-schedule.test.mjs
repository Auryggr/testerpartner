/*
 * TesterPartner — unit tests for Civic Friction Lab scheduling (no deps).
 * Simulates Cloudflare Pages requests for production, staging and the
 * QA cookie, before and after a story's publish date.
 *
 *   node tests/lab-schedule.test.mjs
 */

import { readFileSync } from "node:fs";
import { LAB_POSTS, isPublished } from "../lib/lab-posts.js";
import { handleLabStory, isLabPreview } from "../lib/lab-gate.js";
import { renderIndex, renderSitemap, renderFeed } from "../lib/lab-render.js";
import { onRequestGet as podcast } from "../functions/podcast.js";

const results = [];
function check(name, condition) {
  results.push({ name, ok: Boolean(condition) });
  console.log(`${condition ? "✅" : "❌"} ${name}`);
}

const QA_TOKEN = "test-token-not-a-secret";
const env = {
  QA_BYPASS_TOKEN: QA_TOKEN,
  ASSETS: { fetch: async () => new Response("<h1>Page not found</h1>", { headers: { "Content-Type": "text/html" } }) }
};

function storyHtml(slug) {
  return readFileSync(new URL(`../public/lab/${slug}/index.html`, import.meta.url), "utf8");
}

function context(url, { cookie = "" } = {}) {
  const slug = new URL(url).pathname.split("/")[2];
  return {
    request: new Request(url, { headers: cookie ? { Cookie: cookie } : {} }),
    env,
    next: async () => new Response(storyHtml(slug), { headers: { "Content-Type": "text/html; charset=utf-8" } })
  };
}

async function visit(url, options) {
  const ctx = context(url, options);
  return handleLabStory(ctx, isLabPreview(ctx.request, env));
}

const realNow = Date.now;
const first = LAB_POSTS[0];
const second = LAB_POSTS[1];
const before = Date.parse(first.publishAt) - 60 * 1000;
const after = Date.parse(first.publishAt) + 60 * 1000;

// Every post in the list has its page, title and booking ref.
for (const post of LAB_POSTS) {
  const html = storyHtml(post.slug);
  check(`${post.slug}: page exists with its title`, html.includes(`<h1>${post.title}</h1>`));
  check(`${post.slug}: CTA ref lab_story_${String(post.number).padStart(2, "0")}`, html.includes(`data-lab-book="lab_story_${String(post.number).padStart(2, "0")}"`));
  check(`${post.slug}: datePublished matches the schedule`, html.includes(`"datePublished": "${post.publishAt}"`));
  check(`${post.slug}: has preview and listen markers`, html.includes("<!--LAB:PREVIEW-->") && html.includes("<!--LAB:LISTEN-->"));
}

// Before the date
Date.now = () => before;
let res = await visit(`https://testerpartner.com/lab/${first.slug}/`);
check("production, before date: 404", res.status === 404);
res = await visit(`https://staging.testerpartner.pages.dev/lab/${first.slug}/`);
let text = await res.text();
check("staging, before date: visible with preview banner", res.status === 200 && text.includes("Preview: scheduled for"));
res = await visit(`https://testerpartner.com/lab/${first.slug}/`, { cookie: `tp_qa=${QA_TOKEN}` });
check("production + QA cookie, before date: visible", res.status === 200);
res = await visit(`https://testerpartner.com/lab/${first.slug}/`, { cookie: "tp_qa=wrong" });
check("production + wrong QA cookie: 404", res.status === 404);
check("index before date: no stories listed", !renderIndex().includes(`/lab/${first.slug}/`));
check("index preview before date: story listed as scheduled", renderIndex({ preview: true }).includes("Scheduled"));
check("sitemap before date: story absent", !renderSitemap().includes(first.slug));
check("feed before date: story absent", !renderFeed().includes(first.slug));

// After the date
Date.now = () => after;
res = await visit(`https://testerpartner.com/lab/${first.slug}/`);
text = await res.text();
check("production, after date: 200", res.status === 200);
check("published page has no preview banner or markers", !text.includes("Preview:") && !text.includes("<!--LAB:"));
check("no Spotify link while spotifyUrl is empty", !text.includes("Listen on Spotify"));
res = await visit(`https://testerpartner.com/lab/${first.slug}`);
check("production, no trailing slash: 200", res.status === 200);
res = await visit(`https://testerpartner.com/lab/${second.slug}/`);
check("next story still 404 the day before it", res.status === 404);
check("index after date: story 01 listed, 02 not", renderIndex().includes(`/lab/${first.slug}/`) && !renderIndex().includes(`/lab/${second.slug}/`));
check("sitemap after date: story 01 present", renderSitemap().includes(`https://testerpartner.com/lab/${first.slug}/`));
check("feed after date: story 01 present", renderFeed().includes(`<link>https://testerpartner.com/lab/${first.slug}/</link>`));
check("sitemap always lists home and legal pages", ["/", "/privacy-policy/", "/terms/", "/lab/"].every((p) => renderSitemap().includes(`https://testerpartner.com${p}<`)));

// Spotify link appears automatically once filled in
first.spotifyUrl = "https://open.spotify.com/episode/abc123";
res = await visit(`https://testerpartner.com/lab/${first.slug}/`);
check("Spotify link shown when spotifyUrl is set", (await res.text()).includes('href="https://open.spotify.com/episode/abc123"'));
first.spotifyUrl = "javascript:alert(1)";
res = await visit(`https://testerpartner.com/lab/${first.slug}/`);
check("non-Spotify URL is ignored", !(await res.text()).includes("javascript:"));
first.spotifyUrl = "";

// Other URLs are left alone
res = await handleLabStory({ request: new Request("https://testerpartner.com/lab/lab.css"), env, next: async () => new Response("") }, false);
check("assets under /lab/ are not intercepted", res === null);
res = await handleLabStory({ request: new Request("https://testerpartner.com/"), env, next: async () => new Response("") }, false);
check("home page is not intercepted", res === null);

// Podcast short link
res = await podcast({ request: new Request("https://testerpartner.com/podcast?ep=3") });
const location = res.headers.get("Location") || "";
check("/podcast redirects with spotify tags", res.status === 302 && location.includes("utm_source=spotify") && location.includes("utm_medium=podcast") && location.includes("utm_content=ep03"));

// Dates are in order, one per day
const days = LAB_POSTS.map((p) => p.publishAt.slice(0, 10));
check("one story per day, no duplicates", new Set(days).size === days.length);
check("isPublished uses the publish date", !isPublished(second, before) && isPublished(first, after));

Date.now = realNow;
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed\n`);
process.exit(failed.length ? 1 : 0);
