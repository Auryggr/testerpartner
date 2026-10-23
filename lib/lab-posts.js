/*
 * Civic Friction Lab — list of stories and when each one goes live.
 *
 * - The page for each story lives in public/lab/<slug>/index.html.
 * - Before `publishAt`, the story answers 404 on testerpartner.com and is
 *   hidden from /lab/, the sitemap and the feed. It is always visible on
 *   staging (password protected) and with the QA cookie (tp_qa), so the
 *   owner can review scheduled stories.
 * - `spotifyUrl`: paste the episode link when it exists; the page shows a
 *   "Listen on Spotify" link automatically. Leave "" when there is none.
 *
 * Times are UTC. 13:00Z = 9:00 New York (until Nov 1) / 8:00 after DST ends.
 */

export const LAB_POSTS = [
  {
    slug: "the-price-on-the-door",
    number: 1,
    title: "The price on the door",
    description:
      "A passport renewal page that answers who it's for, what it costs and what can go wrong before you click anything, and what your product page can learn from it.",
    pattern: "Benchmark",
    publishAt: "2026-10-26T13:00:00Z",
    observedOn: "2026-10-23",
    spotifyUrl: ""
  },
  {
    slug: "eight-yeses-before-you-can-start",
    number: 2,
    title: "Eight yeses before you can start",
    description:
      "An online renewal that asks you to confirm eight conditions at once, and the checkout version of the same problem: rules your customers discover too late.",
    pattern: "Hidden requirements",
    publishAt: "2026-10-27T13:00:00Z",
    observedOn: "2026-10-23",
    spotifyUrl: ""
  }
];

export function findLabPost(slug) {
  return LAB_POSTS.find((post) => post.slug === slug) || null;
}

export function isPublished(post, now = Date.now()) {
  return Date.parse(post.publishAt) <= now;
}
