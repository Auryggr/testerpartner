import { createOpportunityBrief } from "../../lib/airtable.js";
import { ok, error } from "../../lib/response.js";

export async function onRequestGet(context) {
  try {
    const briefId = crypto.randomUUID();

    const record = await createOpportunityBrief(
      context.env,
      {
        "Brief ID": briefId,
        "Status": "Booked",
        "Conversation":
          "Test connection between Cloudflare and Airtable.",
        "Difficulty":
          "Evidence",
        "Desired Outcome":
          "One positioning hypothesis",
        "Future Change":
          "Know what to test",
        "Meeting Time":
          "10:00"
      }
    );

    return ok({
      connected: true,
      briefId,
      recordId: record.id
    });
  } catch (err) {
    console.error(err);

    return error(err.message, 500);
  }
}