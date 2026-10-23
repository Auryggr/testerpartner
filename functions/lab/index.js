// /lab/ — index of published Civic Friction Lab stories (see lib/lab-posts.js).
import { renderIndex } from "../../lib/lab-render.js";
import { isLabPreview } from "../../lib/lab-gate.js";

export async function onRequestGet(context) {
  const preview = isLabPreview(context.request, context.env);
  return new Response(renderIndex({ preview }), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": preview ? "no-store" : "public, max-age=0, must-revalidate"
    }
  });
}
