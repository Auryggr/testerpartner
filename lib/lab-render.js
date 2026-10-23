/*
 * Civic Friction Lab — pages generated from lib/lab-posts.js:
 * the /lab/ index, the sitemap and the RSS feed.
 */

import { LAB_POSTS, isPublished } from "./lab-posts.js";

export const SITE = "https://testerpartner.com";

const STATIC_PAGES = ["/", "/lab/", "/privacy-policy/", "/terms/"];

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pad(number) {
  return String(number).padStart(2, "0");
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York"
  });
}

// Stories a visitor can see now (or all of them in preview), newest first.
export function visiblePosts({ preview = false, now = Date.now() } = {}) {
  return LAB_POSTS
    .filter((post) => preview || isPublished(post, now))
    .sort((a, b) => Date.parse(b.publishAt) - Date.parse(a.publishAt));
}

export const LAB_HEADER = `<header class="site-header">
  <div class="container header-content">
    <a href="/" class="logo">Tester<span>Partner</span></a>
    <nav class="main-nav" aria-label="Primary navigation">
      <a href="/lab/">Civic Friction Lab</a>
      <a href="/#how-it-works">How it works</a>
      <a href="/#example">Example</a>
      <a href="/#faq">FAQ</a>
    </nav>
    <a class="btn btn-primary" href="/?ref=lab_header#book" data-lab-book="lab_header">Book a Free Session</a>
  </div>
</header>`;

export const LAB_FOOTER = `<footer class="footer"><div class="container footer-content"><div><strong>TesterPartner</strong><p>Evidence before assumptions.</p></div><nav><a href="/lab/">Civic Friction Lab</a><a href="/#how-it-works">How it works</a><a href="/#faq">FAQ</a><a href="/privacy-policy/">Privacy</a><a href="/terms/">Terms</a><a href="#" data-cookie-settings>Cookie settings</a></nav><div class="footer-meta">© 2026 TesterPartner</div></div></footer>`;

export function renderIndex({ preview = false, now = Date.now() } = {}) {
  const posts = visiblePosts({ preview, now });

  const cards = posts.length
    ? posts.map((post) => {
        const scheduled = !isPublished(post, now);
        return `<a class="lab-card" href="/lab/${post.slug}/">
      <span class="lab-card-num">${pad(post.number)}</span>
      <span class="lab-card-pattern">${escapeHtml(post.pattern)}</span>
      <h2>${escapeHtml(post.title)}</h2>
      <p>${escapeHtml(post.description)}</p>
      <span class="lab-card-date">${scheduled ? `<span class="lab-card-scheduled">Scheduled · </span>` : ""}${formatDate(post.publishAt)}</span>
    </a>`;
      }).join("\n    ")
    : `<p class="lab-empty">The first story is on its way. Come back soon.</p>`;

  const banner = preview
    ? `<div class="lab-preview">Preview: you can see scheduled stories. Visitors only see published ones.</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Civic Friction Lab | TesterPartner</title>
  <meta name="description" content="Stories about friction in public services, the hypotheses we'd test and what they teach about ecommerce conversion. A book written in public by TesterPartner.">
  <link rel="canonical" href="${SITE}/lab/">
  <link rel="alternate" type="application/rss+xml" title="Civic Friction Lab" href="/lab/feed.xml">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Civic Friction Lab | TesterPartner">
  <meta property="og:description" content="Bureaucracy is friction in its purest form. One story at a time: the evidence, the hypotheses, and the same friction in your ecommerce.">
  <meta property="og:url" content="${SITE}/lab/">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/style.css">
  <link rel="stylesheet" href="/lab/lab.css">
  <script src="/cookie-consent.js" defer></script>
  <script src="/lab/lab.js" defer></script>
</head>
<body class="lab">
${banner}
${LAB_HEADER}
<main>
  <section class="lab-index-hero">
    <div class="lab-wide">
      <p class="lab-kicker"><span class="lab-dot"></span>A book written in public</p>
      <h1>Civic Friction <em>Lab</em></h1>
      <p>Bureaucracy is friction in its purest form. Each story follows one public service journey: the evidence we observed, the hypotheses we'd test, how we'd validate them without an A/B test, and the same friction in your ecommerce.</p>
    </div>
  </section>
  <section class="lab-wide lab-list" aria-label="Stories">
    ${cards}
  </section>
</main>
${LAB_FOOTER}
</body>
</html>`;
}

export function renderSitemap({ now = Date.now() } = {}) {
  const urls = [
    ...STATIC_PAGES.map((path) => ({ loc: SITE + path })),
    ...visiblePosts({ now }).map((post) => ({
      loc: `${SITE}/lab/${post.slug}/`,
      lastmod: post.publishAt.slice(0, 10)
    }))
  ];
  const body = urls
    .map((url) => `  <url><loc>${escapeHtml(url.loc)}</loc>${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ""}</url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

export function renderFeed({ now = Date.now() } = {}) {
  const items = visiblePosts({ now })
    .map((post) => `    <item>
      <title>${escapeHtml(`Story ${pad(post.number)}: ${post.title}`)}</title>
      <link>${SITE}/lab/${post.slug}/</link>
      <guid isPermaLink="true">${SITE}/lab/${post.slug}/</guid>
      <pubDate>${new Date(post.publishAt).toUTCString()}</pubDate>
      <description>${escapeHtml(post.description)}</description>
    </item>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Civic Friction Lab | TesterPartner</title>
    <link>${SITE}/lab/</link>
    <description>Stories about friction in public services and what they teach about ecommerce conversion.</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;
}
