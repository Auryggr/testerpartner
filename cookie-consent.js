(function () {
  'use strict';

  var GA_ID = 'G-1N54NNMXGP'; // e.g. 'G-XXXXXXXXXX'
  var STORAGE_KEY = 'tp_cookie_consent'; // 'granted' | 'denied'
  var POLICY_URL = '/privacy-policy/';

  // ---------- storage (safe if blocked) ----------
  function readChoice() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function saveChoice(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (e) { /* ignore */ }
  }

  // ---------- Google Consent Mode v2: everything denied by default ----------
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

  function accept() {
    saveChoice('granted');
    hideBanner();
    loadAnalytics();
  }

  function reject() {
    var wasLoaded = gaLoaded;
    saveChoice('denied');
    gtag('consent', 'update', { analytics_storage: 'denied' });
    if (GA_ID) window['ga-disable-' + GA_ID] = true;
    clearAnalyticsCookies();
    hideBanner();
    // If Analytics was already running on this page, reload so it stops completely.
    if (wasLoaded) location.reload();
  }

  // ---------- banner UI ----------
  var banner = null;

  function injectStyles() {
    if (document.getElementById('tp-cc-style')) return;
    var css =
      '.tp-cc{position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;max-width:560px;margin:0 auto;' +
      'background:#ffffff;color:#1d1d1f;border:1px solid #e3e3e6;border-radius:12px;' +
      'box-shadow:0 8px 30px rgba(0,0,0,.12);padding:16px 18px;' +
      'font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}' +
      '.tp-cc p{margin:0 0 12px}' +
      '.tp-cc a{color:#1a56db}' +
      '.tp-cc-actions{display:flex;gap:8px;flex-wrap:wrap}' +
      '.tp-cc button{flex:1 1 120px;cursor:pointer;font:inherit;font-weight:600;padding:10px 14px;border-radius:8px;' +
      'border:1px solid #1d1d1f;background:transparent;color:#1d1d1f}' +
      '.tp-cc button.tp-cc-accept{background:#1d1d1f;color:#ffffff}' +
      '.tp-cc button:focus-visible{outline:2px solid #1a56db;outline-offset:2px}' +
      '@media (prefers-color-scheme:dark){' +
      '.tp-cc{background:#1a1c1f;color:#ececee;border-color:#2c2e33}' +
      '.tp-cc a{color:#7aa2ff}' +
      '.tp-cc button{border-color:#ececee;color:#ececee}' +
      '.tp-cc button.tp-cc-accept{background:#ececee;color:#111214}}';
    var style = document.createElement('style');
    style.id = 'tp-cc-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function showBanner() {
    if (!GA_ID) return;
    injectStyles();
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'tp-cc';
      banner.setAttribute('role', 'region');
      banner.setAttribute('aria-label', 'Cookie preferences');
      banner.innerHTML =
        '<p>We use optional analytics cookies (Google Analytics) to understand how our website is used. ' +
        'We only set them if you accept, and you can change your choice anytime in “Cookie settings”. ' +
        '<a href="' + POLICY_URL + '">Privacy Policy</a></p>' +
        '<div class="tp-cc-actions">' +
        '<button type="button" class="tp-cc-reject">Reject</button>' +
        '<button type="button" class="tp-cc-accept">Accept</button>' +
        '</div>';
      banner.querySelector('.tp-cc-accept').addEventListener('click', accept);
      banner.querySelector('.tp-cc-reject').addEventListener('click', reject);
      document.body.appendChild(banner);
    }
    banner.style.display = 'block';
    banner.querySelector('.tp-cc-accept').focus();
  }

  function hideBanner() {
    if (banner) banner.style.display = 'none';
  }

  // ---------- "Cookie settings" links ----------
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('[data-cookie-settings]');
    if (!link) return;
    event.preventDefault();
    showBanner();
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
    var choice = readChoice();
    if (choice === 'granted') loadAnalytics();
    else if (choice !== 'denied') showBanner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();