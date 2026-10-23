import {
  ok,
  error
} from "../../lib/response.js";

import {
  getAvailability
} from "../../lib/scheduler.js";

import {
  minNoticeMinutes
} from "../../lib/qa-mode.js";


export async function onRequestGet(context) {
  try {
    const availability =
      await getAvailability(
        context.env,
        {
          minNoticeMinutes:
            minNoticeMinutes(
              context.request,
              context.env
            )
        }
      );

    const response =
      ok(availability);

    // The answer depends on the QA cookie: never cache it.
    response.headers.set(
      "Cache-Control",
      "private, no-store"
    );

    return response;

  } catch (err) {
    
    console.error(
      "Availability error:",
      err
    );

    return error(
      "We couldn’t load available times right now. Please try again in a few minutes or email hello@testerpartner.com.",
      500
    );
  }
}