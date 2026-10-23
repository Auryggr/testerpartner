// /sitemap.xml — main pages plus published Civic Friction Lab stories.
import { renderSitemap } from "../lib/lab-render.js";

export async function onRequestGet() {
  return new Response(renderSitemap(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300"
    }
  });
}
