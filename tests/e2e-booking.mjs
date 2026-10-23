/*
 * TesterPartner — end-to-end check of the booking form (Playwright).
 *
 * Opens the site in a real browser, fills steps 1–5 of the Mapping Session
 * form and checks that step 6 shows available days and step 7 shows times.
 * It NEVER confirms a booking, so it does not create events, Airtable
 * records or emails.
 *
 * Usage:
 *   npm install --no-save playwright && npx playwright install chromium
 *   BASE_URL=https://testerpartner.com node tests/e2e-booking.mjs
 */

import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE_URL = (process.env.BASE_URL || "https://testerpartner.com").replace(/\/$/, "");
const STAGING_USER = process.env.STAGING_USER || "";
const STAGING_PASSWORD = process.env.STAGING_PASSWORD || "";
const ARTIFACTS = "tests/artifacts";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  ...(STAGING_USER && STAGING_PASSWORD
    ? { httpCredentials: { username: STAGING_USER, password: STAGING_PASSWORD } }
    : {})
});

// Decline analytics before the page loads: no cookie banner in the way
// and no QA visits counted in Google Analytics.
await context.addInitScript(() => {
  try {
    localStorage.setItem("tp_cookie_consent", "denied");
  } catch {}
});

const page = await context.newPage();
const alerts = [];
page.on("dialog", async (dialog) => {
  alerts.push(dialog.message());
  await dialog.dismiss();
});

async function step(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.log(`❌ ${name}\n   → ${error.message.split("\n")[0]}`);
    if (alerts.length) console.log(`   Alerts shown to the visitor: ${alerts.join(" | ")}`);
    mkdirSync(ARTIFACTS, { recursive: true });
    await page.screenshot({ path: `${ARTIFACTS}/booking-failure.png`, fullPage: true });
    console.log(`   Screenshot: ${ARTIFACTS}/booking-failure.png`);
    await browser.close();
    process.exit(1);
  }
}

console.log(`\nTesterPartner booking form → ${BASE_URL}\n`);

await step("Home loads", async () => {
  const res = await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
  if (!res || res.status() !== 200) throw new Error(`Status ${res?.status()}`);
});

await step("Booking form opens", async () => {
  await page.locator(".js-book-breakdown:visible").first().click();
  await page.locator('[data-step="1"].active').waitFor({ timeout: 5000 });
});

await step("Steps 1–4: decision, constraint, session goal, review", async () => {
  await page.fill("#challenge", "QA check: should we fix checkout friction or rethink the offer?");
  await page.click('[data-step="1"] .next-step');
  await page.check('input[name="difficulty"] >> nth=0', { force: true });
  await page.click('[data-step="2"] .next-step');
  await page.check('input[name="outcome"] >> nth=0', { force: true });
  await page.click('[data-step="3"] .next-step');
  await page.click('[data-step="4"] .next-step');
  await page.locator('[data-step="5"].active').waitFor({ timeout: 5000 });
});

await step("Step 5: details and privacy consent", async () => {
  await page.check('input[name="partnerType"][value="DTC / Ecommerce Brand"]', { force: true });
  await page.fill("#name", "QA Bot");
  await page.fill("#email", "qa@testerpartner.com");
  await page.fill("#website", "example.com");
  await page.check("#consentPrivacy");
  await page.click('[data-step="5"] .next-step');
  await page.locator('[data-step="6"].active').waitFor({ timeout: 5000 });
});

await step("Step 6 shows available days (Google Calendar token OK)", async () => {
  const days = page.locator("#dayGrid .day-option");
  try {
    await days.first().waitFor({ timeout: 20000 });
  } catch {
    const status = (await page.locator("#dayGrid").innerText()).trim();
    throw new Error(`No days shown. The form says: "${status}"`);
  }
  console.log(`   ${await days.count()} days shown`);
});

await step("Step 7 shows times for the first day", async () => {
  await page.locator("#dayGrid .day-option").first().click();
  await page.click("#continueDay");
  const times = page.locator("#timeGrid .time-option");
  await times.first().waitFor({ timeout: 5000 });
  console.log(`   ${await times.count()} times shown`);
  // Deliberately stop here: never click "Book the Mapping Session".
});

await browser.close();
console.log("\nBooking form OK (no booking was created)\n");
