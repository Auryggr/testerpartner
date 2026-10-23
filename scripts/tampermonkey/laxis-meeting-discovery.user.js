// ==UserScript==
// @name         TesterPartner - Laxis Meeting Discovery
// @namespace    testerpartner
// @version      2.0
// @description  Sends transcribed Laxis meetings to TesterPartner so they are matched with Opportunity Briefs.
// @match        https://app.laxis.tech/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      testerpartner.com
// @run-at       document-idle
// ==/UserScript==

/*
 * Setup (once):
 *   Tampermonkey icon → "TesterPartner - Laxis Meeting Discovery"
 *   → "🔑 Set TesterPartner key" → paste INTERNAL_API_KEY.
 *
 * The key is stored in Tampermonkey's private storage, never in this file.
 * Do not paste the key into this script or share the script with it.
 */

(async function () {
  "use strict";

  const ENDPOINT = "https://testerpartner.com/api/laxis-discovery";
  const KEY_NAME = "tp_internal_api_key";
  const LOG = "[TesterPartner]";

  GM_registerMenuCommand("🔑 Set TesterPartner key", () => {
    const value = prompt("Paste the TesterPartner INTERNAL_API_KEY:");
    if (value === null) return;

    const key = value.trim();
    if (!/^[A-Za-z0-9_-]{32,}$/.test(key)) {
      alert("That doesn't look like a valid key (expected 64 characters, letters and numbers).");
      return;
    }

    GM_setValue(KEY_NAME, key);
    alert("Key saved. Reload Laxis to sync the meetings.");
  });

  GM_registerMenuCommand("🗑️ Remove TesterPartner key", () => {
    GM_setValue(KEY_NAME, "");
    alert("Key removed.");
  });

  const apiKey = GM_getValue(KEY_NAME, "");
  if (!apiKey) {
    console.warn(`${LOG} No key set. Tampermonkey menu → "🔑 Set TesterPartner key".`);
    return;
  }

  const jwtToken = document.cookie
    .split("; ")
    .find((row) => row.startsWith("jwt_token="))
    ?.split("=")[1];

  if (!jwtToken) {
    console.log(`${LOG} jwt_token not found`);
    return;
  }

  const response = await fetch(
    "https://app.laxis.tech/api/v1/speeches?size=20&page=0&sortBy=createdTime&ordering=desc&workspace=personal",
    { headers: { Authorization: `Bearer ${jwtToken}` } }
  );

  if (!response.ok) {
    console.log(`${LOG} Laxis request failed:`, response.status);
    return;
  }

  const data = await response.json();

  const meetings = (data.items || [])
    .filter((meeting) => meeting.status === "transcribed")
    .map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      createdTime: meeting.createdTime,
      duration: meeting.duration,
      status: meeting.status,
      noteUrl: `https://app.laxis.tech/notes/${meeting.id}`
    }));

  console.table(meetings);

  if (!meetings.length) {
    console.log(`${LOG} No transcribed meetings found`);
    return;
  }

  GM_xmlhttpRequest({
    method: "POST",
    url: ENDPOINT,
    headers: {
      "Content-Type": "application/json",
      "X-TesterPartner-Key": apiKey
    },
    data: JSON.stringify({ meetings }),
    onload(res) {
      if (res.status === 401) {
        console.error(`${LOG} 401: key rejected. Set it again from the Tampermonkey menu (must match Cloudflare).`);
        return;
      }
      if (res.status === 503) {
        console.error(`${LOG} 503: INTERNAL_API_KEY is not configured in Cloudflare (Production).`);
        return;
      }
      console.log(`${LOG} status:`, res.status);
      console.log(`${LOG} response:`, res.responseText);
    },
    onerror(error) {
      console.error(`${LOG} request error:`, error);
    }
  });
})();
