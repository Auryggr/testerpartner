# TesterPartner — deployment notes

Replace `index.html`, `script.js`, and `functions/api/booking.js` with the included files. The booking function uses existing `lib/airtable.js` unchanged: it forwards the supplied fields, and its research fallback reads `Website`.

## Airtable OpportunityBriefs — required fields BEFORE deployment
Create these exact field names:
- `Partner Type`: Single select with options `Agency`, `DTC / Ecommerce Brand`.
- `Agency Website`: URL.
- `Client Website`: URL.

Existing `Website` now stores the **research target** URL (client for agencies; own brand for DTC). This preserves the existing research dispatcher and fallback query, which use `Website`. `Agency Website` preserves the agency URL separately. `Client Website` stores the chosen client URL for agencies. Existing records are not automatically migrated.

`Company Type` is no longer populated during booking. To populate it later, the research workflow must explicitly classify the investigated business and update the Airtable record; that workflow is not included in this ZIP. Do not infer a company type solely from the URL. `Why Stuck` and `Desired Outcome` must accept the option values sent by the existing form. Do not deploy before checking Airtable single-select choices.

## Important
- No live Airtable base, Cloudflare, GitHub or calendar has been modified.
- The booking calendar duration remains governed by `SESSION_DURATION` and defaults to 30 in this existing backend; set `SESSION_DURATION=15` and ensure availability endpoint uses same value if you want actual 15-minute events.
- Research workflow receives `website` as the research target, with no GitHub workflow contract change.
- Test agency and brand bookings in staging before production.

## Removed question
The business-type question was removed from step 5. The frontend no longer validates or sends `future`/`companyType`. Booking no longer writes `Company Type`; the research dispatcher receives `companyType: null` for compatibility. If your research workflow requires a non-null company type, update that workflow before deploying.
