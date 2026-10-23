// /lab/feed.xml — RSS feed with published stories only.
import { renderFeed } from "../../lib/lab-render.js";

export async function onRequestGet() {
  return new Response(renderFeed(), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300"
    }
  });
}
