(function () {
  'use strict';

  /* ------------------------------------------------------------------
     CONFIG
     ------------------------------------------------------------------ */

  var GA_ID = 'G-1N54NNMXGP'; // GA4 Measurement ID (public, not a secret)

  /*
   * true  (recommended): the first layer shows a discreet
   *        "Continue without analytics" link. One click to decline,
   *        but with much less visual weight than "Accept".
   * false: declining is only possible inside "Preferences"
   *        (two clicks). Higher legal risk for EU/UK visitors.
   */
  var SHOW_DECLINE_ON_FIRST_LAYER = true;

  /*
   * Countries (ISO codes) where analytics runs by default with an opt-out.
   * Keep this list short: only add a country after checking its rules.
   */
  var OPT_OUT_COUNTRIES = ['US'];

  var STORAGE_KEY = 'tp_cookie_consent'; // 'granted' | 'denied'
  var REGION_CACHE_KEY = 'tp_cookie_country';
  var POLICY_URL = '/privacy-policy/';

  // 'optin' (strict, default) or 'optout'. Set after detection.
  var mode = 'optin';

  /* ------------------------------------------------------------------
     STORAGE (safe if blocked)
     ------------------------------------------------------------------ */

  function readChoice() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function saveChoice(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------
     REGION DETECTION
     ------------------------------------------------------------------ */

  function hasGlobalPrivacyControl() {
    return navigator.globalPrivacyControl === true;
  }

  function browserTimeZoneIsEurope() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      return tz.indexOf('Europe/') === 0;
    } catch (e) {
      return false;
    }
  }

  function countryFromUrl() {
    var match = /[?&]cookie_region=([A-Za-z]{2})\b/.exec(location.search);
    return match ? match[1].toUpperCase() : '';
  }

  // Resolves with a 2-letter country code, or '' when unknown.
  function detectCountry() {
    var forced = countryFromUrl();
    if (forced) return Promise.resolve(forced);

    try {
      var cached = sessionStorage.getItem(REGION_CACHE_KEY);
      if (cached) return Promise.resolve(cached);
    } catch (e) { /* ignore */ }

    if (!window.fetch) return Promise.resolve('');

    return new Promise(function (resolve) {
      var finished = false;
      function finish(country) {
        if (finished) return;
        finished = true;
        if (country) {
          try { sessionStorage.setItem(REGION_CACHE_KEY, country); } catch (e) { /* ignore */ }
        }
        resolve(country);
      }

      // Never keep the visitor waiting: unknown after 1.5 s means strict mode.
      setTimeout(function () { finish(''); }, 1500);

      fetch('/cdn-cgi/trace', { cache: 'no-store', credentials: 'omit' })
        .then(function (response) { return response.ok ? response.text() : ''; })
        .then(function (text) {
          var match = /^loc=([A-Z]{2})$/m.exec(text || '');
          finish(match ? match[1] : '');
        })
        .catch(function () { finish(''); });
    });
  }

  function resolveMode(country) {
    if (!country) return 'optin';
    if (browserTimeZoneIsEurope()) return 'optin';
    return OPT_OUT_COUNTRIES.indexOf(country) !== -1 ? 'optout' : 'optin';
  }

  /*
   * Shared region lookup for other scripts (e.g. the booking form).
   * Runs at most once per page, even if GA_ID is empty.
   *   window.tpGetRegion().then(function (r) {
   *     r.country -> 'US', 'DE', '' (unknown)
   *     r.mode    -> 'optout' | 'optin'
   *     r.gpc     -> true if the browser sends Global Privacy Control
   *   });
   */
  var regionPromise = null;

  function getRegion() {
    if (!regionPromise) {
      regionPromise = detectCountry().then(function (country) {
        return {
          country: country,
          mode: resolveMode(country),
          gpc: hasGlobalPrivacyControl()
        };
      });
    }
    return regionPromise;
  }

  window.tpGetRegion = getRegion;

  // Is analytics allowed right now for this visitor?
  function analyticsAllowed() {
    var choice = readChoice();
    if (choice === 'granted') return true;
    if (choice === 'denied') return false;
    if (mode === 'optout') return !hasGlobalPrivacyControl();
    return false;
  }

  /* ------------------------------------------------------------------
     GOOGLE CONSENT MODE v2 — everything denied by default
     ------------------------------------------------------------------ */

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied'
  });

  var gaLoaded = false;

  function loadAnalytics() {
    if (gaLoaded || !GA_ID) return;
    gaLoaded = true;
    window['ga-disable-' + GA_ID] = false;
    gtag('consent', 'update', { analytics_storage: 'granted' });

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(s);

    gtag('js', new Date());
    gtag('config', GA_ID, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
  }

  function clearAnalyticsCookies() {
    var host = location.hostname;
    var expired = '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    document.cookie.split(';').forEach(function (part) {
      var name = part.split('=')[0].trim();
      if (name === '_ga' || name === '_gid' || name.indexOf('_ga_') === 0) {
        document.cookie = name + expired;
        document.cookie = name + expired + '; domain=' + host;
        document.cookie = name + expired + '; domain=.' + host;
      }
    });
  }

  function grant() {
    saveChoice('granted');
    hideBanner();
    loadAnalytics();
  }

  function deny() {
    var wasLoaded = gaLoaded;
    saveChoice('denied');
    gtag('consent', 'update', { analytics_storage: 'denied' });
    if (GA_ID) window['ga-disable-' + GA_ID] = true;
    clearAnalyticsCookies();
    hideBanner();
    // If Analytics was already running on this page, reload so it stops completely.
    if (wasLoaded) location.reload();
  }

  /* ------------------------------------------------------------------
     UI — TesterPartner brand
     ------------------------------------------------------------------ */

  var root = null;

  function injectStyles() {
    if (document.getElementById('tp-cc-style')) return;
    var css = [
      '.tp-cc{',
      '  --tp-navy:#111520;--tp-navy-2:#171b25;--tp-orange:#f19962;',
      '  --tp-cream:#f1ede6;--tp-muted:rgba(241,237,230,.66);--tp-line:rgba(241,237,230,.14);',
      '  position:fixed;left:24px;bottom:24px;z-index:99999;width:min(380px,calc(100vw - 32px));',
      '  background:var(--tp-navy);color:var(--tp-cream);border:1px solid var(--tp-line);border-radius:4px;',
      '  box-shadow:0 18px 50px rgba(0,0,0,.35);padding:18px 18px 16px;',
      '  font-family:inherit;font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;',
      '  animation:tp-cc-in .28s ease-out both}',
      '@keyframes tp-cc-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
      '@media (prefers-reduced-motion:reduce){.tp-cc{animation:none}}',
      '@media (max-width:480px){.tp-cc{left:16px;right:16px;bottom:16px;width:auto}}',
      '.tp-cc *{box-sizing:border-box}',
      '.tp-cc-eyebrow{margin:0 0 8px;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--tp-orange)}',
      '.tp-cc-text{margin:0 0 14px;color:var(--tp-muted)}',
      '.tp-cc-text strong{color:var(--tp-cream);font-weight:700}',
      '.tp-cc a{color:var(--tp-cream);text-decoration:underline;text-underline-offset:2px}',
      '.tp-cc a:hover{color:var(--tp-orange)}',
      '.tp-cc-actions{display:flex;gap:8px}',
      '.tp-cc-btn{flex:1 1 0;cursor:pointer;font:inherit;font-weight:700;font-size:14px;padding:10px 12px;border-radius:3px;',
      '  border:1px solid var(--tp-line);background:var(--tp-navy-2);color:var(--tp-cream);transition:border-color .15s,background .15s}',
      '.tp-cc-btn:hover{border-color:rgba(241,237,230,.4)}',
      '.tp-cc-btn--primary{background:var(--tp-orange);border-color:var(--tp-orange);color:var(--tp-navy)}',
      '.tp-cc-btn--primary:hover{background:#f4ab7c;border-color:#f4ab7c}',
      '.tp-cc-btn:focus-visible,.tp-cc-link:focus-visible,.tp-cc-switch input:focus-visible+span{outline:2px solid var(--tp-orange);outline-offset:2px}',
      '.tp-cc-link{display:inline-block;margin-top:12px;padding:0;border:0;background:none;cursor:pointer;',
      '  font:inherit;font-size:13px;color:var(--tp-muted);text-decoration:underline;text-underline-offset:2px}',
      '.tp-cc-link:hover{color:var(--tp-cream)}',
      '.tp-cc-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:12px 0;border-top:1px solid var(--tp-line)}',
      '.tp-cc-row:last-of-type{border-bottom:1px solid var(--tp-line);margin-bottom:14px}',
      '.tp-cc-row h4{margin:0 0 2px;font-size:14px;font-weight:700;color:var(--tp-cream)}',
      '.tp-cc-row p{margin:0;font-size:13px;color:var(--tp-muted)}',
      '.tp-cc-always{flex:none;font-size:12px;font-weight:700;color:var(--tp-muted);white-space:nowrap;padding-top:2px}',
      '.tp-cc-switch{flex:none;position:relative;display:inline-block;width:40px;height:22px;margin-top:2px}',
      '.tp-cc-switch input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer}',
      '.tp-cc-switch span{position:absolute;inset:0;border-radius:22px;background:var(--tp-navy-2);border:1px solid var(--tp-line);transition:background .15s;pointer-events:none}',
      '.tp-cc-switch span::after{content:"";position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:var(--tp-cream);transition:transform .15s}',
      '.tp-cc-switch input:checked+span{background:var(--tp-orange);border-color:var(--tp-orange)}',
      '.tp-cc-switch input:checked+span::after{transform:translateX(18px);background:var(--tp-navy)}',
      '[hidden].tp-cc-view{display:none}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = 'tp-cc-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function build() {
    root = document.createElement('div');
    root.className = 'tp-cc';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Cookie preferences');

    var declineLink = SHOW_DECLINE_ON_FIRST_LAYER
      ? '<button type="button" class="tp-cc-link" data-tp-cc="decline">Continue without analytics</button>'
      : '';

    root.innerHTML =
      // ---- Layer 1: summary ----
      '<div class="tp-cc-view" data-tp-cc-view="summary">' +
        '<p class="tp-cc-eyebrow">Cookies</p>' +
        '<p class="tp-cc-text"><strong>Help us make this site more useful.</strong> ' +
        'With your OK, anonymous analytics show us which parts help teams decide. ' +
        'No ads, no cross-site tracking. <a href="' + POLICY_URL + '">Privacy Policy</a></p>' +
        '<div class="tp-cc-actions">' +
          '<button type="button" class="tp-cc-btn" data-tp-cc="prefs">Preferences</button>' +
          '<button type="button" class="tp-cc-btn tp-cc-btn--primary" data-tp-cc="accept">Accept</button>' +
        '</div>' +
        declineLink +
      '</div>' +
      // ---- Layer 2: preferences ----
      '<div class="tp-cc-view" data-tp-cc-view="prefs" hidden>' +
        '<p class="tp-cc-eyebrow">Cookie preferences</p>' +
        '<div class="tp-cc-row">' +
          '<div><h4>Necessary</h4><p>Keep the site secure and working. Always on.</p></div>' +
          '<span class="tp-cc-always">Always on</span>' +
        '</div>' +
        '<div class="tp-cc-row">' +
          '<div><h4 id="tp-cc-analytics-label">Analytics</h4>' +
          '<p>Google Analytics, anonymous usage statistics. No ads.</p></div>' +
          '<label class="tp-cc-switch">' +
            '<input type="checkbox" role="switch" aria-labelledby="tp-cc-analytics-label" data-tp-cc="analytics-toggle">' +
            '<span></span>' +
          '</label>' +
        '</div>' +
        '<div class="tp-cc-actions">' +
          '<button type="button" class="tp-cc-btn" data-tp-cc="save">Save choices</button>' +
          '<button type="button" class="tp-cc-btn tp-cc-btn--primary" data-tp-cc="accept">Accept all</button>' +
        '</div>' +
      '</div>';

    root.addEventListener('click', function (event) {
      var target = event.target.closest('[data-tp-cc]');
      if (!target) return;
      var action = target.getAttribute('data-tp-cc');
      if (action === 'accept') grant();
      else if (action === 'decline') deny();
      else if (action === 'prefs') showView('prefs');
      else if (action === 'save') {
        var toggle = root.querySelector('[data-tp-cc="analytics-toggle"]');
        if (toggle && toggle.checked) grant(); else deny();
      }
    });

    document.body.appendChild(root);
  }

  function showView(name) {
    var views = root.querySelectorAll('[data-tp-cc-view]');
    for (var i = 0; i < views.length; i++) {
      views[i].hidden = views[i].getAttribute('data-tp-cc-view') !== name;
    }
    if (name === 'prefs') {
      // Reflects the visitor's real current state:
      // opt-in regions start off; opt-out regions start on (unless GPC or declined).
      var toggle = root.querySelector('[data-tp-cc="analytics-toggle"]');
      if (toggle) toggle.checked = analyticsAllowed();
      var save = root.querySelector('[data-tp-cc="save"]');
      if (save) save.focus();
    } else {
      var accept = root.querySelector('[data-tp-cc-view="summary"] [data-tp-cc="accept"]');
      if (accept) accept.focus();
    }
  }

  function showBanner(view) {
    if (!GA_ID) return;
    injectStyles();
    if (!root) build();
    root.style.display = '';
    showView(view || 'summary');
  }

  function hideBanner() {
    if (root) root.style.display = 'none';
  }

  /* ------------------------------------------------------------------
     "Cookie settings" links open the preferences layer directly
     ------------------------------------------------------------------ */

  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('[data-cookie-settings]');
    if (!link) return;
    event.preventDefault();
    showBanner('prefs');
  });

  function init() {
    var links = document.querySelectorAll('[data-cookie-settings]');
    if (!GA_ID) {
      // Analytics not configured yet: nothing to consent to.
      for (var i = 0; i < links.length; i++) {
        var el = links[i].closest('[data-cookie-settings-wrap]') || links[i];
        el.style.display = 'none';
      }
      return;
    }
    // A visitor who already chose doesn't need the region at all.
    var choice = readChoice();
    if (choice === 'granted') { loadAnalytics(); return; }
    if (choice === 'denied') return;

    getRegion().then(function (region) {
      mode = region.mode;

      if (mode === 'optout') {
        // US: on by default, no banner. GPC means "off".
        if (analyticsAllowed()) loadAnalytics();
        return;
      }

      // Everyone else: ask first. A GPC signal counts as a "no".
      if (hasGlobalPrivacyControl()) return;
      showBanner('summary');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();