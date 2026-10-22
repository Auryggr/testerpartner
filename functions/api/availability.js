import {
  ok,
  error
} from "../../lib/response.js";

import {
  getAvailability
} from "../../lib/scheduler.js";


export async function onRequestGet(context) {
  try {
    const availability =
      await getAvailability(
        context.env
      );

    return ok(availability);

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