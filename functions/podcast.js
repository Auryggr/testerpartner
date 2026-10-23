/*
 * testerpartner.com/podcast — short address to say out loud in episodes.
 * Redirects to the Lab with campaign tags, so visits from the podcast
 * show up as utm_source=spotify (the app rarely sends a referrer).
 * Optional: /podcast?ep=03 adds utm_content=ep03.
 */
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const episode = (url.searchParams.get("ep") || "").replace(/[^0-9]/g, "").slice(0, 3);

  const target = new URL("/lab/", url.origin);
  target.searchParams.set("utm_source", "spotify");
  target.searchParams.set("utm_medium", "podcast");
  target.searchParams.set("utm_campaign", "civic_friction_lab");
  if (episode) target.searchParams.set("utm_content", `ep${episode.padStart(2, "0")}`);

  return Response.redirect(target.toString(), 302);
}
