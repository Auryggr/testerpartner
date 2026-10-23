/*
 * Civic Friction Lab — publishing gate, used by functions/_middleware.js.
 *
 * Story pages are static files in public/lab/<slug>/. Before their
 * publishAt date (lib/lab-posts.js) they answer 404 on the live site.
 * Staging (password protected) and the QA cookie see everything, with a
 * "scheduled" banner, so stories can be reviewed before they go live.
 */

import { findLabPost, isPublished } from "./lab-posts.js";
import { isQaRequest } from "./qa-mode.js";

const STORY_PATH = /^\/lab\/([a-z0-9-]+)\/?(?:index\.html)?$/;
const SPOTIFY_URL = /^https:\/\/open\.spotify\.com\/[A-Za-z0-9/_?=&.-]+$/;

export function isLabPreview(request, env) {
  const { hostname } = new URL(request.url);
  return hostname.endsWith(".pages.dev") || isQaRequest(request, env);
}

async function notFound(context) {
  const { request, env } = context;
  let body = "Page not found";
  let type = "text/plain; charset=utf-8";
  try {
    const page = await env.ASSETS.fetch(new URL("/404.html", request.url));
    if (page.ok) {
      body = await page.text();
      type = "text/html; charset=utf-8";
    }
  } catch {
    /* fall back to plain text */
  }
  return new Response(body, {
    status: 404,
    headers: { "Content-Type": type, "Cache-Control": "no-store" }
  });
}

function listenLink(post) {
  if (!post.spotifyUrl || !SPOTIFY_URL.test(post.spotifyUrl)) return "";
  return `<a class="lab-listen" href="${post.spotifyUrl}" rel="noopener" target="_blank">▶ Listen on Spotify</a>`;
}

function previewBanner(post) {
  const when = new Date(post.publishAt).toUTCString();
  return `<div class="lab-preview">Preview: scheduled for ${when}. Visitors get a 404 until then.</div>`;
}

/*
 * Returns a Response for story URLs, or null for everything else
 * (the middleware then serves the request normally).
 */
export async function handleLabStory(context, preview) {
  const { pathname } = new URL(context.request.url);
  const match = STORY_PATH.exec(pathname);
  if (!match) return null;

  const post = findLabPost(match[1]);
  if (!post) return null;

  const live = isPublished(post);
  if (!live && !preview) return notFound(context);

  const response = await context.next();
  const type = response.headers.get("Content-Type") || "";
  if (!response.ok || !type.includes("text/html")) return response;

  const html = (await response.text())
    .replace("<!--LAB:LISTEN-->", listenLink(post))
    .replace("<!--LAB:PREVIEW-->", live ? "" : previewBanner(post));

  const headers = new Headers(response.headers);
  headers.delete("Content-Length");
  headers.delete("ETag");
  if (!live) headers.set("Cache-Control", "no-store");

  return new Response(html, { status: response.status, headers });
}
