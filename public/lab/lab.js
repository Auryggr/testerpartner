/*
 * Civic Friction Lab — booking links.
 * Every link with data-lab-book goes to /?ref=<story>#book and carries the
 * utm_* tags the reader arrived with, so the booking records both the
 * campaign (e.g. a LinkedIn post) and the story that convinced them.
 * Nothing is stored in the browser.
 */
(function () {
  "use strict";
  var incoming = new URLSearchParams(window.location.search);
  var links = document.querySelectorAll("[data-lab-book]");

  for (var i = 0; i < links.length; i++) {
    var link = links[i];
    var params = new URLSearchParams();
    incoming.forEach(function (value, key) {
      if (/^utm_(source|medium|campaign|content|term)$/.test(key)) params.set(key, value);
    });
    params.set("ref", link.getAttribute("data-lab-book"));
    link.setAttribute("href", "/?" + params.toString() + "#book");
  }
})();
